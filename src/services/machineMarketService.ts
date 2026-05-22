export type MachineMarketCategory = 'compute' | 'inference' | 'web' | 'vision' | 'storage' | 'translation';
export type MachineMarketType = 'digital' | 'physical' | 'all-compatible';
export type MachineMarketSource = 'robotic.sh' | 'pay.sh' | 'agentic.market';
export type MachineMarketChain = 'solana' | 'base' | 'peaq' | 'omnichain';
export type MachineMarketStatus = 'ready' | 'setup';
export type MachineMarketEvidenceHealth = 'scaffold' | 'listed';
export type MachineMarketEvidenceStage =
  | 'listed'
  | 'classified'
  | 'policy-mapped'
  | 'preflight-ready'
  | 'execution-tested'
  | 'receipt-recorded'
  | 'benchmark-recorded';

export const MACHINE_MARKET_PHASE_SCOPE = 'phase_2_pay_sh_robotic_sh';
export const MACHINE_MARKET_OBSERVED_AT = '2026-05-22T00:00:00.000Z';

export type MachineMarketService = {
  id: string;
  name: string;
  provider: string;
  category: MachineMarketCategory;
  market_type: MachineMarketType;
  source_market: MachineMarketSource;
  chain: MachineMarketChain;
  status: MachineMarketStatus;
  price_display: string;
  description: string;
  machine_use_case: string;
  evidence_health: MachineMarketEvidenceHealth;
  evidence_stage: MachineMarketEvidenceStage;
  policy_risk: string;
  caveats: string[];
  observed_source: 'robotic.sh';
  observed_at: string;
  phase_scope: typeof MACHINE_MARKET_PHASE_SCOPE;
};

export type MachineMarketSummary = {
  total_services: number;
  categories: Record<MachineMarketCategory, number>;
  source_markets: Record<MachineMarketSource, number>;
  chains: Partial<Record<MachineMarketChain, number>>;
  ready_count: number;
  setup_count: number;
  evidence_stage_counts: Partial<Record<MachineMarketEvidenceStage, number>>;
  phase_scope: typeof MACHINE_MARKET_PHASE_SCOPE;
  positioning: {
    module: string;
    terminal: string;
    market_policy: string;
    spend_policy: string;
    radar_role: string;
  };
};

type ServiceInput = Omit<MachineMarketService, 'observed_source' | 'observed_at' | 'phase_scope' | 'evidence_health' | 'evidence_stage'>;

const defaultCaveats = [
  'Static robotic.sh service mirror for Phase 2 only.',
  'No paid execution, receipt, or benchmark evidence is recorded in this registry.'
];

