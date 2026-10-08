import type pg from 'pg';
import { SettledRevenueSchema, RecordedCostSchema, type SettledRevenue, type RecordedCost } from '../schemas/economicAccounting';
import { canonicalSerialize } from '../services/receiptIntegrityService';
export interface EconomicAccountingStore {
  appendRevenue(record: SettledRevenue): Promise<SettledRevenue>;
  appendCost(record: RecordedCost): Promise<RecordedCost>;
  revenues(): Promise<SettledRevenue[]>;
  costs(): Promise<RecordedCost[]>;
}
export class MemoryEconomicAccountingStore implements EconomicAccountingStore {
  private revenue = new Map<string, SettledRevenue>(); private cost = new Map<string, RecordedCost>();
  constructor() { if (process.env.NODE_ENV === 'production') throw new Error('accounting_requires_postgres'); }
  async appendRevenue(raw: SettledRevenue) {
    const record = SettledRevenueSchema.parse(raw); const prior = this.revenue.get(record.revenue_id);
    if (prior && canonicalSerialize(prior) !== canonicalSerialize(record)) throw new Error('accounting_id_conflict');
    if (!prior && [...this.revenue.values()].some(v => v.judgment_id === record.judgment_id || (v.network === record.network && v.transaction_hash === record.transaction_hash))) throw new Error('accounting_settlement_reused');
    this.revenue.set(record.revenue_id, structuredClone(record)); return structuredClone(record);
  }
  async appendCost(raw: RecordedCost) {
    const record = RecordedCostSchema.parse(raw); const prior = this.cost.get(record.cost_id);
    if (prior && canonicalSerialize(prior) !== canonicalSerialize(record)) throw new Error('accounting_id_conflict');
    this.cost.set(record.cost_id, structuredClone(record)); return structuredClone(record);
  }
  async revenues() { return structuredClone([...this.revenue.values()]); }
  async costs() { return structuredClone([...this.cost.values()]); }
}
export class PostgresEconomicAccountingStore implements EconomicAccountingStore {
  constructor(private pool: pg.Pool) {}
  private async append(table: 'settled_judgment_revenue' | 'recorded_protocol_costs', id: string, record: SettledRevenue | RecordedCost) {
    const column = table === 'settled_judgment_revenue' ? 'revenue_id' : 'cost_id';
    const values: unknown[] = [id, record];
    const columns = [column, 'record'];
    if ('revenue_id' in record) { columns.push('judgment_id', 'network', 'transaction_hash'); values.push(record.judgment_id, record.network, record.transaction_hash); }
    await this.pool.query(`insert into ${table} (${columns.join(',')}) values (${values.map((_, i) => '$' + (i + 1)).join(',')}) on conflict (${column}) do nothing`, values);
    const existing = (await this.pool.query(`select record from ${table} where ${column}=$1`, [id])).rows[0].record;
    if (canonicalSerialize(existing) !== canonicalSerialize(record)) throw new Error('accounting_id_conflict');
    return existing;
  }
  async appendRevenue(record: SettledRevenue) { return SettledRevenueSchema.parse(await this.append('settled_judgment_revenue', record.revenue_id, SettledRevenueSchema.parse(record))); }
  async appendCost(record: RecordedCost) { return RecordedCostSchema.parse(await this.append('recorded_protocol_costs', record.cost_id, RecordedCostSchema.parse(record))); }
  async revenues() { return (await this.pool.query('select record from settled_judgment_revenue order by revenue_id')).rows.map(r => SettledRevenueSchema.parse(r.record)); }
  async costs() { return (await this.pool.query('select record from recorded_protocol_costs order by cost_id')).rows.map(r => RecordedCostSchema.parse(r.record)); }
}
