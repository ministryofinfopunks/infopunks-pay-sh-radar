// Extends UI-INT2's approved-file hash and pixel policy with immutable response replay,
// measured readiness and paired source captures. Never writes approved references.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { chromium } = require('playwright');
const { PNG } = createRequire(path.resolve(process.env.RADAR_UI_TEST_RUNTIME || '/tmp/radar-ui-int2-qa', 'package.json'))('pngjs');
const out = 'docs/design-system/ui-int3/evidence/visual';
const fixturePath = path.join(out, 'solana-fixture.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath));
const approval = JSON.parse(fs.readFileSync('docs/design-system/ui-int2/visual-approval-completed.json'));
if (approval.status !== 'PASS') throw Error('human_visual_approval_required');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const urls = {
  reference: process.env.RADAR_UI_REFERENCE_URL || 'http://127.0.0.1:5191',
  candidate: process.env.RADAR_UI_BASE_URL || 'http://127.0.0.1:5190'
};
for (const url of Object.values(urls)) if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) throw Error('local_only');
function compare(aBytes, bBytes) {
  const a = PNG.sync.read(aBytes), b = PNG.sync.read(bBytes);
  const dimensions_match = a.width === b.width && a.height === b.height;
  let changed = 0, first_changed_row = null;
  for (let y = 0; y < Math.min(a.height, b.height); y++) for (let x = 0; x < a.width; x++) {
    const i = (y * a.width + x) * 4;
    if (Math.max(...[0, 1, 2].map(j => Math.abs(a.data[i + j] - b.data[i + j]))) > 24) {
      changed++; if (first_changed_row === null) first_changed_row = y;
    }
  }
  return { dimensions_match, reference_height: a.height, candidate_height: b.height,
    changed_fraction: dimensions_match ? changed / (a.width * a.height) : 1,
    first_changed_row, exact_pixel_bytes: dimensions_match && a.data.equals(b.data) };
}
async function tiledScreenshot(page, width, height, filename) {
  // Chrome on this host repeats raster rows above its 16384px capture limit.
  // A bounded clip keeps each capture surface below that limit. Do not change
  // viewport/CSS/content to manufacture a matching document height.
  const merged = new PNG({ width, height });
  const tiles = [];
  for (let y = 0; y < height; y += 4096) {
    const tileHeight = Math.min(4096, height - y);
    const data = await page.screenshot({ clip: { x: 0, y, width, height: tileHeight },
      fullPage: true, animations: 'disabled', caret: 'hide' });
    const tile = PNG.sync.read(data);
    if (tile.width !== width || tile.height !== tileHeight) throw Error('unexpected_tile_dimensions');
    PNG.bitblt(tile, merged, 0, 0, width, tileHeight, 0, y);
    tiles.push({ y, height: tileHeight, sha256: sha(data) });
  }
  const bytes = PNG.sync.write(merged);
  fs.writeFileSync(filename, bytes);
  return { bytes, tiles };
}
async function layout(page) {
  return page.evaluate(() => ({ height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth, viewport: innerWidth, scrollY,
    fonts: document.fonts.status, busy: document.querySelectorAll('main [aria-busy="true"]').length,
    metric_text: document.querySelector('.solana-orientation-summary')?.innerText,
    sections: [...document.querySelectorAll('main section, main article, main > *, main table, .proof-metrics-strip')].map((e, index) => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      return { index, tag: e.tagName, id: e.id, class: String(e.className),
        text: e.textContent, rows: e.querySelectorAll('tbody tr,[role="row"]').length,
        x: r.x, y: r.y, width: r.width, height: r.height,
        display: s.display, grid: s.gridTemplateColumns, flex: s.flexDirection,
        font: s.fontFamily, fontSize: s.fontSize, lineHeight: s.lineHeight,
        overflow: s.overflow, position: s.position };
    }), images: [...document.images].map(e => ({ src: new URL(e.src).pathname,
      complete: e.complete, naturalWidth: e.naturalWidth, naturalHeight: e.naturalHeight })) }));
}
async function settled(page, pending) {
  await page.locator('main h1').waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(e => e.decode().catch(() => {})));
  });
  let previous = '', stable = 0;
  for (let i = 0; i < 100; i++) {
    const current = await layout(page), value = JSON.stringify(current);
    stable = value === previous && pending.size === 0 && current.busy === 0 ? stable + 1 : 0;
    if (stable >= 5) return current;
    previous = value; await page.waitForTimeout(200);
  }
  throw Error('layout_or_requests_not_settled');
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.RADAR_QA_CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const captures = [], comparisons = [], timing = [];
  try {
    for (const width of [1440, 390]) {
      const bytes = {};
      for (const subject of ['reference', 'candidate']) for (const repeat of [1, 2]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 },
          deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'Asia/Colombo', colorScheme: 'light' });
        const page = await context.newPage(), pending = new Set(), unknown = [], seen = [], errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.clock.setFixedTime(new Date('2026-10-13T04:35:52Z'));
        await page.route('**/v1/**', async route => {
          const u = new URL(route.request().url()), key = u.pathname + u.search;
          const response = fixture.responses[key];
          if (!response) { unknown.push(key); return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"unrecorded_visual_response"}' }); }
          // These plan calls are intercepted, never forwarded or executed.
          const method = route.request().method();
          const planOnly = /^\/v1\/radar\/bundles\/(morning-briefing|market-research|talent-market-scanner)\/plan$/.test(key);
          if (method !== response.method || (method !== 'GET' && !(method === 'POST' && planOnly))) {
            unknown.push(method + ':' + key);
            return route.fulfill({ status: 405, contentType: 'application/json', body: '{"error":"visual_replay_method_not_allowed"}' });
          }
          const token = {}; pending.add(token); seen.push(key);
          // A paired slow-response trial proves that headings are not data readiness.
          if (repeat === 2 && key === '/v1/radar/evidence-ledger') {
            timing.push({ subject, width, event: 'ledger_pending', layout: await layout(page) });
            await page.waitForTimeout(1800);
          }
          try { await route.fulfill({ status: response.status, contentType: response.contentType, body: response.body }); } finally { pending.delete(token); }
        });
        // Refuse incidental external network activity, including fonts or images.
        await page.route('**/*', route => {
          const host = new URL(route.request().url()).hostname;
          return ['localhost', '127.0.0.1'].includes(host) ? route.fallback() : route.abort();
        });
        await page.goto(urls[subject] + '/solana');
        const measured = await settled(page, pending);
        await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur(); });
        if (unknown.length || errors.length || measured.width > width || !measured.metric_text?.includes('RECORDED BENCHMARKS')) throw Error('incomplete_visual_workflow:' + JSON.stringify({ unknown, errors, height: measured.height, width: measured.width, metric_text: measured.metric_text }));
        const name = `${subject}-solana-${width}-run${repeat}`;
        const captured = await tiledScreenshot(page, width, measured.height, path.join(out, name + '.png'));
        const data = captured.bytes;
        const after = await layout(page);
        if (JSON.stringify(after) !== JSON.stringify(measured)) throw Error('layout_changed_during_tiled_capture');
        fs.writeFileSync(path.join(out, name + '-layout.json'), JSON.stringify(measured, null, 2) + '\n');
        bytes[subject + repeat] = data;
        captures.push({ subject, width, repeat, file: name + '.png', sha256: sha(data),
          height: measured.height, tiles: captured.tiles, requests: seen, unknown, errors, readiness: 'fonts/images, five stable DOM samples, zero active fixture requests or busy controls; identical layout before/after bounded tile captures' });
        await context.close();
      }
      for (const [a, b] of [['reference1', 'candidate1'], ['reference1', 'reference2'], ['candidate1', 'candidate2']]) {
        const readLayout = key => JSON.parse(fs.readFileSync(path.join(out, `${key.startsWith('reference') ? 'reference' : 'candidate'}-solana-${width}-run${key.slice(-1)}-layout.json`)));
        const layoutA = readLayout(a), layoutB = readLayout(b);
        comparisons.push({ width, pair: [a, b], ...compare(bytes[a], bytes[b]),
          settled_dom_identical: JSON.stringify(layoutA) === JSON.stringify(layoutB),
          first_divergent_element: layoutA.sections.find((s, i) => JSON.stringify(s) !== JSON.stringify(layoutB.sections[i])) ?? null });
      }
      const item = approval.approved_files.find(x => x.file === `loaded-${width === 390 ? 'mobile' : 'desktop'}-solana.png`);
      const golden = fs.readFileSync(path.join('docs/design-system/references/ui-int2-approved-completed', item.file));
      if (sha(golden) !== item.sha256) throw Error('approved_reference_changed');
      comparisons.push({ width, pair: ['immutable-approved-png', 'candidate1'], ...compare(golden, bytes.candidate1),
        status: 'HOLD_SCOPED_BASELINE_APPROVAL_REQUIRED' });
    }
  } finally { await browser.close(); }
  const paired = comparisons.filter(x => !x.pair.includes('immutable-approved-png'));
  const result = { application_sha: 'e0315314264fff395f8e84b37bb6f1984d6b39e7',
    reference_application_sha: approval.source_sha, evidence_sha: 'd3d0a445ec20e8c55170c2fc1f52aff220b2a851',
    browser_version: browser.version(), platform: process.platform, fixture_sha256: sha(fs.readFileSync(fixturePath)),
    configuration: { deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'Asia/Colombo',
      anonymous: true, fixedTime: '2026-10-13T04:35:52Z', fonts: 'same host system fonts and same compiled CSS, no external downloads' },
    captures, comparisons, timing,
    capture_method: '4096px bounded clips at original viewport, stitched without hiding/resizing content; approved originals untouched',
    pixel_policy: 'UI-INT2: dimensions identical and <=0.5% pixels differing by >24 RGB levels; paired DOM must also be identical',
    paired_reproducibility_status: paired.every(x => x.dimensions_match && x.changed_fraction <= 0.005 && x.settled_dom_identical) ? 'PASS' : 'HOLD',
    gate_G2: 'HOLD', baseline_updated: false };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ comparisons, paired_reproducibility_status: result.paired_reproducibility_status, gate_G2: result.gate_G2 }, null, 2));
  process.exitCode = result.paired_reproducibility_status === 'PASS' ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
