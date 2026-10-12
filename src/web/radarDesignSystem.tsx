import React, { useId } from 'react';

export type RadarEvidenceState = 'verified' | 'judgment' | 'pending' | 'missing' | 'recorded' | 'unavailable' | 'failed' | 'demonstration' | 'unverified';
const STATUS_LABELS: Record<RadarEvidenceState, string> = {
  unverified: 'Verification not established', verified: 'Verified evidence', judgment: 'Judgment', pending: 'Pending outcome',
  missing: 'Missing evidence', recorded: 'Record exists', unavailable: 'Unavailable',
  failed: 'Validation failed', demonstration: 'Demonstration'
};
export function RadarStatus({ state, detail }: { state: RadarEvidenceState; detail?: string }) {
  return <span className={`radar-status radar-status-${state}`} data-evidence-state={state}>
    <span aria-hidden="true">{state === 'verified' ? '✓' : state === 'failed' ? '×' : state === 'judgment' ? '◇' : '○'}</span>
    {STATUS_LABELS[state]}{detail && <span> / {detail}</span>}
  </span>;
}
export function RadarSectionHeader({ index, title, subtitle, id, level = 2 }: { index: string; title: string; subtitle: string; id?: string; level?: 1 | 2 | 3 | 'label' }) {
  const Tag = level === 'label' ? 'p' : `h${level}` as 'h1' | 'h2' | 'h3';
  return <Tag id={id} className="radar-section-header"><span>[ {index} ]</span> {title} <span aria-hidden="true">/</span> {subtitle}</Tag>;
}
export type RadarReceiptStage = 'observation' | 'judgment' | 'execution' | 'evaluation';
export type RadarStageRecord = { state: RadarEvidenceState; detail: string; href?: string; recordId?: string };
const STAGES: readonly RadarReceiptStage[] = ['observation', 'judgment', 'execution', 'evaluation'];
export function RadarReceiptLifecycle({ records, reference = false }: { records?: Partial<Record<RadarReceiptStage, RadarStageRecord>>; reference?: boolean }) {
  return <section className="radar-lifecycle" aria-label="Four-receipt lifecycle">
    <p className="radar-lifecycle-caption">{reference ? 'Architecture reference · no stage records claimed' : 'Receipt lifecycle · inspect each stage independently'}</p>
    <ol>{STAGES.map((stage, index) => {
      const record = records?.[stage];
      return <li key={stage}><strong><span aria-hidden="true">{String(index + 1).padStart(2, '0')} / </span>{stage.toUpperCase()}</strong>
        {!reference && <RadarStatus state={record?.state ?? 'missing'} />}
        <p>{reference ? ['Source-bound evidence', 'Policy-relative decision', 'Recorded execution attempt', 'Established service outcome'][index] : record?.detail ?? 'No stage record supplied.'}</p>
        {record?.href && <a href={record.href}>Inspect {record.recordId ?? `${stage} record`} ↗</a>}
      </li>;
    })}</ol>
  </section>;
}
export function RadarEvidenceRow({ title, state, provenance, children }: { title: string; state: RadarEvidenceState; provenance: string; children: React.ReactNode }) {
  return <details className="radar-evidence-row"><summary><span>{title}</span><RadarStatus state={state} /></summary><p className="radar-provenance">Source / {provenance}</p><div>{children}</div></details>;
}
export function RadarAsyncState({ kind, title, children, onRetry }: { kind: 'loading' | 'empty' | 'error' | 'unavailable' | 'permission-denied'; title: string; children?: React.ReactNode; onRetry?: () => void }) {
  return <section className={`radar-async-state panel state-${kind}`} role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'error' ? 'assertive' : 'polite'} aria-busy={kind === 'loading'}>
    <strong>{title}</strong>{children && <p>{children}</p>}{onRetry && <button className="execute secondary" type="button" onClick={onRetry}>Retry</button>}
  </section>;
}
export function RadarDataTable({ caption, children }: { caption: string; children: React.ReactNode }) {
  const id = useId();
  return <div><p id={id} className="radar-table-hint">{caption} · scroll horizontally for all columns</p><div className="radar-table-scroll" role="region" aria-labelledby={id} tabIndex={0}><table><caption className="sr-only">{caption}</caption>{children}</table></div></div>;
}
