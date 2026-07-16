import { getRhChainDailyReceipts, type RhChainDailyReceipt, type RhChainReceiptRelayPacket, type RhChainReceiptRelayPayload } from '../data/rhChain';
import { assembleRhChainCloneRadar } from './rhChainCloneRadarService';
import { assembleRhChainLaunchpadObservatory } from './rhChainLaunchpadObservatoryService';
import { assembleRhChainMemePulseScreen } from './rhChainMemePulseService';
import { queryRhChainScout } from './rhChainScoutService';

const BASE = '/rh-chain-signal-desk';
const DOCTRINE = 'External data gives context. Infopunks gives judgment. Receipts create memory.' as const;
const RISK_DISCLAIMER = 'Public intelligence only. Context can be incomplete or stale; this is not endorsement, a safety determination, or financial advice.';
const NO_RAID_NOTICE = 'No coordinated amplification, harassment, or token promotion.';

type RelayArtifact = Omit<RhChainReceiptRelayPacket, 'packet_id' | 'surface'>;

function variants(artifact: RelayArtifact): RhChainReceiptRelayPacket[] {
  return (['x', 'telegram', 'discord'] as const).map((surface) => ({
    ...artifact,
    packet_id: `${artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${surface}`,
    surface
  }));
}

/** Exports reviewed desk memory in copy-ready forms. It does not send, schedule, target, or coordinate messages. */
export function assembleRhChainReceiptRelay(latestReceipt?: RhChainDailyReceipt): RhChainReceiptRelayPayload {
  const receipts = latestReceipt ? { ...getRhChainDailyReceipts(), latest_receipt: latestReceipt } : getRhChainDailyReceipts();
  const latest = receipts.latest_receipt;
  const meme = assembleRhChainMemePulseScreen();
  const observatory = assembleRhChainLaunchpadObservatory();
  const radar = assembleRhChainCloneRadar();
  const scout = queryRhChainScout({ query: 'What does the desk remember about launchpad fragmentation?', mode: 'launch_context' });
  const generated_at = latest.generated_at;
  const dailyNumber = latest.receipt_id.match(/rh_daily_0*(\d+)/)?.[1];
  const dailyTitle = dailyNumber ? `Daily Receipt #${dailyNumber.padStart(3, '0')}` : 'Daily Receipt latest';
  const artifacts: RelayArtifact[] = [
    { title: dailyTitle, short_copy: latest.headline, long_copy: `${latest.headline}\n\n${latest.infopunks_verdict}\n\nCaveat: fee, revenue, burn, buyback, uptime, dominance, and rival-surface claims remain source_required unless primary or on-chain evidence exists. Context only; read the reviewed receipt before repeating the claim.`, source_url: `/v1/rh-chain/daily-receipts/${encodeURIComponent(latest.receipt_id)}`, artifact_url: `${BASE}/daily-receipts/${encodeURIComponent(latest.receipt_id)}`, risk_disclaimer: RISK_DISCLAIMER, no_raid_notice: NO_RAID_NOTICE, generated_at, data_mode: 'manual' },
    { title: 'Meme Pulse', short_copy: meme.subtitle, long_copy: `${meme.snapshot.strongest_narrative_mutation}\n\nMeme Pulse is attention context. Receipts remain the judgment layer.`, source_url: '/v1/rh-chain/meme-pulse', artifact_url: `${BASE}/meme-pulse`, risk_disclaimer: RISK_DISCLAIMER, no_raid_notice: NO_RAID_NOTICE, generated_at: meme.generated_at, data_mode: 'manual' },
    { title: 'Launchpad Observatory', short_copy: observatory.subtitle, long_copy: `Post-NOXA surface memory: ${observatory.post_noxa_stress_map[2].explanation}\n\nStatus and claim context remain source-required until receipted.`, source_url: '/v1/rh-chain/launchpad-observatory', artifact_url: `${BASE}/launchpad-observatory`, risk_disclaimer: RISK_DISCLAIMER, no_raid_notice: NO_RAID_NOTICE, generated_at: observatory.generated_at, data_mode: 'manual' },
    { title: 'Clone Radar', short_copy: 'Suspected patterns. Receipts required.', long_copy: `Clone Radar holds suspected and unverified patterns for review. ${radar.vampire_copycat_watch.length ? 'A visible pattern is a review cue, not a verdict.' : 'No pattern is promoted from absence.'}\n\nVerify exact identity and source receipts.`, source_url: '/v1/rh-chain/clone-radar', artifact_url: `${BASE}/risk-patterns`, risk_disclaimer: RISK_DISCLAIMER, no_raid_notice: NO_RAID_NOTICE, generated_at: radar.generated_at, data_mode: 'manual' },
    { title: 'Token Dossier source-required state', short_copy: 'A ticker is not an identity.', long_copy: 'Token Dossier remains source-required until an exact contract and reviewable receipts are attached. Absence of a record is not a positive signal.', source_url: '/v1/rh-chain/tokens/source-required/dossier', artifact_url: `${BASE}/tokens/source-required`, risk_disclaimer: RISK_DISCLAIMER, no_raid_notice: NO_RAID_NOTICE, generated_at, data_mode: 'manual' },
    { title: 'Scout Agent answer excerpt', short_copy: 'Scout reads desk memory; it does not create truth.', long_copy: `${scout.answer}\n\nScout excerpt only. Read the linked desk record for sources and limitations.`, source_url: '/v1/rh-chain/launch-surfaces', artifact_url: `${BASE}/scout`, risk_disclaimer: RISK_DISCLAIMER, no_raid_notice: NO_RAID_NOTICE, generated_at: scout.generated_at, data_mode: scout.data_mode }
  ];
  return { title: 'RH Chain Receipt Relay', subtitle: 'Bot-friendly receipt memory. Caveat attached.', generated_at, data_mode: 'manual', doctrine: DOCTRINE, disclaimer: 'Receipt Relay exports public memory only. It does not send messages, coordinate groups, recommend tokens, or override human-reviewed receipts.', packets: artifacts.flatMap(variants) };
}
