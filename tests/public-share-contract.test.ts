import { expect, it } from 'vitest';
import { publicShareSchema } from '../src/web/publicShareSchema';
import { buildRh4663CallShareObject } from '../src/services/rh4663ShareObjectService';
const share = buildRh4663CallShareObject({receipt_id:'synthetic-call',created_at:'2026-10-07T00:00:00Z',window_id:'synthetic-window',rotation:'MEMES',confidence:30});
it('accepts the actual canonical public projection',()=>{ expect(publicShareSchema.safeParse(share).success).toBe(true); });
it.each([
  {}, {...share, privacy_state:'PRIVATE'}, {...share, private_receipt:'private-fragment'},
  {...share, source_ref:{...share.source_ref,href:'javascript:alert(1)'}},
  {...share, deep_link:'//untrusted.test/receipt'}, {...share,share_version:'unknown'},
  {...share, source_ref:undefined}
])('rejects incomplete, non-public or unsupported-link projections before rendering', payload=>{expect(publicShareSchema.safeParse(payload).success).toBe(false);});
