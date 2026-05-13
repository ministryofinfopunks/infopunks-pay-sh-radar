import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl, toApiUrl } from '../src/web/apiBaseUrl';

describe('resolveApiBaseUrl', () => {
  it('returns relative-path mode when env var is unset', () => {
    const result = resolveApiBaseUrl({
      envApiBaseUrl: ''
    });

    expect(result).toBe('');
  });

  it('uses configured absolute API base URL when set', () => {
    const result = resolveApiBaseUrl({
      envApiBaseUrl: 'https://api.example.com'
    });

    expect(result).toBe('https://api.example.com');
  });

  it('trims trailing slash on configured base URL', () => {
    const result = resolveApiBaseUrl({
      envApiBaseUrl: 'https://api.example.com///'
    });

    expect(result).toBe('https://api.example.com');
  });
});

describe('toApiUrl', () => {
  it('keeps relative API path when base URL is unset', () => {
    expect(toApiUrl('', '/v1/pulse')).toBe('/v1/pulse');
  });

  it('builds absolute API URL when base URL is set', () => {
    expect(toApiUrl('https://infopunks-pay-sh-radar.onrender.com', '/v1/pulse'))
      .toBe('https://infopunks-pay-sh-radar.onrender.com/v1/pulse');
  });

  it('avoids duplicate slashes between base URL and path', () => {
    expect(toApiUrl(resolveApiBaseUrl({ envApiBaseUrl: 'https://api.example.com/' }), '/v1/pulse'))
      .toBe('https://api.example.com/v1/pulse');
    expect(toApiUrl('https://api.example.com', 'v1/pulse'))
      .toBe('https://api.example.com/v1/pulse');
  });
});
