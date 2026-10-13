import type pg from 'pg';
import type { OpenLoop } from './rh4663FrontdoorService';
import { observationCommitment } from './rhAutomatedObservationReceiptService';
export interface FrontdoorOpenLoopStore { reconcile(loops: OpenLoop[], at: Date): Promise<OpenLoop[]> }
/** Countdown text and source refresh time are presentation, not evidence transitions. */
function semantic(loop: OpenLoop) {
  const progress = loop.progress.type === 'TIME_TO_CHECKPOINT' ? { type: loop.progress.type, checkpoint_at: loop.progress.checkpoint_at } : loop.progress;
  return observationCommitment({ state: loop.state, current_evidence: loop.current_evidence, next_evidence_needed: loop.next_evidence_needed, resolution_condition: loop.resolution_condition, falsification_condition: loop.falsification_condition, expected_checkpoint_at: loop.expected_checkpoint_at, progress });
}
function merge(prior: OpenLoop | undefined, loop: OpenLoop, at: Date): OpenLoop {
  if (!prior) return loop;
  const changed = semantic(prior) !== semantic(loop);
  return { ...loop, opened_at: prior.opened_at, last_changed_at: changed ? at.toISOString() : prior.last_changed_at };
}
function absent(loop: OpenLoop, at: Date): OpenLoop {
  if (['RESOLVED', 'FALSIFIED', 'STALE'].includes(loop.state)) return loop;
  return { ...loop, state: 'STALE', last_changed_at: at.toISOString(), current_evidence: 'Current source evidence is unavailable or no longer eligible. The prior question remains open.', next_evidence_needed: 'Refresh eligible source evidence before advancing this question.' };
}
export class InMemoryFrontdoorOpenLoopStore implements FrontdoorOpenLoopStore {
  private rows = new Map<string, OpenLoop>();
  async reconcile(loops: OpenLoop[], at: Date) {
    const ids = new Set(loops.map(l => l.loop_id));
    for (const loop of loops) this.rows.set(loop.loop_id, merge(this.rows.get(loop.loop_id), loop, at));
    for (const [id, loop] of this.rows) if (!ids.has(id)) this.rows.set(id, absent(loop, at));
    return [...this.rows.values()].sort((a, b) => b.last_changed_at.localeCompare(a.last_changed_at) || a.loop_id.localeCompare(b.loop_id)).slice(0, 200).map(l => structuredClone(l));
  }
}
export class PostgresFrontdoorOpenLoopStore implements FrontdoorOpenLoopStore {
  constructor(private readonly pool: pg.Pool) {}
  async reconcile(loops: OpenLoop[], at: Date) {
    const c = await this.pool.connect();
    try {
      await c.query('begin'); await c.query("select pg_advisory_xact_lock(hashtext(current_schema() || ':frontdoor-loops'))");
      const previous = await c.query<{ payload: OpenLoop }>('select payload from rh4663_frontdoor_open_loops order by last_changed_at desc,loop_id limit 200');
      const rows = new Map(previous.rows.map(r => [r.payload.loop_id, r.payload]));
      for (const loop of loops) rows.set(loop.loop_id, merge(rows.get(loop.loop_id), loop, at));
      const ids = new Set(loops.map(l => l.loop_id));
      for (const [id, loop] of rows) if (!ids.has(id)) rows.set(id, absent(loop, at));
      for (const loop of rows.values()) await c.query('insert into rh4663_frontdoor_open_loops(loop_id,last_changed_at,payload) values($1,$2,$3) on conflict(loop_id) do update set last_changed_at=excluded.last_changed_at,payload=excluded.payload', [loop.loop_id, loop.last_changed_at, loop]);
      await c.query('commit'); return [...rows.values()].sort((a, b) => b.last_changed_at.localeCompare(a.last_changed_at) || a.loop_id.localeCompare(b.loop_id));
    } catch (error) { await c.query('rollback'); throw error; } finally { c.release(); }
  }
}
