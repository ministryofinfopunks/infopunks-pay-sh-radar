import { describe, expect, it } from 'vitest';
import { InMemoryRhChainLaunchpadSnapshotStore, RhChainLaunchpadSnapshotService } from '../src/services/rhChainLaunchpadSnapshotService';
import { InMemoryRhChainSubmissionStore } from '../src/services/rhChainSignalVault';
import { queryRhChainScout } from '../src/services/rhChainScoutService';

describe('RH Chain Launchpad Observatory snapshots', () => {
  it('represents NOXA degraded context without implying misconduct', async () => {
    const snapshot = await new RhChainLaunchpadSnapshotService(new InMemoryRhChainLaunchpadSnapshotStore(), new InMemoryRhChainSubmissionStore()).refresh();
    const noxa = snapshot.observatory.surfaces.find((surface) => surface.surface_id === 'noxa_fun');
    expect(noxa).toMatchObject({ status: 'degraded', source_required: false });
    expect(noxa?.source_notes.join(' ')).toMatch(/primary.*evidence/i);
    expect(JSON.stringify(noxa)).not.toMatch(/rugged|malicious/i);
  });

  it('represents Pons active context while retaining source-required claims', async () => {
    const snapshot = await new RhChainLaunchpadSnapshotService(new InMemoryRhChainLaunchpadSnapshotStore(), new InMemoryRhChainSubmissionStore()).refresh();
    const pons = snapshot.observatory.surfaces.find((surface) => surface.surface_id === 'pons');
    expect(pons).toMatchObject({ status: 'active', status_confidence: 'low' });
    expect(pons?.notable_claims.join(' ')).toContain('source_required');
  });

  it('keeps competitor claims source-required in the rendered snapshot', async () => {
    const snapshot = await new RhChainLaunchpadSnapshotService(new InMemoryRhChainLaunchpadSnapshotStore(), new InMemoryRhChainSubmissionStore()).refresh();
    const competitor = snapshot.observatory.surfaces.find((surface) => surface.surface_id === 'flap_sh');
    expect(competitor).toMatchObject({ status: 'source_required', source_required: true });
    expect(snapshot.observatory.claim_ledger.find((claim) => claim.surface_id === 'flap_sh')).toMatchObject({ status: 'source_required' });
  });

  it('lets Scout answer launchpad fragmentation from the latest snapshot', async () => {
    const snapshot = await new RhChainLaunchpadSnapshotService(new InMemoryRhChainLaunchpadSnapshotStore(), new InMemoryRhChainSubmissionStore()).refresh();
    const answer = queryRhChainScout({ query: 'What does launchpad fragmentation mean?' }, undefined, snapshot.observatory);
    expect(answer.answer).toContain('Launchpad fragmentation');
    expect(answer.supporting_launch_context.some((surface) => surface.name === 'Pons')).toBe(true);
    expect(answer.generated_at).toBe(snapshot.observatory.generated_at);
  });
});
