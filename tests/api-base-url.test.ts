import { describe, expect, it, vi } from 'vitest';
import { PRODUCTION_API_BASE_URL_FALLBACK, resolveApiBaseUrl } from '../src/web/apiBaseUrl';

describe('resolveApiBaseUrl', () => {
  it('uses env var in production when set', () => {
    const warn = vi.fn();
    const result = resolveApiBaseUrl({
      mode: 'production',
      envApiBaseUrl: 'https://api.example.com',
      locationOrigin: 'https://app.example.com',
      warn: { warn }
    });

    expect(result).toBe('https://api.example.com');
    expect(warn).not.toHaveBeenCalled();
  });

  it('uses backend fallback in production when env var missing', () => {
    const warn = vi.fn();
    const result = resolveApiBaseUrl({
      mode: 'production',
      envApiBaseUrl: '',
      locationOrigin: 'https://app.example.com',
      warn: { warn }
    });

    expect(result).toBe(PRODUCTION_API_BASE_URL_FALLBACK);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain('VITE_API_BASE_URL is missing in production');
  });

  it('keeps local development behavior', () => {
    const warn = vi.fn();
    const result = resolveApiBaseUrl({
      mode: 'development',
      envApiBaseUrl: '',
      locationOrigin: 'http://localhost:5173',
      warn: { warn }
    });

    expect(result).toBe('http://localhost:5173');
    expect(warn).not.toHaveBeenCalled();
  });
});
