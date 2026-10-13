// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startRhChainMarketRevalidation } from '../src/web/rhChainMarketRevalidation';
let stop = () => {};
afterEach(() => { stop(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('market browser revalidation', () => {
  it('does not poll hidden tabs, resumes once when visible, and stops on cleanup', async () => {
    vi.useFakeTimers(); let hidden = true; vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const refresh = vi.fn(async () => {}); stop = startRhChainMarketRevalidation(refresh);
    await vi.advanceTimersByTimeAsync(3 * 60000); expect(refresh).not.toHaveBeenCalled();
    hidden = false; document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000); expect(refresh).toHaveBeenCalledTimes(2);
    stop(); document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(60000); expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('coalesces interval and visibility events during an in-flight request and recovers after rejection', async () => {
    vi.useFakeTimers(); vi.spyOn(document, 'hidden', 'get').mockReturnValue(false); let reject!: (error: Error) => void;
    const refresh = vi.fn(() => new Promise<void>((_, fail) => { reject = fail; })); stop = startRhChainMarketRevalidation(refresh);
    await vi.advanceTimersByTimeAsync(60000); document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(120000);
    expect(refresh).toHaveBeenCalledTimes(1); reject(new Error('provider unavailable')); await Promise.resolve(); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(60000); expect(refresh).toHaveBeenCalledTimes(2);
    reject(new Error('cleanup')); await Promise.resolve();
  });
});
