/** Visible tabs revalidate once per minute; resume is immediate and overlapping requests coalesce. */
export function startRhChainMarketRevalidation(refresh: () => Promise<unknown> | void, intervalMs = 60_000) {
  let active = true, pending = false;
  const tick = async () => {
    if (!active || pending || document.hidden) return;
    pending = true;
    try { await refresh(); } catch { /* Last-known evidence remains stamped; failures never refresh its age. */ }
    finally { pending = false; }
  };
  const timer = window.setInterval(() => { void tick(); }, intervalMs);
  const resume = () => { if (!document.hidden) void tick(); };
  document.addEventListener('visibilitychange', resume);
  return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
}
