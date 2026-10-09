import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectE1RunFreeze } from '../../scripts/prepare-e1-run';

const template = JSON.parse(readFileSync(resolve('docs/decisions-e1-run-freeze-template-v1.json'), 'utf8')) as Record<string, any>;

describe('E1 prospective run preflight', () => {
  it('does not require the unrelated RH/USDG Judgment facilitator', () => {
    const result = inspectE1RunFreeze(template);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.blockers).toHaveLength(26);
    expect(result.blockers).not.toContain('environment.judgment_rail_facilitator_ref');
    expect(result.dispatch_enabled).toBe(false);
  });

  it('continues to reject a dispatch-enabled freeze regardless of filled references', () => {
    const unsafe = structuredClone(template);
    unsafe.dispatch_enabled = true;
    const result = inspectE1RunFreeze(unsafe);
    expect(result).toEqual({ valid: false, blockers: ['run_freeze_schema_or_safety_flags_invalid'] });
  });

  it('pins the selected endpoint and cannot pass with a different provider route', () => {
    const changed = structuredClone(template);
    changed.provider.endpoint = 'https://example.test/paid';
    const result = inspectE1RunFreeze(changed);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.blockers).toContain('provider_endpoint_not_pinned');
  });
});
