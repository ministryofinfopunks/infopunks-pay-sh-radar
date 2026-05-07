import { describe, expect, it, vi } from 'vitest';
import { normalizeJson, safeJsonbParam, toJsonb } from '../src/persistence/jsonb';

describe('jsonb helpers', () => {
  it('normalizes monitor payload shapes to JSON-safe values', () => {
    const date = new Date('2026-03-01T10:20:30.000Z');
    const input = {
      provider_reachable: { status_code: 200, checked_at: date },
      provider_degraded: { status_code: 404, nested: [[1, undefined, 3]] },
      provider_failed: { error_obj: new Error('boom'), error_string: 'boom-string' },
      skippedReasons: [{ providerId: 'a', serviceUrl: null, reason: 'missing_service_url' }],
      run_summary: { optionalUndefined: undefined, optionalNull: null, alreadyString: 'already-string' },
      nested_arrays: [[{ when: date }, undefined]],
      null_value: null
    };

    const normalized = normalizeJson(input) as Record<string, unknown>;
    expect(normalized.provider_reachable).toMatchObject({ status_code: 200, checked_at: '2026-03-01T10:20:30.000Z' });
    expect(normalized.provider_degraded).toMatchObject({ status_code: 404, nested: [[1, null, 3]] });
    expect(normalized.provider_failed).toMatchObject({
      error_obj: { name: 'Error', message: 'boom', stack: expect.any(String) },
      error_string: 'boom-string'
    });
    expect(normalized.run_summary).toMatchObject({ optionalUndefined: null, optionalNull: null, alreadyString: 'already-string' });
  });

  it('handles circular references without throwing', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    const normalized = normalizeJson({ circular }) as { circular: { self: string } };
    expect(normalized.circular.self).toBe('[Circular]');
    expect(() => JSON.stringify(normalized)).not.toThrow();
  });

  it('returns JSON string via toJsonb and safeJsonbParam', () => {
    const value = { date: new Date('2026-03-01T10:20:30.000Z'), text: 'already-string', list: [1, undefined, null] };
    const serialized = toJsonb(value);
    const serializedSafe = safeJsonbParam(value, { operation: 'insert', table: 'infopunks_events', column: 'payload' });

    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(() => JSON.parse(serializedSafe)).not.toThrow();
    expect(JSON.parse(serializedSafe)).toEqual(JSON.parse(serialized));
  });

  it('falls back to null and logs context when parse validation fails', () => {
    const parseSpy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
      throw new Error('parse failed');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const value = safeJsonbParam({ okay: true }, { operation: 'insert', table: 'intelligence_snapshots', column: 'snapshot' });

    expect(value).toBe('null');
    expect(errorSpy).toHaveBeenCalled();

    parseSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
