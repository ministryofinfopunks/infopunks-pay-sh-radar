import { getRhChain100ReceiptsCampaign } from './rhChain100Receipts';
import type { RhChainLayerClassification, RhChainSecondaryLayer } from '../services/rhChainMarketStructureService';

/**
 * Manual-only reviewed layer registry. Entries cannot be created from a ticker,
 * a DEX Screener response, or a provider rank. Add an exact RH Chain contract
 * and source-linked review evidence before inserting a classification here.
 */
const campaignLayerMap = new Map<string, { primary_layer: RhChainLayerClassification['primary_layer']; secondary_layers: RhChainSecondaryLayer[]; confidence: RhChainLayerClassification['classification_confidence'] }>([
  ['0x020bfc650a365f8bb26819deaabf3e21291018b4', { primary_layer: 'meme', secondary_layers: ['distribution'], confidence: 'high' }],
  ['0x45242320dbb855eea8fd36804c6487e10e97fcf9', { primary_layer: 'meme', secondary_layers: ['trading_culture'], confidence: 'medium' }],
  ['0x39dbed3a2bd333467115de45665cc57f813c4571', { primary_layer: 'infrastructure', secondary_layers: ['launchpad', 'meme_distribution'], confidence: 'medium' }],
  ['0x8e62f281f282686fca6dcb39288069a93fc23f1c', { primary_layer: 'meme', secondary_layers: ['narrative_candidate'], confidence: 'medium' }],
  ['0xf2915d1e3c1b0c769d0c756ec43f1c1f6c99cd03', { primary_layer: 'defi', secondary_layers: ['utility_claim_under_review'], confidence: 'low' }]
]);

/** Exact-contract projection of reviewed 100 Receipts campaign memory; never ticker-derived. */
const campaignClassifications: RhChainLayerClassification[] = getRhChain100ReceiptsCampaign().assets.flatMap((asset) => {
  const layer = campaignLayerMap.get(asset.contract.toLowerCase());
  if (!layer) return [];
  return [{
    contract: asset.contract,
    ticker: asset.ticker,
    display_name: asset.ticker,
    dexscreener_pair: asset.dexscreener_pair,
    primary_layer: layer.primary_layer,
    secondary_layers: layer.secondary_layers,
    cross_layer_category: null,
    classification_reason: asset.classification_note,
    classification_source: 'manual_review',
    classification_confidence: layer.confidence,
    evidence_state: asset.evidence_state,
    missing_evidence: [...asset.missing_evidence],
    caveat: null,
    reviewed_at: asset.reviewed_at,
    observed_at: asset.reviewed_at,
    data_mode: 'manual'
  }];
});

/** Exact-contract reviewed-intake candidates. These are not approved signals and claim caveats remain attached. */
const reviewedIntakeClassifications: RhChainLayerClassification[] = [
  {
    contract: '0x56910D4409F3a0C78C64DD8D0545FF0705389870', ticker: 'INDEX', display_name: 'The Index', dexscreener_pair: 'https://dexscreener.com/robinhood/0x00dd2df2f17d431cf3a0938f06c9cf9abc5e9643b6cc466ca3f71f3af246edf3',
    primary_layer: 'rwa', secondary_layers: ['defi', 'speculative_distribution', 'tokenized_equities'], cross_layer_category: 'defi_x_rwa', classification_source: 'manual_review', classification_confidence: 'medium', evidence_state: 'under_receipt_check',
    classification_reason: 'Exact RH Chain contract and DexScreener pair are now provided. The token positions around Robinhood Chain tokenized-equity/dividend mechanics, making it an early RWA x DeFi x speculative-distribution candidate.',
    missing_evidence: ['protocol mechanics', 'dividend source', 'tokenized-stock integration proof', 'treasury flows', 'legal/economic structure', 'deployer trace'], caveat: 'Contract/pair visibility does not verify dividend mechanics or RWA backing.', reviewed_at: null, observed_at: '2026-07-17T00:00:00.000Z', data_mode: 'manual'
  },
  {
    contract: '0xcA0Da673A451C84917d7dd0362109eFFf0f8825A', ticker: 'eBESS', display_name: 'eBESS', dexscreener_pair: 'https://dexscreener.com/robinhood/0x94ec3574c384447519992cf1400e2183b85acede',
    primary_layer: 'rwa', secondary_layers: ['energy', 'real_world_asset_narrative'], cross_layer_category: null, classification_source: 'manual_review', classification_confidence: 'low', evidence_state: 'source_required_for_claims',
    classification_reason: 'Exact RH Chain contract and pair are provided, and the asset presents an energy/RWA narrative. Real asset linkage remains unverified.',
    missing_evidence: ['primary project source', 'asset-backing documentation', 'contract/deployer trace', 'treasury proof', 'legal/economic structure'], caveat: 'Energy or RWA narrative does not prove real-world asset backing.', reviewed_at: null, observed_at: '2026-07-17T00:00:00.000Z', data_mode: 'manual'
  },
  {
    contract: '0x4B518240a5E520fC08916f0335460E0dD4057417', ticker: 'ORACLE', display_name: 'Oracle', dexscreener_pair: 'https://dexscreener.com/robinhood/0xd078f97ad4bcbb3411254f3bb9f5092d73606ec8',
    primary_layer: 'infrastructure', secondary_layers: ['data', 'tokenized_attention'], cross_layer_category: null, classification_source: 'manual_review', classification_confidence: 'low', evidence_state: 'source_required_for_claims',
    classification_reason: 'Exact RH Chain contract and pair are provided, and the asset uses an infrastructure/data narrative. Operational oracle functionality remains unverified.',
    missing_evidence: ['primary project source', 'oracle mechanism proof', 'data feeds', 'integration proof', 'deployer trace'], caveat: 'The name Oracle does not verify oracle infrastructure.', reviewed_at: null, observed_at: '2026-07-17T00:00:00.000Z', data_mode: 'manual'
  },
  {
    contract: '0x0F2c5B7A7625C7b097759DD7165177d63fBB8b03', ticker: 'GROKIUS', display_name: 'GROKIUS', dexscreener_pair: 'https://dexscreener.com/robinhood/0x7ccef8a69c831c4ffde3eee77cb91f513f6ebf6e',
    primary_layer: 'meme', secondary_layers: ['ai_narrative'], cross_layer_category: 'meme_x_ai_narrative', classification_source: 'manual_review', classification_confidence: 'low', evidence_state: 'source_required_for_claims',
    classification_reason: 'Exact RH Chain contract and pair are provided. The token appears to use an AI/Grok-style meme wrapper, but no operational agent behavior is verified.',
    missing_evidence: ['primary project source', 'agent functionality proof', 'deployer trace', 'community/social source trail'], caveat: 'AI narrative does not prove agent activity.', reviewed_at: null, observed_at: '2026-07-17T00:00:00.000Z', data_mode: 'manual'
  }
];

export const rhChainReviewedLayerClassifications: readonly RhChainLayerClassification[] = [...campaignClassifications, ...reviewedIntakeClassifications];

/** These labels are deliberately not classified until their exact contracts are reviewed. */
export const rhChainPendingLayerEvidence = [
  { ticker: 'The Index', proposed_layers: ['rwa', 'defi', 'speculative_distribution'], state: 'source_required' },
  { ticker: 'eBESS', proposed_layers: [], state: 'source_required' },
  { ticker: 'Oracle', proposed_layers: [], state: 'source_required' },
  { ticker: 'GROKIUS', proposed_layers: [], state: 'source_required' },
  { ticker: 'Benjamin’s Bread', proposed_layers: [], state: 'source_required' }
] as const;
