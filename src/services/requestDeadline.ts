export type RequestDeadline = {
  readonly signal: AbortSignal;
  readonly deadlineAtMs: number;
  remainingMs(): number;
  abort(reason?: string): void;
  dispose(): void;
};

export type DeadlineOutcome<T> =
  | { ok: true; value: T; durationMs: number }
  | { ok: false; reason: 'timeout' | 'aborted' | 'error'; error: Error; durationMs: number };

/** A single monotonic wall-clock budget shared by all work for one public request. */
export function createRequestDeadline(timeoutMs: number, now: () => number = Date.now): RequestDeadline {
  const safeTimeoutMs = Math.max(1, Math.floor(timeoutMs));
  const controller = new AbortController();
  const deadlineAtMs = now() + safeTimeoutMs;
  const timer = setTimeout(() => controller.abort(new Error('request_deadline_exhausted')), safeTimeoutMs);
  timer.unref?.();
  return {
    signal: controller.signal,
    deadlineAtMs,
    remainingMs: () => Math.max(0, deadlineAtMs - now()),
    abort: (reason = 'request_aborted') => {
      if (!controller.signal.aborted) controller.abort(new Error(reason));
    },
    dispose: () => clearTimeout(timer)
  };
}

/**
 * Bounds one child operation by both the request deadline and a smaller local cap.
 * Rejections are always observed, even when the deadline wins the race.
 */
export async function runWithinDeadline<T>(
  deadline: Pick<RequestDeadline, 'signal' | 'remainingMs'>,
  maxDurationMs: number,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<DeadlineOutcome<T>> {
  const startedAtMs = Date.now();
  const remainingMs = deadline.remainingMs();
  const durationMs = Math.max(0, Math.min(Math.floor(maxDurationMs), remainingMs));
  if (deadline.signal.aborted || durationMs <= 0) {
    return { ok: false, reason: 'timeout', error: new Error('request_deadline_exhausted'), durationMs: Date.now() - startedAtMs };
  }

  const controller = new AbortController();
  const abortFromParent = () => controller.abort(deadline.signal.reason ?? new Error('request_aborted'));
  deadline.signal.addEventListener('abort', abortFromParent, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('operation_deadline_exhausted')), durationMs);
  timer.unref?.();

  const completed = Promise.resolve()
    .then(() => operation(controller.signal))
    .then(
      (value): DeadlineOutcome<T> => ({ ok: true, value, durationMs: Date.now() - startedAtMs }),
      (reason): DeadlineOutcome<T> => {
        const error = asError(reason);
        return { ok: false, reason: controller.signal.aborted ? deadlineReason(error) : 'error', error, durationMs: Date.now() - startedAtMs };
      }
    );
  const aborted = new Promise<DeadlineOutcome<T>>((resolve) => {
    controller.signal.addEventListener('abort', () => {
      const error = asError(controller.signal.reason ?? 'operation_deadline_exhausted');
      resolve({ ok: false, reason: deadlineReason(error), error, durationMs: Date.now() - startedAtMs });
    }, { once: true });
  });

  try {
    return await Promise.race([completed, aborted]);
  } finally {
    clearTimeout(timer);
    deadline.signal.removeEventListener('abort', abortFromParent);
  }
}

export function asError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'operation_failed');
}

function deadlineReason(error: Error): 'timeout' | 'aborted' {
  return /deadline|timeout/i.test(error.message) ? 'timeout' : 'aborted';
}
