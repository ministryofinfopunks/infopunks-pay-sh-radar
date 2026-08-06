export function markHtmlShellReady() {
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') performance.mark('radar_html_shell_ready');
}

export function installDevelopmentPerformanceSummary() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  window.addEventListener('load', () => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const scripts = resources.filter((entry) => /\.js(?:$|\?)/.test(entry.name));
    const rendered = performance.getEntriesByName('radar_homepage_rendered').at(-1);
    const finished = performance.getEntriesByName('radar_live_status_finished').at(-1) ?? performance.getEntriesByName('radar_live_status_failed').at(-1);
    console.info('[radar performance]', {
      initialRoute: window.location.pathname,
      initialJsChunkBytes: scripts.reduce((total, entry) => total + entry.transferSize, 0),
      routeChunks: scripts.map((entry) => ({ name: new URL(entry.name).pathname.split('/').pop(), bytes: entry.transferSize })),
      homepageRenderMs: rendered?.startTime ?? null,
      liveStatusResolutionMs: finished?.startTime ?? null
    });
  }, { once: true });
}
