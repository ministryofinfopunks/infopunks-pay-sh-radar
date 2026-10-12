/** Runs current collection once on startup and on subsequent ticks; missing historical slots stay missing. */
export function startRhChainMarketScheduler(run: () => Promise<unknown>, intervalMs: number, onError: () => void) {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const tick = () => {
    if (stopped || inFlight) return;
    inFlight = Promise.resolve().then(run).then(() => undefined).catch(onError).finally(() => { inFlight = null; });
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return {
    async stop() { stopped = true; clearInterval(timer); await inFlight; }
  };
}
