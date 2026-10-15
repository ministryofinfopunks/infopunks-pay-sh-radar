// Focused art-direction evidence; screenshot data replays genuine candidate GETs only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(process.env.RADAR_UI_EVIDENCE_DIR || 'docs/ui-unification/visual-corrections/evidence');
const base = process.env.RADAR_UI_BASE_URL || 'http://127.0.0.1:5173';
const phase = process.argv[2] || 'after';
const snapshots = JSON.parse(fs.readFileSync(path.join(root, 'before-api-responses.json'), 'utf8'));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'], executablePath: process.env.RADAR_BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const reports = [];
  try {
    for (const [label, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', colorScheme: 'dark' });
      await page.route('**/v1/**', route => {
        const url = new URL(route.request().url());
        const saved = snapshots[url.pathname + url.search];
        return saved && route.request().method() === 'GET' ? route.fulfill({ status: saved.status, contentType: saved.contentType, body: saved.body }) : route.continue();
      });
      const report = { label, width, screenshots: [] };
      for (const [route, targets] of [
        ['/solana', [['solana-evidence', '.solana-hero-evidence'], ['solana-directory', '.radar-route-directory']]],
        ['/rh-chain-signal-desk', [['robinhood-hero-status', '.rh-v2-intelligence-rail'], ['robinhood-pulse', '.rh-v2-today'], ['robinhood-receipt', '.rh-v2-receipt']]]
      ]) {
        await page.goto(base + route, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        for (const [name, selector] of targets) {
          const file = `${phase}-${name}-${label}.png`;
          const target = page.locator(selector);
          const targetHeight = await target.evaluate(e => e.getBoundingClientRect().height);
          // Fit tall evidence in the capture viewport: Chromium's beyond-viewport
          // locator capture can incorrectly paint offscreen fixed skip links.
          // Width and all product styles remain unchanged; ordinary 844px tiles
          // are captured separately by the existing sections/viewport scripts.
          await page.setViewportSize({ width, height: Math.max(height, Math.ceil(targetHeight) + 32) });
          await target.screenshot({ path: path.join(root, file), animations: 'disabled' });
          await page.setViewportSize({ width, height });
          report.screenshots.push(file);
        }
        if (route === '/solana') {
          report.solana = await page.evaluate(() => {
            const panel = document.querySelector('.solana-hero-evidence');
            const metrics = [...panel.querySelectorAll('dl > div')].map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]);
            const slogan = panel.querySelector('.solana-hero-doctrine');
            return { heading: panel.querySelector('h2').textContent, metrics, source: panel.querySelector('.solana-hero-source-badge, .source-badge').textContent, provenance: panel.querySelector('.solana-hero-provenance').innerText, children: [...panel.children].map(e => e.className), slogan: slogan.textContent, sloganSize: parseFloat(getComputedStyle(slogan).fontSize), metricSize: parseFloat(getComputedStyle(panel.querySelector('dd')).fontSize), directoryCounts: [...document.querySelectorAll('.radar-directory-card-head > span')].map(e => e.textContent) };
          });
          if (phase === 'after') {
            const before = JSON.parse(fs.readFileSync(path.join(root, 'before-corrections-results.json'))).find(x => x.label === label).solana;
            assert.deepEqual(report.solana.metrics, before.metrics);
            assert.equal(report.solana.source, before.source);
            assert.equal(report.solana.provenance, before.provenance.replace(before.source, '').trim());
            assert.equal(report.solana.slogan, before.slogan);
            assert.equal(report.solana.heading, 'Radar coverage / source state');
            assert.ok(report.solana.children[1].includes('solana-hero-source-state'));
            assert.ok(report.solana.children.indexOf('solana-hero-doctrine') > report.solana.children.indexOf('solana-hero-coverage'));
            assert.ok(report.solana.sloganSize < report.solana.metricSize);
            assert.deepEqual(report.solana.directoryCounts, before.directoryCounts.map(x => x + ' surfaces'));
          }
        } else {
          report.robinhood = await page.evaluate(() => {
            const receipt = document.querySelector('.rh-v2-receipt');
            const headline = receipt.querySelector('h2');
            const style = getComputedStyle(headline);
            return { fields: [...receipt.querySelectorAll('.rh-v2-receipt-intelligence article, .rh-v2-receipt-secondary p')].map(e => e.innerText), receiptText: receipt.innerText, headline: headline.textContent, headlineWidth: headline.getBoundingClientRect().width, headlineSize: parseFloat(style.fontSize), headlineLineHeight: parseFloat(style.lineHeight), observationStatuses: [...document.querySelectorAll('.rh-v2-observation-status')].map(e => ({ text: e.innerText, state: e.dataset.state, observedAt: e.querySelector('time')?.dateTime, beforeSignals: Boolean(e.closest('aside') || (e.compareDocumentPosition(document.querySelector('.rh-v2-today-grid')) & Node.DOCUMENT_POSITION_FOLLOWING)) })) };
          });
          if (phase === 'after') {
            const before = JSON.parse(fs.readFileSync(path.join(root, 'before-corrections-results.json'))).find(x => x.label === label).robinhood;
            const receipt = JSON.parse(snapshots['/v1/rh-chain/daily-receipts'].body).data.latest_receipt;
            assert.deepEqual(report.robinhood.fields, before.fields);
            assert.equal(report.robinhood.fields.length, 8);
            assert.equal(report.robinhood.receiptText, before.receiptText);
            assert.equal(report.robinhood.observationStatuses.length, 2);
            for (const status of report.robinhood.observationStatuses) {
              assert.equal(status.state, receipt.freshness_state ?? 'source_required');
              assert.ok(status.beforeSignals);
              assert.ok(status.observedAt);
              if (status.state === 'stale') assert.ok(status.text.includes('Historical observation'));
            }
            if (label === 'desktop') {
              assert.ok(report.robinhood.headlineSize > before.headlineSize);
              assert.ok(report.robinhood.headlineWidth < before.headlineWidth);
            }
          }
        }
      }
      reports.push(report);
      await page.close();
    }
    fs.writeFileSync(path.join(root, `${phase}-corrections-results.json`), JSON.stringify(reports, null, 2) + '\n');
    console.log(JSON.stringify({ phase, viewports: reports.length, focusedCaptures: reports.reduce((n, r) => n + r.screenshots.length, 0), passed: true }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
