import { InfopunksEvent } from '../schemas/entities';

function latencyText(value: unknown) {
  return typeof value === 'number' ? `${value}ms` : 'unknown latency';
}

function statusText(value: unknown) {
  return typeof value === 'number' ? `HTTP ${value}` : 'unknown status';
}

function errorText(event: InfopunksEvent) {
  return event.payload.error_message ?? event.payload.error ?? event.payload.status_code ?? 'unknown error';
}

export function providerReachabilitySummary(event: InfopunksEvent) {
  if (event.payload.success === true) return `Network reachable in ${latencyText(event.payload.response_time_ms)}.`;
  if (event.payload.success === false) return `Network unreachable after ${latencyText(event.payload.response_time_ms)}: ${errorText(event)}.`;
  return `Network reachability unknown after ${latencyText(event.payload.response_time_ms)}.`;
}

export function providerRootHealthSummary(event: InfopunksEvent, classification: 'healthy' | 'degraded' | 'failed' | 'recovered' | 'unknown') {
  if (classification === 'recovered') return 'Root health check recovered after prior degraded or failed evidence.';
  if (classification === 'unknown') return 'Root health state unknown.';
  return `Root health check returned ${statusText(event.payload.status_code)}; classified as ${classification}.`;
}