const services: MachineMarketService[] = [
  service({
    id: 'qvac',
    name: 'QVAC',
    provider: 'Tether',
    category: 'compute',
    market_type: 'all-compatible',
    source_market: 'robotic.sh',
    chain: 'peaq',
    status: 'setup',
    price_display: '$0.01 / sec',
    description: 'Verifiable agent compute with on-chain attestation for autonomous machines.',
    machine_use_case: 'Autonomous robots and agents can request attestable compute before committing machine spend.',
    policy_risk: 'Requires setup and attestation review before any autonomous machine can treat compute output as spend-authorizing evidence.',
    caveats: ['Setup status only; execution readiness is not proven.', ...defaultCaveats]
  }),
  service({
    id: 'generative-language',
    name: 'Generative Language',
    provider: 'Google',
    category: 'inference',
    market_type: 'digital',
    source_market: 'pay.sh',
    chain: 'solana',
    status: 'ready',
    price_display: 'Per endpoint',
    description: 'Gemini text and multimodal generation via pay.sh.',
    machine_use_case: 'Machines can generate plans, summaries, and multimodal interpretations with preflight spend policy.',
    policy_risk: 'Inference output can steer action; require prompt, cost, and output-retention policy before spend.',
    caveats: defaultCaveats
  }),
  service({
    id: 'bigquery',
    name: 'BigQuery',
    provider: 'Google',
    category: 'web',
    market_type: 'digital',
    source_market: 'pay.sh',
    chain: 'solana',
    status: 'ready',
    price_display: '$0.001',
    description: 'Serverless data warehouse queries via pay.sh.',
    machine_use_case: 'Autonomous systems can query operational datasets before routing or purchasing decisions.',
    policy_risk: 'Queries may leak sensitive business context or incur repeated spend without query budget limits.',
    caveats: defaultCaveats
  }),
  service({
    id: 'document-ai',
    name: 'Document AI',
    provider: 'Google',
    category: 'vision',
    market_type: 'digital',
    source_market: 'pay.sh',
    chain: 'solana',
    status: 'ready',
    price_display: 'Per endpoint',
    description: 'Parse manifests, invoices, and IDs into structured fields.',
    machine_use_case: 'Machines can turn documents into structured evidence for logistics, billing, and identity workflows.',
    policy_risk: 'Documents can contain private or regulated data; require data handling policy and receipt traceability.',
    caveats: defaultCaveats
  }),
  service({
    id: 'stableupload',
    name: 'Stableupload',
    provider: 'Stableupload',
    category: 'storage',
    market_type: 'digital',
    source_market: 'pay.sh',
    chain: 'solana',
    status: 'ready',
    price_display: '$0.02',
    description: 'Pay-per-upload media hosting via pay.sh.',
    machine_use_case: 'Robots and agents can store images, logs, manifests, and task artifacts with cost controls.',
    policy_risk: 'Uploads can persist sensitive evidence; require retention, access, and payload-size policy.',
    caveats: defaultCaveats
  }),
  service({
    id: 'cloud-translation',
    name: 'Cloud Translation',
    provider: 'Google',
    category: 'translation',
    market_type: 'digital',
    source_market: 'pay.sh',
    chain: 'solana',
    status: 'ready',
    price_display: 'Per endpoint',
    description: '130+ language neural translation via pay.sh.',
    machine_use_case: 'Machines can translate instructions, labels, support messages, and field reports across languages.',
    policy_risk: 'Translation can alter operational meaning; require confidence checks for safety-critical instructions.',
    caveats: defaultCaveats
  }),
  service({
    id: 'claude',
    name: 'Claude',
    provider: 'Anthropic',
    category: 'inference',
    market_type: 'digital',
    source_market: 'agentic.market',
    chain: 'base',
    status: 'ready',
    price_display: '$0.001',
    description: 'Frontier reasoning and planning via agentic.market on Base.',
    machine_use_case: 'Machines can request reasoning, decomposition, and planning support with source metadata preserved.',
    policy_risk: 'Planning output may trigger downstream spend; require approval thresholds and evidence citations.',
    caveats: ['Included as robotic.sh source metadata; outside Phase 2 execution focus.', ...defaultCaveats]
  }),
  service({
    id: 'chatgpt',
    name: 'ChatGPT',
    provider: 'OpenAI',
    category: 'inference',
    market_type: 'digital',
    source_market: 'agentic.market',
    chain: 'base',
    status: 'ready',
    price_display: '$0.001',
    description: 'OpenAI GPT and o-series models via agentic.market on Base.',
    machine_use_case: 'Machines can call model reasoning and generation for task planning, inspection, and control support.',
    policy_risk: 'Model calls can influence autonomous action; require spend caps, prompt logs, and output review policy.',
    caveats: ['Included as robotic.sh source metadata; outside Phase 2 execution focus.', ...defaultCaveats]
  }),
  service({
    id: '2captcha',
    name: '2Captcha',
    provider: '2Captcha',
    category: 'web',
    market_type: 'digital',
    source_market: 'agentic.market',
    chain: 'base',
    status: 'ready',
    price_display: '$0.01',
    description: 'Captcha-solving API via agentic.market on Base.',
    machine_use_case: 'Machines can identify routes that claim captcha-solving capability for policy review.',
    policy_risk: 'Captcha solving can violate site terms or anti-abuse controls; default policy should block unless explicitly approved.',
    caveats: ['Included as robotic.sh source metadata; outside Phase 2 execution focus.', ...defaultCaveats]
  }),
  service({
    id: 'firecrawl',
    name: 'Firecrawl',
    provider: 'Firecrawl',
    category: 'web',
    market_type: 'digital',
    source_market: 'agentic.market',
    chain: 'base',
    status: 'ready',
    price_display: '$0.01',
    description: 'Scrape-to-LLM clean text via agentic.market on Base.',
    machine_use_case: 'Machines can convert web pages into clean text for route research and market monitoring.',
    policy_risk: 'Scraping can hit robots, rate, or content restrictions; require domain policy and provenance receipts.',
    caveats: ['Included as robotic.sh source metadata; outside Phase 2 execution focus.', ...defaultCaveats]
  }),
  service({
    id: 'wolfram-alpha',
    name: 'Wolfram Alpha',
    provider: 'Wolfram Research',
    category: 'inference',
    market_type: 'digital',
    source_market: 'agentic.market',
    chain: 'base',
    status: 'ready',
    price_display: '$0.01',
    description: 'Computational engine for math, physics, and geometry via agentic.market.',
    machine_use_case: 'Machines can request deterministic computational answers for planning, measurement, and checks.',
    policy_risk: 'Computed answers can drive physical-world choices; require input validation and result sanity checks.',
    caveats: ['Included as robotic.sh source metadata; outside Phase 2 execution focus.', ...defaultCaveats]
  }),
  service({
    id: 'exa',
    name: 'Exa',
    provider: 'Exa',
    category: 'web',
    market_type: 'digital',
    source_market: 'agentic.market',
    chain: 'base',
    status: 'ready',
    price_display: '$0.001',
    description: 'Semantic web search built for AI agents via agentic.market on Base.',
    machine_use_case: 'Machines can discover web evidence and candidate services before spend decisions.',
    policy_risk: 'Search results are not receipts; require source capture and freshness checks before autonomous spend.',
    caveats: ['Included as robotic.sh source metadata; outside Phase 2 execution focus.', ...defaultCaveats]
  })
];

