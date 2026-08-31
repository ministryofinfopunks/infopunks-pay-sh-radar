import type { Rh4663ResolutionService } from '../services/rh4663ResolutionService';
import type { Published4663Signal } from '../services/rh4663IntelligenceService';
import type { Rh4663Print } from '../services/rh4663PrintService';

export type Rh4663ShareObject = Awaited<ReturnType<Rh4663ResolutionService['share']>>;
export type Rh4663WindowShareObject = Awaited<ReturnType<Rh4663ResolutionService['windowShare']>>;
export type Rh4663UniversalShareObject = Rh4663ShareObject | Rh4663WindowShareObject | Published4663Signal | Rh4663Print;
export type Rh4663ShareFormat = 'landscape' | 'square' | 'portrait';

const dimensions: Record<Rh4663ShareFormat, { width: number; height: number }> = {
  landscape: { width: 1200, height: 630 }, square: { width: 1080, height: 1080 }, portrait: { width: 1080, height: 1350 }
};

export function parseRh4663ShareFormat(value: unknown): Rh4663ShareFormat { return value === 'square' || value === 'portrait' ? value : 'landscape'; }

export function renderRh4663ShareSvg(share: Rh4663UniversalShareObject, format: Rh4663ShareFormat = 'landscape') {
  if ('receipt_kind' in share && share.receipt_kind === 'MARKET_STATE_EVIDENCE') return renderPrintShareSvg(share, format);
  if ('signal_id' in share) return renderSignalShareSvg(share, format);
  if (!('call' in share)) return renderWindowShareSvg(share, format);
  const callShare = share as Rh4663ShareObject;
  const { width, height } = dimensions[format]; const resolved = callShare.resolution; const correct = resolved?.outcome === 'CORRECT';
  const title = resolved ? (correct ? 'CALLED IT.' : 'CALL RESOLVED.') : 'MY CALL';
  const result = resolved ? (correct ? 'CORRECT ✓' : 'MISSED') : 'PENDING';
  const actual = resolved && !correct ? `<text x="72" y="${height - 260}" class="meta">ACTUAL</text><text x="72" y="${height - 205}" class="actual">${xml(label(resolved.resolved_category))}</text>` : '';
  const genesis = callShare.genesis_position ? `GENESIS // ${String(callShare.genesis_position).padStart(4, '0')}` : `${callShare.record.correct} / ${callShare.record.resolved} RECORD`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(`Pulse 4663 ${title}`)}">
  <style>@font-face{font-family:IBM;src:local('IBM Plex Mono')}text{font-family:IBM,monospace;fill:#f2f5f0}.micro{font-size:22px;letter-spacing:3px;fill:#74ff9b}.title{font-size:${format === 'landscape' ? 74 : 82}px;font-weight:700;letter-spacing:-3px}.rotation{font-size:${format === 'landscape' ? 58 : 70}px;font-weight:700}.meta{font-size:20px;letter-spacing:3px;fill:#919991}.number{font-size:44px;font-weight:700}.actual{font-size:38px;font-weight:700}.result{font-size:34px;font-weight:700;fill:${correct || !resolved ? '#74ff9b' : '#f2f5f0'}.footer{font-size:20px;letter-spacing:2px;fill:#919991}</style>
  <rect width="100%" height="100%" fill="#050605"/><path d="M0 0H${Math.round(width * .012)}V${height}H0Z" fill="#74ff9b"/>
  <text x="72" y="72" class="micro">PULSE // 4663</text><text x="${width - 72}" y="72" class="footer" text-anchor="end">${xml(callShare.call.window_id.replace('rh4663:', 'UTC / '))}</text>
  <text x="72" y="${format === 'landscape' ? 185 : 245}" class="title">${xml(title)}</text>
  <text x="72" y="${format === 'landscape' ? 285 : 365}" class="rotation">${xml(label(callShare.call.rotation))}</text>
  <text x="72" y="${format === 'landscape' ? 360 : 455}" class="meta">CONFIDENCE</text><text x="72" y="${format === 'landscape' ? 415 : 520}" class="number">${callShare.call.confidence}</text>
  ${actual}<text x="${width - 72}" y="${height - 205}" class="meta" text-anchor="end">RESULT</text><text x="${width - 72}" y="${height - 150}" class="result" text-anchor="end">${xml(result)}</text>
  <line x1="72" y1="${height - 105}" x2="${width - 72}" y2="${height - 105}" stroke="#282d29"/><text x="72" y="${height - 54}" class="footer">${xml(genesis)}</text><text x="${width - 72}" y="${height - 54}" class="footer" text-anchor="end">${xml(callShare.call.receipt_id)}</text>
  </svg>`;
}

function renderPrintShareSvg(print: Rh4663Print, format: Rh4663ShareFormat) {
  if (!print.campaign_snapshot) return renderFrozenPrintShareSvg(print, format);
  const { width, height } = dimensions[format]; const pons = print.metrics.find((metric) => metric.id === 'pons_volume'); const dex = print.metrics.find((metric) => metric.id === 'utc_dex_volume'); const transactions = print.metrics.find((metric) => metric.id === 'transactions');
  const titleSize = format === 'landscape' ? 62 : 78; const left = 72;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml('4663 PRINT Robinhood Chain is running hot')}">
  <style>@font-face{font-family:IBM;src:local('IBM Plex Mono')}text{font-family:IBM,monospace;fill:#f2f5f0}.micro{font-size:22px;letter-spacing:3px;fill:#74ff9b}.title{font-size:${titleSize}px;font-weight:700;letter-spacing:-3px}.metric{font-size:${format === 'landscape' ? 56 : 70}px;font-weight:700}.meta{font-size:20px;letter-spacing:2px;fill:#919991}.strong{font-size:${format === 'landscape' ? 38 : 48}px;font-weight:700;fill:#74ff9b}.footer{font-size:18px;letter-spacing:2px;fill:#919991}</style>
  <rect width="100%" height="100%" fill="#050605"/><path d="M0 0H${Math.round(width * .012)}V${height}H0Z" fill="#74ff9b"/>
  <text x="${left}" y="72" class="micro">//4663 PRINT · AUG 30</text><text x="${width - left}" y="72" class="footer" text-anchor="end">CAMPAIGN SNAPSHOT</text>
  <text x="${left}" y="${format === 'landscape' ? 170 : 220}" class="title">ROBINHOOD CHAIN</text><text x="${left}" y="${format === 'landscape' ? 240 : 305}" class="title">IS RUNNING HOT</text>
  <text x="${left}" y="${format === 'landscape' ? 320 : 400}" class="metric">${xml(transactions?.value ?? '5.52M')}</text><text x="${left}" y="${format === 'landscape' ? 350 : 435}" class="meta">TRANSACTIONS / ATH</text>
  <text x="${format === 'landscape' ? Math.round(width * .52) : left}" y="${format === 'landscape' ? 320 : 545}" class="metric">${xml(dex?.value ?? '$874.8M')}</text><text x="${format === 'landscape' ? Math.round(width * .52) : left}" y="${format === 'landscape' ? 350 : 580}" class="meta">AUG 30 UTC DEX VOLUME</text>
  <rect x="${left}" y="${height - (format === 'landscape' ? 170 : 290)}" width="${width - left * 2}" height="${format === 'landscape' ? 82 : 150}" fill="#0b150e"/><text x="${left + 24}" y="${height - (format === 'landscape' ? 118 : 220)}" class="strong">PONS ≈ 51%</text><text x="${left + 24}" y="${height - (format === 'landscape' ? 85 : 180)}" class="meta">${xml(`${pons?.value ?? '$445.98M'} OF ${dex?.value ?? '$874.8M'} · SELECTED UTC WINDOW`)}</text>
  <text x="${left}" y="${height - 38}" class="footer">THE INTERNET STARTED TRADING ATTENTION.</text><text x="${width - left}" y="${height - 38}" class="footer" text-anchor="end">INFOPUNKS //4663</text>
  </svg>`;
}

