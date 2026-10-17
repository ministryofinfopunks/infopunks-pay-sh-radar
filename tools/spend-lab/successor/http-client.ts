import { fork } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import {
  createInfopunksClient,
  type JudgmentPaymentAdapter,
  type CreateInfopunksClientOptions,
} from '../../../src/sdk/judgmentClient';
import type { TrustedJudgmentIssuer } from '../../../src/sdk/judgmentIntegrity';
import { localFetch } from './local-fetch';
export const localApiKey = 'local_lab_' + 'a'.repeat(40);
export async function freePort() {
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  if (!address || typeof address === 'string') throw new Error('no_local_port');
  return address.port;
}
export async function startHttpLab(database: string, port: number) {
  const child = fork(
    resolve('tools/spend-lab/successor/http-worker.ts'),
    [database, String(port)],
    {
      execArgv: ['--import', 'tsx'],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      // No inherited database, signing, wallet, payment, staging or production configuration.
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        DATABASE_URL: '',
        PORT: String(port),
      },
    },
  );
  let stderr = '';
  child.stderr?.on('data', (b) => {
    stderr = (stderr + String(b)).slice(-3000);
  });
  child.stdout?.resume();
  const trustedIssuer = await new Promise<TrustedJudgmentIssuer>((resolveReady, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('http_lab_start_timeout'));
    }, 20000);
    child.once('message', (m: { ready: boolean; trustedIssuer: TrustedJudgmentIssuer }) => {
      clearTimeout(timeout);
      resolveReady(m.trustedIssuer);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error('http_lab_start_failed_' + code + ':' + stderr));
    });
  });
  const origin = 'http://127.0.0.1:' + port;
  const transport = localFetch(origin);
  let authorizations = 0;
  const payment: JudgmentPaymentAdapter = {
    policy: {
      network: 'eip155:8453',
      asset: 'USDC',
      payTo: '0x' + '2'.repeat(40),
      maxAmountAtomic: '10000',
    },
    authorize: async ({ challenge, sessionId }) => {
      authorizations++;
      return encodePaymentSignatureHeader({
        x402Version: 2,
        accepted: challenge.accepts[0],
        payload: {
          signature: 'SIMULATION_ONLY_NON_EVM_PROOF',
          authorization: {
            from: '0x' + '1'.repeat(40),
            to: '0x' + '2'.repeat(40),
            value: '10000',
            nonce: 'local-only-' + createHash('sha256').update(sessionId).digest('hex'),
            validAfter: String(Math.floor(Date.now() / 1000) - 60),
            validBefore: String(Math.floor(Date.now() / 1000) + 120),
          },
        },
      });
    },
  };
  return {
    origin,
    trustedIssuer,
    transport,
    get authorizations() {
      return authorizations;
    },
    client(
      extra: Pick<
        CreateInfopunksClientOptions,
        'sessionStore' | 'onTransition' | 'fetch' | 'trustedIssuer' | 'payment'
      > = {},
    ) {
      return createInfopunksClient({
        baseUrl: origin,
        apiKey: localApiKey,
        payment,
        trustedIssuer,
        ...extra,
        fetch: localFetch(origin, extra.fetch ?? transport),
      });
    },
    async close(crash = false) {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const done = new Promise<void>((r) => child.once('exit', () => r()));
      if (crash) child.kill('SIGKILL');
      else child.send('close');
      await done;
    },
    async counts() {
      return (
        await (
          await transport(origin + '/lab/payment-count', {
            headers: { authorization: 'Bearer ' + localApiKey },
          })
        ).json()
      ).count as number;
    },
  };
}
export type HttpLab = Awaited<ReturnType<typeof startHttpLab>>;
export async function seedHttpEvidence(
  lab: HttpLab,
  subject: string,
  signal: { confidence: number; veto: boolean; sufficient: boolean },
) {
  const input = {
    agent_id: 'agent',
    intent: 'buy_market_research ' + subject,
    budget: 1,
    risk_tolerance: 'low' as const,
    required_confidence: 80,
    preferred_settlement: 'stablecoin',
    subject_id: 'route_pay_sh_market_research_03',
  };
  const diagnostic = await lab.transport(lab.origin + '/v1/pre-spend/check', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + localApiKey,
      'content-type': 'application/json',
      'idempotency-key': subject + '-diagnostic',
    },
    body: JSON.stringify(input),
  });
  const route = (await diagnostic.json()).data?.recommended_route;
  if (!route) throw new Error('local_route_diagnostic_failed');
  const seed = await lab.transport(lab.origin + '/lab/observe', {
    method: 'POST',
    headers: { authorization: 'Bearer local-evidence-writer', 'content-type': 'application/json' },
    body: JSON.stringify({ input, route, ...signal }),
  });
  if (!seed.ok) throw new Error('local_observation_failed_' + (await seed.text()));
  return input;
}
