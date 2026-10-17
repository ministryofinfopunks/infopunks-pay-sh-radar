/** Independent task specification implementation. This module imports no Radar, controller, probe or provider code. */
import { createHash } from 'node:crypto';
export function reference(family: string, input: unknown): unknown {
  const x = input as any;
  switch (family) {
    case 'arithmetic': {
      let total = 0;
      for (const v of x) total += v;
      return total;
    }
    case 'statistics': {
      let total = 0;
      for (const v of x) total += v;
      return total / x.length;
    }
    case 'sorting':
      return Array.from(x as number[]).sort((a, b) => a - b);
    case 'normalization': {
      const result: string[] = [];
      for (const s of x) {
        const n = s.toLowerCase().trim();
        if (!result.includes(n)) result.push(n);
      }
      return result;
    }
    case 'csv': {
      const rows: string[][] = [];
      let row: string[] = [],
        field = '',
        quoted = false;
      for (let i = 0; i < x.length; i++) {
        const c = x[i];
        if (c === '"') {
          if (quoted && x[i + 1] === '"') {
            field += '"';
            i++;
          } else quoted = !quoted;
        } else if (!quoted && (c === ',' || c === '\n')) {
          row.push(field);
          field = '';
          if (c === '\n') {
            rows.push(row);
            row = [];
          }
        } else field += c;
      }
      row.push(field);
      rows.push(row);
      return rows.slice(1);
    }
    case 'json': {
      let value = x;
      for (const k of x.path) value = value[k];
      return value;
    }
    case 'time':
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(x));
    case 'cryptography':
      return createHash('sha256').update(Buffer.from(x, 'utf8')).digest('hex');
    case 'unicode':
      return [...x].length;
    case 'decimal': {
      const [a, b] = x.split('.');
      return Number(a) * 100 + Number((b ?? '').padEnd(2, '0'));
    }
    case 'url':
      return new URL(x).searchParams.getAll('q');
    case 'intervals':
      return Math.max(x[0][0], x[1][0]) < Math.min(x[0][1], x[1][1]); // half-open
    case 'text':
      return x.match(/\S+/g) ?? [];
    case 'units':
      return x / 0.001;
    case 'relational':
      return x.left.map((a: any) => ({
        ...a,
        stock: x.right.find((b: any) => a.id === b.id)?.stock ?? null,
      })); // left join
    case 'extraction':
      return /^# (.+)$/m.exec(x)?.[1] ?? null;
    case 'validation':
      return typeof x === 'string' && x.length === 5 && [...x].every((c) => c >= '0' && c <= '9');
    case 'availability':
      return 'delivered:document';
    case 'latency':
      return 'RADAR';
    case 'quantiles': {
      const a = [...x].sort((a, b) => a - b);
      return a[Math.ceil(0.9 * a.length) - 1];
    } // nearest rank p90
    default:
      throw new Error('oracle_task_family_unknown');
  }
}