function renderFrozenPrintShareSvg(print: Rh4663Print, format: Rh4663ShareFormat) {
  const { width, height } = dimensions[format]; const left = 72; const primary = print.metrics[0]; const secondary = print.metrics[1]; const date = print.canonical_path.split('/').at(-1) ?? 'FROZEN';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(`4663 PRINT ${print.title}`)}">
  <style>@font-face{font-family:IBM;src:local('IBM Plex Mono')}text{font-family:IBM,monospace;fill:#f2f5f0}.micro{font-size:22px;letter-spacing:3px;fill:#74ff9b}.title{font-size:${format === 'landscape' ? 58 : 72}px;font-weight:700;letter-spacing:-3px}.metric{font-size:${format === 'landscape' ? 54 : 66}px;font-weight:700}.meta{font-size:19px;letter-spacing:2px;fill:#919991}.footer{font-size:18px;letter-spacing:2px;fill:#919991}</style>
  <rect width="100%" height="100%" fill="#050605"/><path d="M0 0H${Math.round(width * .012)}V${height}H0Z" fill="#74ff9b"/>
  <text x="${left}" y="72" class="micro">//4663 PRINT · ${xml(date)}</text><text x="${width - left}" y="72" class="footer" text-anchor="end">FROZEN MARKET MEMORY</text>
  <text x="${left}" y="${format === 'landscape' ? 170 : 220}" class="title">${xml(compact(print.title, format === 'landscape' ? 31 : 25))}</text><text x="${left}" y="${format === 'landscape' ? 220 : 295}" class="meta">${xml(print.regime)}</text>
  <text x="${left}" y="${format === 'landscape' ? 335 : 430}" class="metric">${xml(primary?.value ?? '—')}</text><text x="${left}" y="${format === 'landscape' ? 370 : 465}" class="meta">${xml(primary?.label ?? 'SOURCE REQUIRED')}</text>
  <text x="${format === 'landscape' ? Math.round(width * .55) : left}" y="${format === 'landscape' ? 335 : 565}" class="metric">${xml(secondary?.value ?? '—')}</text><text x="${format === 'landscape' ? Math.round(width * .55) : left}" y="${format === 'landscape' ? 370 : 600}" class="meta">${xml(secondary?.label ?? 'SOURCE REQUIRED')}</text>
  <line x1="${left}" y1="${height - 95}" x2="${width - left}" y2="${height - 95}" stroke="#282d29"/><text x="${left}" y="${height - 42}" class="footer">LIVE DATA CHANGES. MARKET MEMORY DOES NOT.</text><text x="${width - left}" y="${height - 42}" class="footer" text-anchor="end">INFOPUNKS //4663</text></svg>`;
}