export function listMachineMarketServices(): MachineMarketService[] {
  return services.map((item) => ({ ...item, caveats: [...item.caveats] }));
}

export function getMachineMarketServiceById(serviceId: string): MachineMarketService | null {
  const service = services.find((item) => item.id === serviceId);
  return service ? { ...service, caveats: [...service.caveats] } : null;
}

export function buildMachineMarketSummary(): MachineMarketSummary {
  const allServices = listMachineMarketServices();
  return {
    total_services: allServices.length,
    categories: countBy(allServices, 'category', ['compute', 'inference', 'web', 'vision', 'storage', 'translation']),
    source_markets: countBy(allServices, 'source_market', ['robotic.sh', 'pay.sh', 'agentic.market']),
    chains: countBy(allServices, 'chain', ['solana', 'base', 'peaq', 'omnichain']),
    ready_count: allServices.filter((item) => item.status === 'ready').length,
    setup_count: allServices.filter((item) => item.status === 'setup').length,
    evidence_stage_counts: countBy(allServices, 'evidence_stage', ['listed', 'classified', 'policy-mapped', 'preflight-ready', 'execution-tested', 'receipt-recorded', 'benchmark-recorded']),
    phase_scope: MACHINE_MARKET_PHASE_SCOPE,
    positioning: {
      module: 'A new Radar module for machine-economy intelligence.',
      terminal: 'Same terminal. New species of spender.',
      market_policy: 'robotic.sh gives machines a market. Infopunks gives machine spending policy, evidence, and receipts.',
      spend_policy: 'Machines should not spend blind.',
      radar_role: 'Radar is the intelligence layer for autonomous spend across agents and machines.'
    }
  };
}

function service(input: ServiceInput): MachineMarketService {
  return {
    ...input,
    evidence_health: 'scaffold',
    evidence_stage: 'policy-mapped',
    observed_source: 'robotic.sh',
    observed_at: MACHINE_MARKET_OBSERVED_AT,
    phase_scope: MACHINE_MARKET_PHASE_SCOPE
  };
}

function countBy<T, K extends keyof T, V extends Extract<T[K], string>>(
  items: T[],
  key: K,
  values: readonly V[]
): Record<V, number> {
  return values.reduce<Record<V, number>>((counts, value) => {
    counts[value] = items.filter((item) => item[key] === value).length;
    return counts;
  }, {} as Record<V, number>);
}
