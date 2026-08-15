import type { Rh4663ResolutionService } from '../services/rh4663ResolutionService';
import type { Published4663Signal } from '../services/rh4663IntelligenceService';

export type Rh4663ShareObject = Awaited<ReturnType<Rh4663ResolutionService['share']>>;
export type Rh4663WindowShareObject = Awaited<ReturnType<Rh4663ResolutionService['windowShare']>>;
export type Rh4663UniversalShareObject = Rh4663ShareObject | Rh4663WindowShareObject | Published4663Signal;
export type Rh4663ShareFormat = 'landscape' | 'square' | 'portrait';

const dimensions: Record<Rh4663ShareFormat, { width: number; height: number }> = {
  landscape: { width: 1200, height: 630 }, square: { width: 1080, height: 1080 }, portrait: { width: 1080, height: 1350 }
};

export function parseRh4663ShareFormat(value: unknown): Rh4663ShareFormat { return value === 'square' || value === 'portrait' ? value : 'landscape'; }

export function renderRh4663ShareSvg(share: Rh4663UniversalShareObject, format: Rh4663ShareFormat = 'landscape') {
  if ('signal_id' in share) return renderSignalShareSvg(share, format);
  if (!('call' in share)) return renderWindowShareSvg(share, format);
  const { width, height } = dimensions[format]; const resolved = share.resolution; const correct = resolved?.outcome === 'CORRECT';
  const title = resolved ? (correct ? 'CALLED IT.' : 'CALL RESOLVED.') : 'MY CALL';
  const result = resolved ? (correct ? 'CORRECT ✓' : 'MISSED') : 'PENDING';
  const actual = resolved && !correct ? `<text x="72" y="${height - 260}" class="meta">ACTUAL</text><text x="72" y="${height - 205}" class="actual">${xml(label(resolved.resolved_category))}</text>` : '';
  const genesis = share.genesis_position ? `GENESIS // ${String(share.genesis_position).padStart(4, '0')}` : `${share.record.correct} / ${share.record.resolved} RECORD`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(`Pulse 4663 ${title}`)}">
  <style>@font-face{font-family:IBM;src:local('IBM Plex Mono')}text{font-family:IBM,monospace;fill:#f2f5f0}.micro{font-size:22px;letter-spacing:3px;fill:#74ff9b}.title{font-size:${format === 'landscape' ? 74 : 82}px;font-weight:700;letter-spacing:-3px}.rotation{font-size:${format === 'landscape' ? 58 : 70}px;font-weight:700}.meta{font-size:20px;letter-spacing:3px;fill:#919991}.number{font-size:44px;font-weight:700}.actual{font-size:38px;font-weight:700}.result{font-size:34px;font-weight:700;fill:${correct || !resolved ? '#74ff9b' : '#f2f5f0'}.footer{font-size:20px;letter-spacing:2px;fill:#919991}</style>
  <rect width="100%" height="100%" fill="#050605"/><path d="M0 0H${Math.round(width * .012)}V${height}H0Z" fill="#74ff9b"/>
  <text x="72" y="72" class="micro">PULSE // 4663</text><text x="${width - 72}" y="72" class="footer" text-anchor="end">${xml(share.call.window_id.replace('rh4663:', 'UTC / '))}</text>
  <text x="72" y="${format === 'landscape' ? 185 : 245}" class="title">${xml(title)}</text>
  <text x="72" y="${format === 'landscape' ? 285 : 365}" class="rotation">${xml(label(share.call.rotation))}</text>
  <text x="72" y="${format === 'landscape' ? 360 : 455}" class="meta">CONFIDENCE</text><text x="72" y="${format === 'landscape' ? 415 : 520}" class="number">${share.call.confidence}</text>
  ${actual}<text x="${width - 72}" y="${height - 205}" class="meta" text-anchor="end">RESULT</text><text x="${width - 72}" y="${height - 150}" class="result" text-anchor="end">${xml(result)}</text>
  <line x1="72" y1="${height - 105}" x2="${width - 72}" y2="${height - 105}" stroke="#282d29"/><text x="72" y="${height - 54}" class="footer">${xml(genesis)}</text><text x="${width - 72}" y="${height - 54}" class="footer" text-anchor="end">${xml(share.call.receipt_id)}</text>
  </svg>`;
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