function renderSignalShareSvg(signal: Published4663Signal, format: Rh4663ShareFormat) {
  const { width, height } = dimensions[format]; const subject = signal.subjects[0]?.label ?? signal.subjects[0]?.subject_id ?? signal.category; const headline = compact(signal.headline, format === 'landscape' ? 34 : 28); const subjectLabel = compact(String(subject).toUpperCase(), format === 'landscape' ? 38 : 28);
  const evidenceLabel = `${signal.source_count} SOURCE${signal.source_count === 1 ? '' : 'S'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(`Signal 4663 ${signal.headline}`)}">
  <style>@font-face{font-family:IBM;src:local('IBM Plex Mono')}text{font-family:IBM,monospace;fill:#f2f5f0}.micro{font-size:22px;letter-spacing:3px;fill:#74ff9b}.title{font-size:${format === 'landscape' ? 64 : 74}px;font-weight:700;letter-spacing:-3px}.subject{font-size:${format === 'landscape' ? 38 : 48}px;font-weight:700}.meta{font-size:20px;letter-spacing:3px;fill:#919991}.number{font-size:58px;font-weight:700}.footer{font-size:20px;letter-spacing:2px;fill:#919991}</style>
  <rect width="100%" height="100%" fill="#050605"/><path d="M0 0H${Math.round(width * .012)}V${height}H0Z" fill="#74ff9b"/>
  <text x="72" y="72" class="micro">SIGNAL // 4663</text><text x="${width - 72}" y="72" class="footer" text-anchor="end">${xml(signal.signal_id)}</text>
  <text x="72" y="${format === 'landscape' ? 180 : 240}" class="title">${xml(headline)}</text><text x="72" y="${format === 'landscape' ? 250 : 330}" class="subject">${xml(subjectLabel)}</text>
  <text x="72" y="${format === 'landscape' ? 345 : 455}" class="meta">SIGNIFICANCE</text><text x="72" y="${format === 'landscape' ? 410 : 530}" class="number">${signal.significance_score}</text>
  <text x="${width - 72}" y="${format === 'landscape' ? 345 : 455}" class="meta" text-anchor="end">ANOMALY</text><text x="${width - 72}" y="${format === 'landscape' ? 410 : 530}" class="number" text-anchor="end">${signal.anomaly_score}</text>
  <line x1="72" y1="${height - 105}" x2="${width - 72}" y2="${height - 105}" stroke="#282d29"/><text x="72" y="${height - 54}" class="footer">${xml(signal.category.replaceAll('_', ' '))} / ${xml(evidenceLabel)}</text><text x="${width - 72}" y="${height - 54}" class="footer" text-anchor="end">//4663</text></svg>`;
}

