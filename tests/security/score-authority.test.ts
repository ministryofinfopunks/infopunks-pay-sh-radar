import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MemoryCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createDerivedScoreService } from '../../src/services/derivedScoreService';
import { createInMemoryPreSpendRepository } from '../../src/repositories/preSpendRepository';
import { createPreSpendIntelligenceService } from '../../src/services/preSpendIntelligenceService';
import { createInMemoryLoopRepository } from '../../src/repositories/loopRepository';
import { createLoopService } from '../../src/services/loopService';
import { appendChain } from '../helpers/canonicalReceipts';

describe('Phase 4 score authority', () => {
  it('keeps all legacy intake outside canonical score history, including mutable provider state', async () => {
    const store = new MemoryCanonicalReceiptStore(); await appendChain(store);
    const scores = createDerivedScoreService(store); const prior = await scores.project('provider', 'provider_test');
    const repository = createInMemoryPreSpendRepository(); const legacy = createPreSpendIntelligenceService(repository);
    const { receipt_id, timestamp, ...receipt } = repository.listReceipts()[0];
    legacy.createReceipt({ ...receipt, confidence_delta: 0 });
    expect(await scores.project('provider', 'provider_test')).toEqual(prior);
    legacy.submitValidation({ target_type: 'receipt', target_id: receipt_id, validator_id: 'validator', validation_state: 'human_validated',
      output_quality_note: 'reviewed', blocker_note: null, dispute_note: null, confidence_adjustment: 30, human_notes: 'reviewed' });
    expect(await scores.project('provider', 'provider_test')).toEqual(prior);
    legacy.submitClaim({ submitted_by: 'test', claim_type: 'blocker', target_type: 'service', target_id: receipt.service_id, statement: 'Outcome claim',
      evidence_receipt_ids: [receipt_id], evidence_artifact_uris: ['artifact://claim'], status: 'submitted', confidence_score: 100, validation_state: 'machine_checked', support_count: 0, human_notes: [] });
    expect(await scores.project('provider', 'provider_test')).toEqual(prior);
    createLoopService(createInMemoryLoopRepository([])).createLoopCheck({ input: 'Pre-spend route loop for pay.sh checks.' });
    expect(await scores.project('provider', 'provider_test')).toEqual(prior);
    const provider = repository.listProviders()[0]; provider.reliability_score = 100;
    expect(await scores.project('provider', 'provider_test')).toEqual(prior);
  });
  it('has only one production invocation of score calculation and no policy in routes or authority', () => {
    function files(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir,e.name)]); }
    const callers = files('src').filter(f => /\.tsx?$/.test(f)).filter(f => /\.scoreDeltaForOutcome\(/.test(readFileSync(f, 'utf8')));
    expect(callers.sort()).toEqual(['src/services/evaluationScorePolicy.ts', 'src/services/evaluationService.ts']);
    for (const file of ['src/api/app.ts', 'src/services/receiptAuthorityService.ts']) expect(readFileSync(file,'utf8')).not.toContain("from './evaluationScorePolicy'");
    expect(readFileSync('src/api/app.ts','utf8')).not.toMatch(/update\s+providers\s+set\s+score/i);
  });
});
