// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RhPulseShareActions } from '../src/web/rhPulse/RhPulseShareActions';
import {
  buildRhPulseXIntentUrl,
  buildRhPulseXShareCopy,
  type RhPulseShareDescriptor
} from '../src/web/rhPulse/rhPulseShare';

describe('RH Pulse share actions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('builds editable X intent copy from immutable labels and the canonical public URL', () => {
    const descriptor = shareDescriptor('signed_call');
    const intent = new URL(buildRhPulseXIntentUrl(descriptor));
    expect(intent.origin).toBe('https://x.com');
    expect(intent.pathname).toBe('/intent/post');
    expect(intent.searchParams.get('text')).toBe(buildRhPulseXShareCopy(descriptor));
    expect(intent.searchParams.get('text')).toContain('Agents → RWAs');
    expect(intent.searchParams.get('text')).toContain('https://pulse.infopunks.fun/calls/rhp_call_sharefixture001');
    expect(intent.searchParams.get('text')).toContain('#RHPulse');
  });

  it('renders a compact mobile action hierarchy and safe deterministic filenames', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<RhPulseShareActions descriptor={shareDescriptor('correct_call')} resolvedCorrect />);
    });
    const links = [...container.querySelectorAll<HTMLAnchorElement>('a')];
    expect(links.find(({ textContent }) => textContent === 'Post “I Called It” to X')?.target)
      .toBe('_blank');
    expect(links.find(({ textContent }) => textContent === 'Save Called It Card')?.download)
      .toBe('rh-pulse-called-it-0482.png');
    expect(links.find(({ textContent }) => textContent?.includes('Save Portrait Card'))?.download)
      .toBe('rh-pulse-called-it-0482-portrait.png');
    expect(container.querySelector('[role="status"]')?.textContent)
      .toContain('explicit action');
  });

  it('uses the native share sheet without requiring a card file', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: nativeShare
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: vi.fn().mockReturnValue(false)
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('renderer unavailable', {
      status: 503
    }));
    await act(async () => {
      root = createRoot(container);
      root.render(<RhPulseShareActions descriptor={shareDescriptor('signed_call')} />);
    });
    const shareButton = [...container.querySelectorAll('button')]
      .find(({ textContent }) => textContent === 'Share')!;
    await act(async () => {
      shareButton.click();
    });
    expect(nativeShare).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('Agents → RWAs'),
      url: 'https://pulse.infopunks.fun/calls/rhp_call_sharefixture001'
    }));
    expect(nativeShare.mock.calls[0]?.[0]).not.toHaveProperty('files');
    expect(container.querySelector('[role="status"]')?.textContent)
      .toContain('Native share sheet opened');
  });

  it('falls back honestly when Web Share or clipboard access is unavailable', async () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined
    });
    await act(async () => {
      root = createRoot(container);
      root.render(<RhPulseShareActions descriptor={shareDescriptor('incorrect_call')} resolvedIncorrect />);
    });
    const buttons = [...container.querySelectorAll('button')];
    await act(async () => {
      buttons.find(({ textContent }) => textContent === 'Share')!.click();
    });
    expect(container.querySelector('[role="status"]')?.textContent)
      .toContain('Native sharing is unavailable');
    await act(async () => {
      buttons.find(({ textContent }) => textContent === 'Copy Receipt Link')!.click();
    });
    expect(container.querySelector('[role="status"]')?.textContent)
      .toContain('Clipboard access is unavailable');
  });

  it('copies the trusted resolution URL and emits only bounded analytics properties', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    const events: unknown[] = [];
    const listener = (event: Event) => {
      events.push((event as CustomEvent).detail);
    };
    window.addEventListener('infopunks:rh-pulse-share', listener);
    const descriptor = shareDescriptor('rotation_result');
    try {
      await act(async () => {
        root = createRoot(container);
        root.render(<RhPulseShareActions descriptor={descriptor} resolution />);
      });
      await act(async () => {
        [...container.querySelectorAll('button')]
          .find(({ textContent }) => textContent === 'Copy Resolution Link')!
          .click();
      });
      expect(writeText).toHaveBeenCalledWith(descriptor.canonicalUrl);
      expect(JSON.stringify(events)).not.toContain('0x');
      expect(JSON.stringify(events)).not.toContain('signature');
      expect(events).toContainEqual(expect.objectContaining({
        event: 'rh_pulse_receipt_link_copied',
        artifact_type: 'rotation_result',
        success: 'success'
      }));
    } finally {
      window.removeEventListener('infopunks:rh-pulse-share', listener);
    }
  });
});

function shareDescriptor(
  artifactType: RhPulseShareDescriptor['artifactType']
): RhPulseShareDescriptor {
  const resolution = artifactType === 'rotation_result'
    || artifactType === 'no_qualified_rotation';
  const resolved = resolution || artifactType === 'correct_call' || artifactType === 'incorrect_call';
  const callNumber = resolution ? null : 482;
  return {
    artifactType,
    callOutcome: resolution ? null : 'agents_to_rwas',
    callOutcomeLabel: resolution ? null : 'Agents → RWAs',
    winningOutcome: resolved ? 'memes_to_agents' : null,
    winningOutcomeLabel: resolved ? 'Memes → Agents' : null,
    publicCallNumber: callNumber,
    windowSequenceNumber: 12,
    communityCorrectPercentage: resolution ? 25 : null,
    communityTotalVerifiedCalls: resolution ? 100 : null,
    canonicalUrl: resolution
      ? 'https://pulse.infopunks.fun/resolutions/rhp_window_sharefixture001'
      : 'https://pulse.infopunks.fun/calls/rhp_call_sharefixture001',
    landscapePath: resolution
      ? '/v1/rh-pulse/resolutions/rhp_window_sharefixture001/share.png'
      : '/v1/rh-pulse/calls/rhp_call_sharefixture001/share.png',
    portraitPath: resolution
      ? '/v1/rh-pulse/resolutions/rhp_window_sharefixture001/share-portrait.png'
      : '/v1/rh-pulse/calls/rhp_call_sharefixture001/share-portrait.png',
    landscapeFilename: resolution
      ? 'rh-pulse-rotation-receipt-012.png'
      : artifactType === 'correct_call'
        ? 'rh-pulse-called-it-0482.png'
        : 'rh-pulse-call-0482.png',
    portraitFilename: resolution
      ? 'rh-pulse-rotation-receipt-012-portrait.png'
      : artifactType === 'correct_call'
        ? 'rh-pulse-called-it-0482-portrait.png'
        : 'rh-pulse-call-0482-portrait.png',
    genesis: !resolution
  };
}
