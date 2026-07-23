import { describe, expect, it } from 'vitest';
import {
  getRhPulseMetadata,
  normalizePublicHostname,
  parseRhPulseRoute,
  resolveRhPulseRequest
} from '../src/shared/rhPulseRouting';

describe('RH Pulse host-aware routing', () => {
  it('maps the Pulse hostname root and structural future routes to the Pulse surface', () => {
    const home = resolveRhPulseRequest({
      pathname: '/',
      host: 'pulse.infopunks.fun',
      isProduction: true
    });
    expect(home).toMatchObject({
      surface: 'rh-pulse',
      isPulseHost: true,
      explicitFallbackPath: false,
      route: { kind: 'home', canonicalPath: '/' }
    });
    expect(parseRhPulseRoute('/calls/call 01', true)).toMatchObject({
      kind: 'call',
      id: 'call 01',
      canonicalPath: '/calls/call%2001'
    });
    expect(parseRhPulseRoute('/receipts/receipt-01', true)).toMatchObject({
      kind: 'receipt',
      id: 'receipt-01'
    });
    expect(parseRhPulseRoute('/resolutions/rhp_window_01', true)).toMatchObject({
      kind: 'resolution',
      id: 'rhp_window_01',
      canonicalPath: '/resolutions/rhp_window_01'
    });
    expect(parseRhPulseRoute('/rh-pulse/rotation-receipts/rotation-01', false)).toMatchObject({
      kind: 'rotation_receipt',
      id: 'rotation-01',
      canonicalPath: '/rotation-receipts/rotation-01'
    });
  });

  it('maps /rh-pulse and methodology regardless of host without changing Radar root', () => {
    expect(resolveRhPulseRequest({
      pathname: '/rh-pulse/methodology',
      host: 'radar.infopunks.fun',
      isProduction: true
    })).toMatchObject({
      surface: 'rh-pulse',
      explicitFallbackPath: true,
      isPulseHost: false,
      route: { kind: 'methodology', canonicalPath: '/methodology' }
    });
    expect(resolveRhPulseRequest({
      pathname: '/',
      host: 'radar.infopunks.fun',
      isProduction: true
    })).toMatchObject({ surface: 'radar', route: null });
  });

  it('trusts forwarded Pulse host only behind a known direct deployment host', () => {
    expect(resolveRhPulseRequest({
      pathname: '/',
      host: 'infopunks-pay-sh-radar.onrender.com',
      forwardedHost: 'pulse.infopunks.fun',
      isProduction: true
    }).surface).toBe('rh-pulse');
    expect(resolveRhPulseRequest({
      pathname: '/',
      host: 'attacker.example',
      forwardedHost: 'pulse.infopunks.fun',
      isProduction: true
    })).toMatchObject({
      surface: 'radar',
      effectiveHost: 'attacker.example'
    });
    expect(resolveRhPulseRequest({
      pathname: '/',
      host: ['radar.infopunks.fun', 'attacker.example'],
      forwardedHost: 'pulse.infopunks.fun',
      isProduction: true
    }).surface).toBe('radar');
  });

  it('never derives canonical URLs from arbitrary request hosts', () => {
    const resolution = resolveRhPulseRequest({
      pathname: '/rh-pulse',
      host: 'attacker.example',
      isProduction: true,
      pulsePublicHost: 'pulse.infopunks.fun'
    });
    const metadata = getRhPulseMetadata(resolution);
    expect(metadata).toMatchObject({
      title: 'RH Pulse | Call the Rotation',
      canonicalUrl: 'https://pulse.infopunks.fun/',
      ogUrl: 'https://pulse.infopunks.fun/',
      themeColor: '#050807'
    });
    expect(JSON.stringify(metadata)).not.toContain('attacker.example');
    expect(normalizePublicHostname('pulse.infopunks.fun:443')).toBe('pulse.infopunks.fun');
    expect(normalizePublicHostname('pulse.infopunks.fun/evil')).toBeNull();
  });

  it('keeps unknown Pulse paths inside an honest Pulse not-found state', () => {
    expect(resolveRhPulseRequest({
      pathname: '/unknown',
      host: 'pulse.infopunks.fun',
      isProduction: true
    })).toMatchObject({
      surface: 'rh-pulse',
      route: { kind: 'not_found', canonicalPath: '/' }
    });
  });

  it('renders canonical verified-call metadata without exposing a full wallet or signature', () => {
    const resolution = resolveRhPulseRequest({
      pathname: '/calls/rhp_call_example',
      host: 'pulse.infopunks.fun',
      isProduction: true
    });
    const metadata = getRhPulseMetadata(resolution, {
      publicCallNumber: 482,
      selectedOutcomeLabel: 'Agents → RWAs',
      walletDisplay: '0x1234…5678',
      recordedAt: '2026-07-23T12:10:00.000Z'
    });
    expect(metadata).toMatchObject({
      title: 'Agents → RWAs | RH Pulse Call #0482',
      canonicalUrl: 'https://pulse.infopunks.fun/calls/rhp_call_example',
      ogUrl: 'https://pulse.infopunks.fun/calls/rhp_call_example',
      ogImageUrl: 'https://pulse.infopunks.fun/v1/rh-pulse/calls/rhp_call_example/share.png',
      twitterCard: 'summary_large_image'
    });
    expect(metadata?.description).toBe(
      'A signed public call on the next structural rotation on Robinhood Chain.'
    );
    expect(JSON.stringify(metadata)).not.toContain('signature');
  });

  it('describes resolved and delayed public calls without claiming a pending state', () => {
    const resolution = resolveRhPulseRequest({
      pathname: '/calls/rhp_call_example',
      host: 'pulse.infopunks.fun',
      isProduction: true
    });
    const base = {
      publicCallNumber: 482,
      selectedOutcomeLabel: 'Memes → Agents',
      walletDisplay: '0x1234…5678',
      recordedAt: '2026-07-23T12:10:00.000Z'
    };
    expect(getRhPulseMetadata(resolution, {
      ...base,
      resolutionStatus: 'correct',
      winningOutcomeLabel: 'Memes → Agents'
    })).toMatchObject({
      title: 'I Called Memes → Agents | RH Pulse',
      description: 'Call #0482 matched RH Pulse Rotation Receipt Memes → Agents.'
    });
    expect(getRhPulseMetadata(resolution, {
      ...base,
      resolutionDelayed: true
    })?.description).toContain('no winner has been published');
  });

  it('renders canonical published-resolution metadata from trusted authority only', () => {
    const resolution = resolveRhPulseRequest({
      pathname: '/resolutions/rhp_window_01',
      host: 'pulse.infopunks.fun',
      isProduction: true
    });
    const metadata = getRhPulseMetadata(resolution, null, {
      windowSequenceNumber: 12,
      outcomeLabel: 'Memes → Agents',
      confidence: 'medium',
      publishedAt: '2026-07-24T12:10:00.000Z'
    });
    expect(metadata).toMatchObject({
      title: 'Memes → Agents Won | RH Pulse Rotation Receipt 012',
      canonicalUrl: 'https://pulse.infopunks.fun/resolutions/rhp_window_01',
      ogUrl: 'https://pulse.infopunks.fun/resolutions/rhp_window_01',
      ogImageUrl: 'https://pulse.infopunks.fun/v1/rh-pulse/resolutions/rhp_window_01/share.png',
      twitterCard: 'summary_large_image'
    });
    expect(metadata?.description).toContain('medium confidence');
    expect(JSON.stringify(metadata)).not.toContain('reviewer');
  });
});
