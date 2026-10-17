import { fork } from 'node:child_process';
import { createPublicKey, verify } from 'node:crypto';
import { resolve } from 'node:path';
import { canonicalSerialize } from '../../../src/services/receiptIntegrityService';
export type Attestation = { body: Record<string, any>; signature: string };
export function verifyAttestation(attestation: Attestation, publicKey: string) {
  try {
    return verify(
      null,
      Buffer.from(
        canonicalSerialize({
          domain: 'spend-lab/evaluator-attestation.v1',
          body: attestation.body,
        }),
      ),
      createPublicKey(publicKey),
      Buffer.from(attestation.signature, 'base64'),
    );
  } catch {
    return false;
  }
}
export async function startEvaluator(directory: string) {
  const child = fork(resolve('tools/spend-lab/successor/evaluator-worker.ts'), [directory], {
    execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    env: { PATH: process.env.PATH, NODE_ENV: 'test' },
  });
  const publicKey = await new Promise<string>((r, j) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      j(new Error('evaluator_timeout'));
    }, 10000);
    child.once('message', (m: any) => {
      clearTimeout(timer);
      r(m.publicKey);
    });
    child.once('exit', () => {
      clearTimeout(timer);
      j(new Error('evaluator_start_failed'));
    });
  });
  let sequence = 0;
  return {
    publicKey,
    async request(message: Record<string, unknown>): Promise<Attestation> {
      const id = ++sequence;
      return new Promise((r, j) => {
        const timer = setTimeout(() => {
          child.off('message', listener);
          j(new Error('evaluator_timeout'));
        }, 10000);
        const listener = (m: any) => {
          if (m.id !== id) return;
          child.off('message', listener);
          clearTimeout(timer);
          if (m.error) j(new Error(m.error));
          else if (!verifyAttestation(m, publicKey)) j(new Error('evaluator_signature_invalid'));
          else r({ body: m.body, signature: m.signature });
        };
        child.on('message', listener);
        child.send({ ...message, id });
      });
    },
    async close() {
      if (child.exitCode !== null) return;
      const done = new Promise<void>((r) => child.once('exit', () => r()));
      child.send({ kind: 'close' });
      await done;
    },
  };
}
