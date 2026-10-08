/** Nasdaq regular equity session calendar. Source: nasdaqtrader.com/Trader.aspx?id=Calendar. */
export const PLTR_CALENDAR_VERSION = 'NASDAQ_REGULAR_2026_V1';
const holidays = new Set(['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25']);
const earlyCloses = new Set(['2026-11-27', '2026-12-24']);
const eastern = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function pltrRegularSession(now: Date): 'OPEN' | 'CLOSED' | 'WEEKEND' | 'HOLIDAY' | 'UNKNOWN' {
  if (!Number.isFinite(now.getTime())) return 'UNKNOWN';
  const parts = Object.fromEntries(eastern.formatToParts(now).map(part => [part.type, part.value]));
  // Never extrapolate a stale calendar into an unreviewed year.
  if (parts.year !== '2026') return 'UNKNOWN';
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return 'WEEKEND';
  if (holidays.has(date)) return 'HOLIDAY';
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  return minute >= 570 && minute < (earlyCloses.has(date) ? 780 : 960) ? 'OPEN' : 'CLOSED';
}
