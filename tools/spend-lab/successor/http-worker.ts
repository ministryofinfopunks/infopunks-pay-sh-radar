import Fastify from 'fastify';
import { createHash } from 'node:crypto';
import { createApp } from '../../../src/api/app';
import { createX402JudgmentGateway } from '../../../src/middleware/x402JudgmentMiddleware';
import { createReceiptAuthorityService } from '../../../src/services/receiptAuthorityService';
import { hashCanonical } from '../../../src/services/receiptIntegrityService';
import { localSimulationProvenance } from '../../../src/security/evidenceProvenance';
import { LabDatabase } from '../harness/storage';
import { labIdentity, labIssuers } from '../harness/identity';
import { httpStorage } from './http-storage';
import { localFetch } from './local-fetch';

async function main() {
  const [path, portText] = process.argv.slice(2);
  if (!path || !/^\d+$/.test(portText)) throw new Error('local_worker_arguments');
  const db = new LabDatabase(path),
    { judgmentIssuer } = labIssuers(db);
  const identity = labIdentity(db, 'judgment');
  process.env.JUDGMENT_ISSUER = identity.issuer;
  process.env.JUDGMENT_ISSUER_KEYS_JSON = JSON.stringify(identity.keys);
  process.env.JUDGMENT_SIGNING_KEY_ID = identity.activeKeyId;
  process.env.JUDGMENT_SIGNING_PRIVATE_KEY = identity.privateKeyPem;
  const apiKey = 'local_lab_' + 'a'.repeat(40);
  process.env.JUDGMENT_API_KEYS_JSON = JSON.stringify([
    {
      tenant_id: 'spend-lab',
      agent_id: 'agent',
      key_sha256: createHash('sha256').update(apiKey).digest('hex'),
    },
  ]);
  process.env.ADMIN_TOKEN = 'local-evidence-writer';
  const origin = 'http://127.0.0.1:' + portText;
  const facilitator = Fastify({ logger: false });
  db.db.exec(
    'CREATE TABLE IF NOT EXISTS simulated_payments(nonce TEXT PRIMARY KEY, fingerprint TEXT, transaction_ref TEXT)',
  );
  const payer = '0x' + '1'.repeat(40),
    payTo = '0x' + '2'.repeat(40);
  facilitator.get('/supported', async () => ({
    kinds: [{ x402Version: 2, scheme: 'exact', network: 'eip155:8453' }],
    extensions: [],
    signers: {},
  }));
  function payment(body: unknown) {
    const b = body as {
      paymentPayload?: {
        payload?: {
          signature?: string;
          authorization?: { nonce?: string; from?: string; to?: string; value?: string };
        };
      };
      paymentRequirements?: { amount?: string; payTo?: string };
    };
    const p = b?.paymentPayload?.payload;
    if (
      p?.signature !== 'SIMULATION_ONLY_NON_EVM_PROOF' ||
      !p.authorization?.nonce?.startsWith('local-only-') ||
      p.authorization.from !== payer ||
      p.authorization.to !== payTo ||
      p.authorization.value !== '10000' ||
      b.paymentRequirements?.amount !== '10000' ||
      b.paymentRequirements.payTo !== payTo
    )
      throw new Error('simulation_proof_required');
    return { nonce: p.authorization.nonce, fingerprint: hashCanonical(b) };
  }
  facilitator.post('/verify', async (req) => {
    try {
      payment(req.body);
      return { isValid: true, payer };
    } catch {
      return { isValid: false, invalidReason: 'simulation_proof_required' };
    }
  });
  facilitator.post('/settle', async (req, reply) => {
    try {
      const p = payment(req.body),
        prior = db.db.prepare('SELECT * FROM simulated_payments WHERE nonce=?').get(p.nonce);
      if (prior && prior.fingerprint !== p.fingerprint)
        return reply.code(409).send({ error: 'nonce_conflict' });
      const transaction = prior
        ? String(prior.transaction_ref)
        : 'simulation:x402/' + hashCanonical(p).slice(7);
      db.db
        .prepare('INSERT OR IGNORE INTO simulated_payments VALUES(?,?,?)')
        .run(p.nonce, p.fingerprint, transaction);
      return { success: true, transaction, network: 'eip155:8453', payer };
    } catch {
      return reply.code(400).send({ error: 'simulation_proof_required' });
    }
  });
  const facilitatorOrigin = await facilitator.listen({ host: '127.0.0.1', port: 0 });
  // The complete app is hosted on loopback in a clean subprocess. Any accidental remote fetch fails closed.
  const nativeFetch = globalThis.fetch;
  const appFetch = localFetch(origin, nativeFetch),
    facilitatorFetch = localFetch(facilitatorOrigin, nativeFetch);
  globalThis.fetch = (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    return (url.origin === origin ? appFetch : facilitatorFetch)(input, init);
  };
  const gateway = await createX402JudgmentGateway({
    facilitatorUrl: facilitatorOrigin,
    payTo,
    amount: '0.01',
    resourceUrl: origin + '/v1/pre-spend/check',
  });
  const { store, journal } = await httpStorage(db, judgmentIssuer);
  const app = await createApp(undefined, undefined, {
    judgmentGateway: { ...gateway, evidenceDomain: store.evidenceDomain },
    judgmentReceiptStore: store,
    judgmentRequestJournal: journal,
  });
  // Private local observer: never available in the production app. The bounded controller does not expose this tool to agents.
  app.post('/lab/observe', async (req, reply) => {
    if (req.headers.authorization !== 'Bearer local-evidence-writer')
      return reply.code(401).send({ error: 'observer_required' });
    const body = req.body as {
      input: { subject_id: string; intent: string };
      route: string;
      confidence: number;
      veto: boolean;
      sufficient: boolean;
    };
    if (!body.input.intent.startsWith('buy_market_research lab-'))
      return reply.code(400).send({ error: 'local_subject_required' });
    const at = new Date();
    const receipt = await createReceiptAuthorityService(
      store,
      80,
      judgmentIssuer,
    ).appendObservation({
      observation_id: 'local-observation-' + hashCanonical(body.input).slice(7),
      subject_type: 'route',
      subject_id: body.input.subject_id,
      intent_hash: hashCanonical(body.input),
      source_type: 'reviewed_judgment_facts',
      source_id: 'spend-lab/local-probe',
      observed_at: at.toISOString(),
      ingested_at: at.toISOString(),
      freshness_expires_at: new Date(at.getTime() + 120000).toISOString(),
      evidence_state: body.sufficient ? 'sufficient' : 'insufficient',
      evidence_refs: ['lab-probe/' + hashCanonical(body)],
      provenance: { ...localSimulationProvenance },
      payload: {
        catalog_live: false,
        identity_resolved: true,
        required_proof_complete: true,
        intent_satisfied: true,
        constraints_satisfied: true,
        confidence: body.confidence,
        deterministic_veto: body.veto,
        bounded_test_allowed: false,
        max_cost: 0.1,
        asset: 'USDC',
        settlement: 'stablecoin',
        route_id: body.route,
        decision_state: 'approved',
        reasons: ['Local probe only; no market or settlement assertion.'],
      },
    });
    return { data: receipt };
  });
  app.get('/lab/payment-count', async (req, reply) => {
    if (req.headers.authorization !== 'Bearer ' + apiKey)
      return reply.code(401).send({ error: 'unauthorized' });
    return {
      count: Number(db.db.prepare('SELECT count(*) AS n FROM simulated_payments').get()!.n),
      simulation: true,
    };
  });
  await app.listen({ host: '127.0.0.1', port: Number(portText) });
  process.send?.({ ready: true, trustedIssuer: judgmentIssuer.publicKeys() });
  process.on('message', async (message) => {
    if (message === 'close') {
      await app.close();
      await facilitator.close();
      db.close();
      process.exit(0);
    }
  });
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
