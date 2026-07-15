import { createRhChainSource, type RhChainLaunchpadClaim, type RhChainLaunchpadObservatoryPayload, type RhChainLaunchpadSurface } from '../data/rhChain';

const OBSERVED_AT = '2026-07-15T00:00:00.000Z';
const DOCTRINE = 'External data gives context. Infopunks gives judgment. Receipts create memory. Infopunks does not launch the token. Infopunks remembers the launch.' as const;

function sourceFor(name: string, note: string) {
  return createRhChainSource({
    source_name: `Infopunks Launchpad Observatory manual registry: ${name}`,
    source_url: 'https://radar.infopunks.fun/rh-chain-signal-desk/launchpad-observatory',
    observed_at: OBSERVED_AT,
    data_mode: 'manual',
    confidence_level: 'low',
    note
  });
}

function surface(input: Omit<RhChainLaunchpadSurface, 'last_observed_at' | 'data_mode' | 'source'>): RhChainLaunchpadSurface {
  const source = sourceFor(input.name, input.source_notes.join(' '));
  return { ...input, last_observed_at: OBSERVED_AT, data_mode: 'manual', source };
}

/** Assembles human-readable launch-origin memory; it deliberately does not inspect or rank launch flows. */
export function assembleRhChainLaunchpadObservatory(): RhChainLaunchpadObservatoryPayload {
  const surfaces: RhChainLaunchpadSurface[] = [
    surface({ surface_id: 'noxa_fun', name: 'NOXA Fun', status: 'degraded', status_confidence: 'medium', source_notes: ['Reported NOXA stress is retained as manual context.', 'Current availability and any interruption details require primary, timestamped evidence.'], known_tokens: [], notable_claims: ['Reported disruption is not a finding about intent, solvency, or safety.'], fee_claims: ['Fee terms are source_required.'], launch_count_claims: ['Launch-count continuity is source_required.'], risk_notes: ['A front-end can become a single point of origin confusion.'], surface_risks: ['front_end_dependency', 'source_required'], infopunks_note: 'The stress event matters because memory must outlast one interface.' }),
    surface({ surface_id: 'pons', name: 'Pons', status: 'active', status_confidence: 'low', source_notes: ['Pons is tracked as reported launch-surface context; current activity needs a primary, timestamped source.'], known_tokens: [], notable_claims: ['Reported activity is source_required until primary evidence or manual review is attached.'], fee_claims: ['Fee terms are source_required.'], launch_count_claims: ['Launch-count claims are source_required.'], risk_notes: ['A listed surface is not a safety, quality, or origin determination.'], surface_risks: ['source_required'], infopunks_note: 'Active is contextual status, not an endorsement or a launch route.' }),
    surface({ surface_id: 'flap_sh', name: 'flap.sh', status: 'source_required', status_confidence: 'low', source_notes: ['Presence as a rival surface is a reported context claim; exact operation and origin records need receipts.'], known_tokens: [], notable_claims: ['Rival-surface activity is unverified without timestamped primary evidence.'], fee_claims: ['Fee terms are source_required.'], launch_count_claims: ['Launch-count claims are source_required.'], risk_notes: ['Surface rotation can fragment launch-origin memory.'], surface_risks: ['rival_surface_rotation', 'source_required'], infopunks_note: 'A listed surface is not a safety or quality signal.' }),
    surface({ surface_id: 'trensh_today', name: 'trensh.today', status: 'source_required', status_confidence: 'low', source_notes: ['Reported competitor context is retained for manual review only.'], known_tokens: [], notable_claims: ['Any launch-origin or activity claim needs an exact contract and timestamp.'], fee_claims: ['Fee terms are source_required.'], launch_count_claims: ['Launch-count claims are source_required.'], risk_notes: ['Fragmented naming can weaken origin checks.'], surface_risks: ['rival_surface_rotation', 'source_required'], infopunks_note: 'Memory follows evidence, not surface branding.' }),
    surface({ surface_id: 'bankr', name: 'bankr', status: 'source_required', status_confidence: 'low', source_notes: ['Reported launch-surface context has not been promoted to a reviewed operational claim.'], known_tokens: [], notable_claims: ['Creator economics and launch-quality descriptions remain unverified.'], fee_claims: ['Creator-fee claims are source_required.'], launch_count_claims: ['Launch-count claims are source_required.'], risk_notes: ['Fee claims need primary terms and a dated receipt.'], surface_risks: ['creator_fee_claim_uncertainty', 'launch_quality_filtering', 'source_required'], infopunks_note: 'Creator claims are not a substitute for receipts.' }),
    surface({ surface_id: 'tokeny_fun', name: 'tokeny.fun', status: 'source_required', status_confidence: 'low', source_notes: ['Manual registry entry for a reported launch surface; no safety inference is available.'], known_tokens: [], notable_claims: ['Surface participation claims remain source_required.'], fee_claims: ['Fee terms are source_required.'], launch_count_claims: ['Launch-count claims are source_required.'], risk_notes: ['Rival rotation can make canonical origin harder to retain.'], surface_risks: ['rival_surface_rotation', 'source_required'], infopunks_note: 'No receipt, no upgraded claim.' }),
    surface({ surface_id: 'vlad_fun', name: 'vlad.fun', status: 'source_required', status_confidence: 'low', source_notes: ['Manual registry entry for reported launch context only.'], known_tokens: [], notable_claims: ['Origin claims remain unverified until exact-contract review.'], fee_claims: ['Fee terms are source_required.'], launch_count_claims: ['Launch-count claims are source_required.'], risk_notes: ['Clone and copycat patterns require contract-level review.'], surface_risks: ['clone_flood', 'vampire_copycat_risk', 'source_required'], infopunks_note: 'Similarity is a review prompt, not a misconduct finding.' }),
    surface({ surface_id: 'robindotmarket', name: 'robindotmarket', status: 'source_required', status_confidence: 'low', source_notes: ['Manual registry entry for reported launch context only.'], known_tokens: [], notable_claims: ['Naming or affiliation implications require stronger source review.'], fee_claims: ['Fee terms are source_required.'], launch_count_claims: ['Launch-count claims are source_required.'], risk_notes: ['Brand-adjacent claims need canonical-source review.'], surface_risks: ['clone_flood', 'rival_surface_rotation', 'source_required'], infopunks_note: 'A familiar name never establishes identity.' }),
    surface({ surface_id: 'uniswap_direct_launches', name: 'Uniswap direct launches', status: 'active', status_confidence: 'medium', source_notes: ['Direct-pool creation is observable launch context, not a quality, liquidity, or safety determination.'], known_tokens: [], notable_claims: ['A direct pool does not establish a canonical launch origin by itself.'], fee_claims: ['Pool and creator-fee claims require exact, dated evidence.'], launch_count_claims: ['No aggregate launch count is promoted without a reviewed method.'], risk_notes: ['Low-quality direct pools can increase origin and liquidity ambiguity.'], surface_risks: ['launch_quality_filtering', 'source_required'], infopunks_note: 'A pool is evidence to inspect, not a verdict.' }),
    surface({ surface_id: 'pump_fun_routed_rh_chain', name: 'Pump routing', status: 'source_required', status_confidence: 'low', source_notes: ['Reported Pump routing context is retained for source review only.'], known_tokens: [], notable_claims: ['Cross-surface routing claims require an exact contract, pair, route, and timestamp.'], fee_claims: ['Fee terms are source_required.'], launch_count_claims: ['Launch-count claims are source_required.'], risk_notes: ['Route labels can create origin confusion without exact contract evidence.'], surface_risks: ['rival_surface_rotation', 'source_required'], infopunks_note: 'A route label never establishes canonical launch origin.' }),
    surface({ surface_id: 'unknown_manual', name: 'unknown/manual', status: 'unknown', status_confidence: 'low', source_notes: ['No attributable launch surface has been supplied.'], known_tokens: [], notable_claims: ['All origin, fee, and activity claims remain source_required.'], fee_claims: ['Fee terms are source_required.'], launch_count_claims: ['Launch-count claims are source_required.'], risk_notes: ['Unknown origin is a review state, not a neutral signal.'], surface_risks: ['source_required'], infopunks_note: 'Do not upgrade an unknown origin from silence.' })
  ];
  const claim = (claim_id: string, claim_type: RhChainLaunchpadClaim['claim_type'], surface_id: RhChainLaunchpadClaim['surface_id'], text: string): RhChainLaunchpadClaim => ({ claim_id, claim_type, surface_id, claim: text, status: 'source_required', source_notes: 'Manual registry context only; primary, timestamped evidence and human review are required before promotion.', last_observed_at: OBSERVED_AT });
  return {
    title: 'RH Chain Launchpad Observatory', subtitle: 'Where tokens start. Where claims break. Where receipts matter.', generated_at: OBSERVED_AT, data_mode: 'manual', doctrine: DOCTRINE,
    source_policy: 'Surface status and claims are manual, source-dependent intelligence. Human-reviewed receipts outrank external or live context. No token, launchpad, or route is endorsed or treated as verified.',
    disclaimer: 'This is a read-only launch-origin intelligence surface, not a launch, trading, or safety service. Reported disruption, fee, activity, and rival-share claims remain unverified unless a human-reviewed receipt says otherwise.',
    surfaces,
    claim_ledger: [
      claim('noxa-outage', 'outage_claim', 'noxa_fun', 'Reported NOXA disruption and launch restrictions during the post-NOXA stress window.'),
      claim('noxa-launch-count', 'launch_count', 'noxa_fun', 'Reported launch continuity or launch-count changes around the disruption.'),
      claim('bankr-fees', 'fee_claim', 'bankr', 'Reported creator-fee or launch-fee terms.'),
      claim('fragmentation-share', 'rival_share_claim', 'flap_sh', 'Reported rival-surface share or rotation after NOXA stress.'),
      claim('uniswap-origin', 'notable_token_claim', 'uniswap_direct_launches', 'Reported token origin through a direct Uniswap pool.'),
      claim('unknown-origin', 'notable_token_claim', 'unknown_manual', 'Reported token origin without a canonical launch-surface receipt.')
    ],
    post_noxa_stress_map: [
      { title: 'First stress test', explanation: 'NOXA was the first launchpad stress test represented in RH Chain memory. The recorded disruption is reported context, not an intent or safety finding.' },
      { title: 'Routes moved around the interface', explanation: 'Liquidity and launch activity were reported to route around the disruption. Exact routes, counts, and volumes remain source_required.' },
      { title: 'Fragmentation raises the memory requirement', explanation: 'More launch surfaces mean more opportunities for origin confusion, duplicate claims, and stale screenshots. Exact contracts, sources, and reviewed receipts matter more.' }
    ],
    risk_notes: [
      { title: 'Fake relaunches', explanation: 'A relaunch claim needs a canonical contract, source timestamp, and reviewed link before it becomes desk memory.' },
      { title: 'Clone floods', explanation: 'Similar names, branding, or interfaces are verification prompts, not proof of misconduct.' },
      { title: 'Vampire / copycat launches', explanation: 'Origin and migration claims need direct evidence; competition alone does not establish copying.' },
      { title: 'Front-end dependency', explanation: 'An interface can fail, migrate, or change while token-origin claims remain unresolved.' },
      { title: 'Low-quality direct Uniswap launches', explanation: 'A direct pool does not establish reliable liquidity, canonical identity, or safety.' }
    ]
  };
}
