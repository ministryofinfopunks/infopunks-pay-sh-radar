import { describe, expect, it } from 'vitest';
import {
  createInMemoryPreSpendRepository,
  createPreSpendRepository,
  preSpendRepository
} from '../src/repositories/preSpendRepository';

describe('pre-spend repository', () => {
  it('creates an in-memory repository implementing the full adapter interface', () => {
    const repository = createInMemoryPreSpendRepository();

    expect(repository).toMatchObject({
      listRoutes: expect.any(Function),
      getRoute: expect.any(Function),
      listProviders: expect.any(Function),
      getProvider: expect.any(Function),
      listServices: expect.any(Function),
      getService: expect.any(Function),
      listReceipts: expect.any(Function),
      getReceipt: expect.any(Function),
      createReceipt: expect.any(Function),
      listValidations: expect.any(Function),
      getValidationsForTarget: expect.any(Function),
      submitValidation: expect.any(Function),
      listClaims: expect.any(Function),
      getClaim: expect.any(Function),
      submitClaim: expect.any(Function),
      listChallenges: expect.any(Function),
      getChallenge: expect.any(Function),
      getChallengesForClaim: expect.any(Function),
      submitClaimChallenge: expect.any(Function),
      getMetricsState: expect.any(Function),
      recordPreSpendCheck: expect.any(Function)
    });
  });

  it('lists and gets routes deterministically', () => {
    const repository = createPreSpendRepository();
    const routes = repository.listRoutes();

    expect(routes.length).toBeGreaterThanOrEqual(6);
    expect(repository.getRoute('route_pay_sh_token_quote_01')?.provider_id).toBe('provider_pay_sh_quartz');
    expect(repository.getRoute('missing-route')).toBeNull();
  });

  it('lists and gets providers deterministically', () => {
    const repository = createPreSpendRepository();
    const providers = repository.listProviders();

    expect(providers.length).toBeGreaterThanOrEqual(5);
    expect(repository.getProvider('provider_pay_sh_oracle')?.name).toBe('Oracle Verification Fabric');
    expect(repository.getProvider('provider_missing')).toBeNull();
  });

  it('lists and gets services deterministically', () => {
    const repository = createPreSpendRepository();
    const services = repository.listServices();

    expect(services.length).toBeGreaterThanOrEqual(5);
    expect(repository.getService('service_market_research')?.best_observed_route).toBe('route_pay_sh_market_research_03');
    expect(repository.getService('service_missing')).toBeNull();
  });

  it('lists receipts in descending timestamp order and gets receipt detail records', () => {
    const repository = createPreSpendRepository();
    const receipts = repository.listReceipts();

    expect(receipts.length).toBeGreaterThanOrEqual(11);
    expect(receipts[0]?.receipt_id).toBe('receipt_005');
    expect(repository.getReceipt('receipt_003')?.route_id).toBe('route_pay_sh_market_research_03');
    expect(repository.getReceipt('receipt_missing')).toBeNull();
  });

  it('creates receipts and updates linked route and provider state', () => {
    const repository = createPreSpendRepository();
    const providerReceiptCountBefore = repository.getProvider('provider_pay_sh_quartz')?.recent_receipt_count ?? 0;
    const receipt = repository.createReceipt({
      agent_id: 'agent_020',
      route_id: 'route_pay_sh_token_quote_01',
      provider_id: 'provider_pay_sh_quartz',
      service_id: 'service_token_pricing',
      task_type: 'price_token_quote',
      cost: '0.07 USDC',
      payment_method: 'stablecoin',
      latency_ms: 255,
      input_summary: 'SOL/USDC quote request',
      output_summary: 'bounded quote JSON',
      status: 'succeeded',
      failure_reason: null,
      validation_state: 'machine_checked',
      human_notes: [],
      confidence_delta: 3,
      evidence_artifact: 'artifact_token_quote_run_004'
    });

    expect(receipt.receipt_id).toBe('receipt_012');
    expect(repository.listReceipts()[0]?.receipt_id).toBe(receipt.receipt_id);
    expect(repository.getRoute('route_pay_sh_token_quote_01')?.receipt_references[0]).toBe(receipt.receipt_id);
    expect(repository.getRoute('route_pay_sh_token_quote_01')?.last_successful_run).toBe(receipt.timestamp);
    expect(repository.getProvider('provider_pay_sh_quartz')?.recent_receipt_count).toBe(providerReceiptCountBefore + 1);
  });

  it('lists validations and filters validations by target', () => {
    const repository = createPreSpendRepository();

    expect(repository.listValidations().length).toBe(3);
    expect(repository.getValidationsForTarget('receipt', 'receipt_003')).toHaveLength(1);
    expect(repository.getValidationsForTarget('provider', 'provider_x')[0]?.validation_state).toBe('disputed');
    expect(repository.getValidationsForTarget('service', 'service_missing')).toHaveLength(0);
  });

  it('submits validation and mutates target state consistently', () => {
    const repository = createPreSpendRepository();
    const createdReceipt = repository.createReceipt({
      agent_id: 'agent_020',
      route_id: 'route_pay_sh_token_quote_01',
      provider_id: 'provider_pay_sh_quartz',
      service_id: 'service_token_pricing',
      task_type: 'price_token_quote',
      cost: '0.07 USDC',
      payment_method: 'stablecoin',
      latency_ms: 255,
      input_summary: 'SOL/USDC quote request',
      output_summary: 'bounded quote JSON',
      status: 'succeeded',
      failure_reason: null,
      validation_state: 'machine_checked',
      human_notes: [],
      confidence_delta: 3,
      evidence_artifact: 'artifact_token_quote_run_004'
    });

    const validation = repository.submitValidation({
      target_type: 'receipt',
      target_id: createdReceipt.receipt_id,
      validator_id: 'validator_100',
      validation_state: 'human_validated',
      output_quality_note: 'useful',
      blocker_note: null,
      dispute_note: null,
      confidence_adjustment: 5,
      human_notes: 'Looks good.'
    });

    expect(validation.validation_state).toBe('human_validated');
    expect(repository.listValidations()[0]?.target_id).toBe(createdReceipt.receipt_id);
    expect(repository.getReceipt(createdReceipt.receipt_id)?.validation_state).toBe('human_validated');
    expect(repository.getReceipt(createdReceipt.receipt_id)?.confidence_delta).toBe(8);
    expect(repository.getReceipt(createdReceipt.receipt_id)?.human_notes).toContain('Looks good.');
    expect(repository.getMetricsState().human_validations_submitted).toBe(4);
  });

  it('lists claims and gets claim detail records deterministically', () => {
    const repository = createPreSpendRepository();
    const claims = repository.listClaims();

    expect(claims.length).toBeGreaterThanOrEqual(2);
    expect(repository.getClaim('claim_001')?.target_type).toBe('route');
    expect(repository.getClaim('claim_missing')).toBeNull();
  });

  it('submits claims and challenges and updates challenge counters', () => {
    const repository = createPreSpendRepository();
    const claim = repository.submitClaim({
      submitted_by: 'builder_ui',
      claim_type: 'blocker',
      target_type: 'service',
      target_id: 'service_receipt_parsing',
      statement: 'Layout-heavy parsing still needs human validation.',
      evidence_receipt_ids: ['receipt_009'],
      evidence_artifact_uris: ['artifact://artifact_receipt_parse_run_002'],
      status: 'submitted',
      confidence_score: 62,
      validation_state: 'machine_checked',
      support_count: 0,
      human_notes: ['Submitted in test.']
    });

    expect(claim.claim_id).toBe('claim_003');
    expect(repository.listClaims()[0]?.claim_id).toBe(claim.claim_id);

    const challenge = repository.submitClaimChallenge({
      claim_id: claim.claim_id,
      challenged_by: 'validator_500',
      reason: 'Fresh replacement receipts are still missing.',
      evidence_receipt_ids: ['receipt_008'],
      evidence_artifact_uris: ['artifact://artifact_receipt_parse_run_001'],
      status: 'submitted',
      human_notes: ['Challenge submitted in test.']
    });

    expect(challenge.challenge_id).toBe('challenge_002');
    expect(repository.getChallengesForClaim(claim.claim_id)).toHaveLength(1);
    expect(repository.getClaim(claim.claim_id)?.challenge_count).toBe(1);
    expect(repository.getClaim(claim.claim_id)?.status).toBe('challenged');
    expect(repository.getChallenge(challenge.challenge_id)?.claim_id).toBe(claim.claim_id);
  });

  it('keeps mutable receipt state isolated between separately created repositories', () => {
    const first = createInMemoryPreSpendRepository();
    const second = createInMemoryPreSpendRepository();

    const created = first.createReceipt({
      agent_id: 'agent_020',
      route_id: 'route_pay_sh_token_quote_01',
      provider_id: 'provider_pay_sh_quartz',
      service_id: 'service_token_pricing',
      task_type: 'price_token_quote',
      cost: '0.07 USDC',
      payment_method: 'stablecoin',
      latency_ms: 255,
      input_summary: 'SOL/USDC quote request',
      output_summary: 'bounded quote JSON',
      status: 'succeeded',
      failure_reason: null,
      validation_state: 'machine_checked',
      human_notes: [],
      confidence_delta: 3,
      evidence_artifact: 'artifact_token_quote_run_004'
    });

    expect(first.getReceipt(created.receipt_id)?.receipt_id).toBe(created.receipt_id);
    expect(second.getReceipt(created.receipt_id)).toBeNull();
    expect(first.listReceipts()).toHaveLength(second.listReceipts().length + 1);
  });

  it('keeps mutable validation state isolated between separately created repositories', () => {
    const first = createInMemoryPreSpendRepository();
    const second = createInMemoryPreSpendRepository();

    const created = first.createReceipt({
      agent_id: 'agent_021',
      route_id: 'route_pay_sh_token_quote_01',
      provider_id: 'provider_pay_sh_quartz',
      service_id: 'service_token_pricing',
      task_type: 'price_token_quote',
      cost: '0.07 USDC',
      payment_method: 'stablecoin',
      latency_ms: 240,
      input_summary: 'ETH/USDC quote request',
      output_summary: 'bounded quote JSON',
      status: 'succeeded',
      failure_reason: null,
      validation_state: 'machine_checked',
      human_notes: [],
      confidence_delta: 2,
      evidence_artifact: 'artifact_token_quote_run_005'
    });

    first.submitValidation({
      target_type: 'receipt',
      target_id: created.receipt_id,
      validator_id: 'validator_101',
      validation_state: 'human_validated',
      output_quality_note: 'consistent',
      blocker_note: null,
      dispute_note: null,
      confidence_adjustment: 4,
      human_notes: 'Validated in first repository.'
    });

    expect(first.getReceipt(created.receipt_id)?.validation_state).toBe('human_validated');
    expect(second.getReceipt(created.receipt_id)).toBeNull();
    expect(first.listValidations()).toHaveLength(second.listValidations().length + 1);
  });

  it('preserves the legacy factory alias and runtime singleton exports', () => {
    expect(createPreSpendRepository).toBe(createInMemoryPreSpendRepository);
    expect(preSpendRepository.listRoutes().length).toBeGreaterThanOrEqual(6);
  });
});