function renderWindowShareSvg(share: Rh4663WindowShareObject, format: Rh4663ShareFormat) {
  const { width, height } = dimensions[format]; const resolved = share.object_type === 'window_result'; const result = share.consensus_correct === null ? 'FORMING' : share.consensus_correct ? 'CONSENSUS ✓' : 'CONSENSUS MISSED';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Pulse 4663 window ${xml(share.window_id)}">
  <style>@font-face{font-family:IBM;src:local('IBM Plex Mono')}text{font-family:IBM,monospace;fill:#f2f5f0}.micro{font-size:22px;letter-spacing:3px;fill:#74ff9b}.title{font-size:${format === 'landscape' ? 72 : 82}px;font-weight:700;letter-spacing:-3px}.rotation{font-size:${format === 'landscape' ? 56 : 68}px;font-weight:700}.meta{font-size:20px;letter-spacing:3px;fill:#919991}.number{font-size:42px;font-weight:700}.result{font-size:30px;font-weight:700;fill:#74ff9b}.footer{font-size:20px;letter-spacing:2px;fill:#919991}</style>
  <rect width="100%" height="100%" fill="#050605"/><path d="M0 0H${Math.round(width * .012)}V${height}H0Z" fill="#74ff9b"/><text x="72" y="72" class="micro">PULSE // 4663</text><text x="${width - 72}" y="72" class="footer" text-anchor="end">${xml(share.window_id)}</text>
  <text x="72" y="${format === 'landscape' ? 185 : 250}" class="title">${resolved ? 'WINDOW RESOLVED' : 'WINDOW CONSENSUS'}</text><text x="72" y="${format === 'landscape' ? 285 : 370}" class="rotation">${xml(label(share.primary_category ?? 'NO CALLS YET'))}</text>
  <text x="72" y="${format === 'landscape' ? 365 : 470}" class="meta">${share.total_calls} CALLS</text><text x="${width - 72}" y="${format === 'landscape' ? 365 : 470}" class="number" text-anchor="end">${share.consensus_percentage}%</text>
  ${resolved ? `<text x="72" y="${height - 170}" class="meta">ACTUAL</text><text x="72" y="${height - 115}" class="number">${xml(label(share.resolved_category ?? 'NO QUALIFIED ROTATION'))}</text>` : ''}<text x="${width - 72}" y="${height - 115}" class="result" text-anchor="end">${xml(result)}</text>
  <line x1="72" y1="${height - 80}" x2="${width - 72}" y2="${height - 80}" stroke="#282d29"/><text x="72" y="${height - 35}" class="footer">CONSENSUS ≠ RESOLUTION</text><text x="${width - 72}" y="${height - 35}" class="footer" text-anchor="end">//4663</text></svg>`;
}

function label(value: string) { return value.replaceAll('_', ' '); }
function compact(value: string, limit: number) { return value.length <= limit ? value : `${value.slice(0, Math.max(1, limit - 1)).trim()}…`; }
function xml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }
