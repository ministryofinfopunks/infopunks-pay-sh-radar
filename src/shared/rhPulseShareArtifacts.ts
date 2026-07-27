import { z } from 'zod';
import { RhPulseConfidenceSchema } from './rhPulse';
import {
  RH_PULSE_CALL_METHODOLOGY_VERSION,
  RH_PULSE_GENESIS_LIMIT,
  RhPulseCallOutcomeSchema
} from './rhPulseCalls';

export const RH_PULSE_SHARE_ARTIFACT_SCHEMA_VERSION = '1.0';
export const RH_PULSE_SHARE_RENDERER_VERSION = 'rh-pulse-share-v1.0';
export const RH_PULSE_SHARE_LANDSCAPE = { width: 1_200, height: 630 } as const;
export const RH_PULSE_SHARE_PORTRAIT = { width: 1_080, height: 1_350 } as const;

export const RhPulseShareArtifactTypeSchema = z.enum([
  'signed_call',
  'genesis_signed_call',
  'correct_call',
  'incorrect_call',
  'rotation_result',
  'no_qualified_rotation',
  'resolution_delayed'
]);

export const RhPulseShareSourceRecordSchema = z.object({
  kind: z.enum([
    'signed_call_receipt',
    'rotation_receipt',
    'blocked_resolution_run'
  ]),
  id: z.string().trim().min(1).max(180),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/)
}).strict();

export const RhPulseShareArtifactDataSchema = z.object({
  artifact_type: RhPulseShareArtifactTypeSchema,
  artifact_schema_version: z.literal(RH_PULSE_SHARE_ARTIFACT_SCHEMA_VERSION),
  renderer_version: z.literal(RH_PULSE_SHARE_RENDERER_VERSION),
  source_records: z.array(RhPulseShareSourceRecordSchema).min(1).max(2),
  source_identity_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  generated_at: z.string().datetime(),
  canonical_url: z.string().url(),
  primary_line: z.string().trim().min(1).max(80),
  call_outcome: RhPulseCallOutcomeSchema.nullable(),
  call_outcome_label: z.string().trim().min(1).max(80).nullable(),
  winning_outcome: RhPulseCallOutcomeSchema.nullable(),
  winning_outcome_label: z.string().trim().min(1).max(80).nullable(),
  summary: z.string().trim().min(1).max(360),
  evidence_lines: z.array(z.string().trim().min(1).max(240)).max(3),
  public_call_number: z.number().int().positive().nullable(),
  genesis_rank: z.number().int().min(1).max(RH_PULSE_GENESIS_LIMIT).nullable(),
  window_sequence_number: z.number().int().positive(),
  recorded_at: z.string().datetime().nullable(),
  window_closes_at: z.string().datetime(),
  published_at: z.string().datetime().nullable(),
  confidence: RhPulseConfidenceSchema.nullable(),
  community_correct_percentage: z.number().min(0).max(100).nullable(),
  community_total_verified_calls: z.number().int().nonnegative().nullable(),
  receipt_label: z.string().trim().min(1).max(80),
  receipt_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  methodology_version: z.literal(RH_PULSE_CALL_METHODOLOGY_VERSION),
  image_alt: z.string().trim().min(1).max(240)
}).strict();

export const RhPulseShareDimensionsSchema = z.union([
  z.object({
    width: z.literal(RH_PULSE_SHARE_LANDSCAPE.width),
    height: z.literal(RH_PULSE_SHARE_LANDSCAPE.height)
  }).strict(),
  z.object({
    width: z.literal(RH_PULSE_SHARE_PORTRAIT.width),
    height: z.literal(RH_PULSE_SHARE_PORTRAIT.height)
  }).strict()
]);

export type RhPulseShareArtifactType = z.infer<typeof RhPulseShareArtifactTypeSchema>;
export type RhPulseShareArtifactData = z.infer<typeof RhPulseShareArtifactDataSchema>;
export type RhPulseShareDimensions = z.infer<typeof RhPulseShareDimensionsSchema>;

const OUTCOME_LABELS = {
  agents_to_rwas: 'AGENTS → RWAs',
  memes_to_agents: 'MEMES → AGENTS',
  memes_to_rwas: 'MEMES → RWAs',
  no_qualified_rotation: 'NO QUALIFIED ROTATION'
} as const;

const XML_UNSAFE_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/gu;

export function sanitizeRhPulseArtifactText(value: string, maximum = 240) {
  return value
    .normalize('NFKC')
    .replace(XML_UNSAFE_CONTROLS, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maximum);
}

export function escapeRhPulseSvgText(value: string) {
  return sanitizeRhPulseArtifactText(value, 1_000)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function canonicalRhPulseOutcomeLabel(outcome: z.infer<typeof RhPulseCallOutcomeSchema>) {
  return OUTCOME_LABELS[outcome];
}

export function renderRhPulseShareSvg(
  input: RhPulseShareArtifactData,
  requestedDimensions: RhPulseShareDimensions
) {
  const artifact = RhPulseShareArtifactDataSchema.parse(input);
  const dimensions = RhPulseShareDimensionsSchema.parse(requestedDimensions);
  const portrait = dimensions.height > dimensions.width;
  const palette = artifactPalette(artifact.artifact_type);
  const displayOutcome = artifact.artifact_type === 'incorrect_call'
    ? artifact.call_outcome_label
    : artifact.winning_outcome_label ?? artifact.call_outcome_label;
  const outcome = displayOutcome ? sanitizeRhPulseArtifactText(displayOutcome, 80).toUpperCase() : null;
  const title = `${artifact.primary_line} — ${outcome ?? `Window ${artifact.window_sequence_number}`}`;
  const description = `${artifact.receipt_label}. ${artifact.summary}`;
  const font = "'IBM Plex Mono', ui-monospace, monospace";
  const sourceCode = shortenHash(artifact.receipt_hash);
  const body = portrait
    ? renderPortrait(artifact, palette, outcome, font)
    : renderLandscape(artifact, palette, outcome, font);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}" role="img" aria-labelledby="rh-pulse-share-title rh-pulse-share-description" data-artifact-type="${artifact.artifact_type}" data-renderer-version="${RH_PULSE_SHARE_RENDERER_VERSION}" data-source-identity="${artifact.source_identity_hash}">
  <title id="rh-pulse-share-title">${escapeRhPulseSvgText(title)}</title>
  <desc id="rh-pulse-share-description">${escapeRhPulseSvgText(description)}</desc>
  <defs>
    <radialGradient id="pulseGlow" cx="78%" cy="14%" r="74%">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity=".16"/>
      <stop offset="48%" stop-color="${palette.accent}" stop-opacity=".03"/>
      <stop offset="100%" stop-color="#030605" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="pulseEdge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity=".92"/>
      <stop offset="100%" stop-color="#d8fff0" stop-opacity=".52"/>
    </linearGradient>
  </defs>
  <rect width="${dimensions.width}" height="${dimensions.height}" fill="#030605"/>
  <rect width="${dimensions.width}" height="${dimensions.height}" fill="url(#pulseGlow)"/>
  <path d="M0 1H${dimensions.width}M0 ${dimensions.height - 1}H${dimensions.width}" stroke="${palette.accent}" stroke-opacity=".34"/>
  <g opacity=".07" stroke="#a9c9bd" stroke-width="1">
    ${gridLines(dimensions.width, dimensions.height, portrait ? 54 : 60)}
  </g>
  ${body}
  <g font-family="${font}" fill="#6f8f84" font-size="${portrait ? 19 : 13}" letter-spacing="1.2">
    <text x="${portrait ? 64 : 58}" y="${dimensions.height - (portrait ? 54 : 34)}">METHODOLOGY ${escapeRhPulseSvgText(artifact.methodology_version.toUpperCase())}</text>
    <text x="${dimensions.width - (portrait ? 64 : 58)}" y="${dimensions.height - (portrait ? 54 : 34)}" text-anchor="end">${escapeRhPulseSvgText(sourceCode)}</text>
  </g>
</svg>`;
}

export function renderRhPulseDefaultOgSvg(
  requestedDimensions: RhPulseShareDimensions = RH_PULSE_SHARE_LANDSCAPE
) {
  const dimensions = RhPulseShareDimensionsSchema.parse(requestedDimensions);
  const portrait = dimensions.height > dimensions.width;
  const font = "'IBM Plex Mono', ui-monospace, monospace";
  const mapX = portrait ? 267 : 820;
  const mapY = portrait ? 430 : 116;
  const mapWidth = portrait ? 546 : 310;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}" role="img" aria-labelledby="rh-pulse-default-title rh-pulse-default-description">
  <title id="rh-pulse-default-title">RH Pulse — Call the Rotation</title>
  <desc id="rh-pulse-default-description">See the emerging connections between Memes, Agents and RWAs on Robinhood Chain.</desc>
  <defs>
    <radialGradient id="pulseDefaultGlow" cx="78%" cy="14%" r="74%">
      <stop offset="0%" stop-color="#9bf1cc" stop-opacity=".16"/>
      <stop offset="100%" stop-color="#030605" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="pulseEdge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#9bf1cc" stop-opacity=".92"/>
      <stop offset="100%" stop-color="#d8fff0" stop-opacity=".52"/>
    </linearGradient>
  </defs>
  <rect width="${dimensions.width}" height="${dimensions.height}" fill="#030605"/>
  <rect width="${dimensions.width}" height="${dimensions.height}" fill="url(#pulseDefaultGlow)"/>
  <g opacity=".07" stroke="#a9c9bd" stroke-width="1">
    ${gridLines(dimensions.width, dimensions.height, portrait ? 54 : 60)}
  </g>
  <g font-family="${font}">
    ${brandHeader(portrait ? 64 : 58, portrait ? 72 : 54, portrait ? 1.18 : 1)}
    <text x="${portrait ? 64 : 58}" y="${portrait ? 190 : 148}" fill="#9bf1cc" font-size="${portrait ? 22 : 18}" font-weight="700" letter-spacing="2.8">CALL THE ROTATION</text>
    <text x="${portrait ? 64 : 58}" y="${portrait ? 275 : 226}" fill="#f2fff9" font-size="${portrait ? 54 : 42}" font-weight="700">SEE THE CONNECTIONS.</text>
    <text x="${portrait ? 64 : 58}" y="${portrait ? 342 : 280}" fill="#b7d0c7" font-size="${portrait ? 28 : 22}">Memes · Agents · RWAs</text>
    ${renderLayerMap(mapX, mapY, mapWidth, null, '#9bf1cc', false)}
    <text x="${portrait ? 64 : 58}" y="${dimensions.height - (portrait ? 88 : 58)}" fill="#719187" font-size="${portrait ? 20 : 15}">INDEPENDENT PUBLIC INTELLIGENCE BY INFOPUNKS</text>
  </g>
</svg>`;
}

function renderLandscape(
  artifact: RhPulseShareArtifactData,
  palette: ReturnType<typeof artifactPalette>,
  outcome: string | null,
  font: string
) {
  const summaryLines = wrap(artifact.summary, 47, 3);
  const incorrect = artifact.artifact_type === 'incorrect_call';
  return `<g font-family="${font}">
    ${brandHeader(58, 54, 1)}
    <text x="58" y="132" fill="${palette.accent}" font-size="18" font-weight="700" letter-spacing="2.8">${escapeRhPulseSvgText(artifact.primary_line)}</text>
    ${incorrect
      ? incorrectOutcomeBlock(artifact, 58, 174, font)
      : `<text x="58" y="208" fill="#f2fff9" font-size="${fontSize(outcome, 48)}" font-weight="700" letter-spacing="-1.6">${escapeRhPulseSvgText(outcome ?? `WINDOW ${String(artifact.window_sequence_number).padStart(3, '0')}`)}</text>`}
    ${renderLines(summaryLines, 58, incorrect ? 354 : 272, 28, 20, '#b7d0c7', font, 500)}
    ${renderLandscapeFacts(artifact, font, palette.accent)}
    ${renderLayerMap(820, 116, 310, artifact.winning_outcome ?? artifact.call_outcome, palette.accent, artifact.artifact_type === 'resolution_delayed')}
  </g>`;
}

function renderPortrait(
  artifact: RhPulseShareArtifactData,
  palette: ReturnType<typeof artifactPalette>,
  outcome: string | null,
  font: string
) {
  const incorrect = artifact.artifact_type === 'incorrect_call';
  const summaryLines = wrap(artifact.summary, 46, 3);
  return `<g font-family="${font}">
    ${brandHeader(64, 72, 1.18)}
    <text x="64" y="178" fill="${palette.accent}" font-size="23" font-weight="700" letter-spacing="3.4">${escapeRhPulseSvgText(artifact.primary_line)}</text>
    ${incorrect
      ? incorrectOutcomeBlock(artifact, 64, 224, font, true)
      : `<text x="64" y="282" fill="#f2fff9" font-size="${fontSize(outcome, 56)}" font-weight="700" letter-spacing="-1.8">${escapeRhPulseSvgText(outcome ?? `WINDOW ${String(artifact.window_sequence_number).padStart(3, '0')}`)}</text>`}
    ${renderLayerMap(315, incorrect ? 430 : 340, 450, artifact.winning_outcome ?? artifact.call_outcome, palette.accent, artifact.artifact_type === 'resolution_delayed')}
    ${renderLines(summaryLines, 64, incorrect ? 910 : 830, 37, 26, '#c4d9d1', font, 500)}
    ${renderPortraitFacts(artifact, font, palette.accent)}
  </g>`;
}

function brandHeader(x: number, y: number, scale: number) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <rect width="16" height="16" rx="3" fill="#9bf1cc"/>
    <path d="M4 4h8v3H7v5H4z" fill="#07110d"/>
    <text x="30" y="15" fill="#d8eee5" font-size="16" font-weight="700" letter-spacing="2.2">INFOPUNKS / RH PULSE</text>
  </g>`;
}

function incorrectOutcomeBlock(
  artifact: RhPulseShareArtifactData,
  x: number,
  y: number,
  font: string,
  portrait = false
) {
  const firstSize = portrait ? 22 : 15;
  const valueSize = portrait ? 39 : 31;
  const gap = portrait ? 64 : 49;
  return `<g font-family="${font}">
    <text x="${x}" y="${y}" fill="#718f85" font-size="${firstSize}" font-weight="700" letter-spacing="2">MY CALL</text>
    <text x="${x}" y="${y + (portrait ? 47 : 36)}" fill="#eefcf7" font-size="${fontSize(artifact.call_outcome_label, valueSize)}" font-weight="700">${escapeRhPulseSvgText(artifact.call_outcome_label ?? 'RECORDED CALL')}</text>
    <text x="${x}" y="${y + gap + (portrait ? 50 : 41)}" fill="#9bf1cc" font-size="${firstSize}" font-weight="700" letter-spacing="2">WINNING ROTATION</text>
    <text x="${x}" y="${y + gap + (portrait ? 99 : 78)}" fill="#9bf1cc" font-size="${fontSize(artifact.winning_outcome_label, valueSize)}" font-weight="700">${escapeRhPulseSvgText(artifact.winning_outcome_label ?? 'PUBLISHED RESULT')}</text>
  </g>`;
}

function renderLandscapeFacts(
  artifact: RhPulseShareArtifactData,
  font: string,
  accent: string
) {
  const facts = artifactFacts(artifact).slice(0, 3);
  const columns = [58, 293, 620] as const;
  return `<g font-family="${font}">
    ${facts.map((fact, index) => {
      const x = columns[index]!;
      return `<text x="${x}" y="498" fill="#69877d" font-size="12" font-weight="700" letter-spacing="1.5">${escapeRhPulseSvgText(fact.label)}</text>
      <text x="${x}" y="526" fill="${index === 0 ? accent : '#d8eee5'}" font-size="17" font-weight="700">${escapeRhPulseSvgText(fact.value)}</text>`;
    }).join('')}
    <text x="58" y="580" fill="#6f8f84" font-size="14">${escapeRhPulseSvgText(artifact.receipt_label)}</text>
  </g>`;
}

function renderPortraitFacts(
  artifact: RhPulseShareArtifactData,
  font: string,
  accent: string
) {
  const facts = artifactFacts(artifact).slice(0, 4);
  return `<g font-family="${font}">
    ${facts.map((fact, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 64 + column * 480;
      const y = 1_036 + row * 108;
      return `<text x="${x}" y="${y}" fill="#69877d" font-size="17" font-weight="700" letter-spacing="1.7">${escapeRhPulseSvgText(fact.label)}</text>
      <text x="${x}" y="${y + 37}" fill="${index === 0 ? accent : '#d8eee5'}" font-size="23" font-weight="700">${escapeRhPulseSvgText(fact.value)}</text>`;
    }).join('')}
    <text x="64" y="1_278" fill="#739388" font-size="18">${escapeRhPulseSvgText(artifact.receipt_label)}</text>
  </g>`;
}

function renderLayerMap(
  x: number,
  y: number,
  size: number,
  highlighted: RhPulseShareArtifactData['winning_outcome'],
  accent: string,
  delayed: boolean
) {
  const top = { x: x + size / 2, y: y + 28 };
  const left = { x: x + 36, y: y + size - 54 };
  const right = { x: x + size - 36, y: y + size - 54 };
  const edge = (
    from: typeof top,
    to: typeof top,
    outcome: 'agents_to_rwas' | 'memes_to_agents' | 'memes_to_rwas'
  ) => {
    const active = !delayed && highlighted === outcome;
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${active ? 'url(#pulseEdge)' : '#416158'}" stroke-width="${active ? 8 : 3}" stroke-linecap="round" ${delayed ? 'stroke-dasharray="8 12"' : ''} opacity="${active ? 1 : .55}"/>`;
  };
  return `<g>
    ${edge(top, right, 'agents_to_rwas')}
    ${edge(left, right, 'memes_to_agents')}
    ${edge(top, left, 'memes_to_rwas')}
    ${mapNode(top.x, top.y, 'RWAs', highlighted === 'agents_to_rwas' || highlighted === 'memes_to_rwas', accent)}
    ${mapNode(left.x, left.y, 'MEMES', highlighted === 'memes_to_agents' || highlighted === 'memes_to_rwas', accent)}
    ${mapNode(right.x, right.y, 'AGENTS', highlighted === 'agents_to_rwas' || highlighted === 'memes_to_agents', accent)}
  </g>`;
}

function mapNode(x: number, y: number, label: string, active: boolean, accent: string) {
  return `<g>
    <circle cx="${x}" cy="${y}" r="29" fill="#07110d" stroke="${active ? accent : '#4b7064'}" stroke-width="${active ? 4 : 2}"/>
    <circle cx="${x}" cy="${y}" r="7" fill="${active ? accent : '#719187'}"/>
    <text x="${x}" y="${y + 52}" text-anchor="middle" fill="${active ? '#dffff2' : '#91ada3'}" font-size="13" font-weight="700" letter-spacing="1.2">${label}</text>
  </g>`;
}

function artifactFacts(artifact: RhPulseShareArtifactData) {
  const recorded = artifact.recorded_at ? formatUtcDate(artifact.recorded_at) : null;
  const published = artifact.published_at ? formatUtcDate(artifact.published_at) : null;
  const confidence = artifact.confidence ? titleCase(artifact.confidence) : null;
  const community = artifact.community_total_verified_calls === 0
    ? '0 verified calls'
    : artifact.community_correct_percentage !== null
      ? `${formatPercentage(artifact.community_correct_percentage)} called it`
      : null;
  const callNumber = artifact.public_call_number
    ? `#${String(artifact.public_call_number).padStart(4, '0')}`
    : `Window ${String(artifact.window_sequence_number).padStart(3, '0')}`;
  return [
    {
      label: artifact.genesis_rank ? 'GENESIS CALL' : artifact.public_call_number ? 'PUBLIC CALL' : 'WINDOW',
      value: artifact.genesis_rank
        ? `#${String(artifact.genesis_rank).padStart(4, '0')} / ${RH_PULSE_GENESIS_LIMIT}`
        : callNumber
    },
    { label: published ? 'PUBLISHED' : recorded ? 'RECORDED' : 'WINDOW CLOSE', value: published ?? recorded ?? formatUtcDate(artifact.window_closes_at) },
    { label: confidence ? 'CONFIDENCE' : 'WINDOW CLOSE', value: confidence ?? formatUtcDate(artifact.window_closes_at) },
    { label: community ? 'COMMUNITY' : 'VERIFICATION', value: community ?? 'RECEIPT VERIFIED' }
  ];
}

function artifactPalette(type: RhPulseShareArtifactType) {
  if (type === 'incorrect_call') return { accent: '#a7c8bd' };
  if (type === 'resolution_delayed') return { accent: '#e3bd7a' };
  return { accent: '#9bf1cc' };
}

function wrap(value: string, maxChars: number, maxLines: number) {
  const words = sanitizeRhPulseArtifactText(value, maxChars * maxLines * 2).split(' ');
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || current.length + word.length + 1 > maxChars) {
      if (lines.length === maxLines) break;
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }
  if (words.join(' ').length > lines.join(' ').length && lines.length) {
    lines[lines.length - 1] = `${lines.at(-1)!.replace(/[.…]+$/u, '').slice(0, Math.max(1, maxChars - 1))}…`;
  }
  return lines;
}

function renderLines(
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  size: number,
  fill: string,
  font: string,
  weight: number
) {
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + index * lineHeight}" fill="${fill}" font-family="${font}" font-size="${size}" font-weight="${weight}">${escapeRhPulseSvgText(line)}</text>`
  )).join('');
}

function gridLines(width: number, height: number, gap: number) {
  const vertical = Array.from({ length: Math.ceil(width / gap) }, (_, index) => (
    `<path d="M${index * gap} 0V${height}"/>`
  ));
  const horizontal = Array.from({ length: Math.ceil(height / gap) }, (_, index) => (
    `<path d="M0 ${index * gap}H${width}"/>`
  ));
  return [...vertical, ...horizontal].join('');
}

function fontSize(value: string | null, preferred: number) {
  if (!value) return preferred;
  if (value.length > 24) return Math.max(26, preferred - 14);
  if (value.length > 18) return Math.max(30, preferred - 8);
  return preferred;
}

function shortenHash(value: string) {
  return `VERIFIED ${value.slice(7, 15).toUpperCase()}…${value.slice(-8).toUpperCase()}`;
}

function formatUtcDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value)).replace(',', ' ·') + ' UTC';
}

function formatPercentage(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}%`;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
