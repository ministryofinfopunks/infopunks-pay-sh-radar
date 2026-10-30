// Native page clip after an explicit paint, including every receipt footer control.
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(path.join(process.cwd(), 'node_modules/playwright'));
(async () => {
  const saved = JSON.parse(fs.readFileSync(path.join(__dirname, 'before-api-responses.json')));
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const report = [];
  try {
    for (const [phase, base] of [['before', 'http://127.0.0.1:5175'], ['after', 'http://127.0.0.1:5173']]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 2500 }, reducedMotion: 'reduce', colorScheme: 'dark' });
      await page.route('**/v1/**', route => {
        const u = new URL(route.request().url()), s = saved[u.pathname + u.search];
        return s && route.request().method() === 'GET' ? route.fulfill({ status: s.status, contentType: s.contentType, body: s.body }) : route.continue();
      });
      await page.goto(base + '/rh-chain-signal-desk', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const clip = await page.locator('.rh-v2-receipt').evaluate(e => {
        const r = e.getBoundingClientRect();
        const clip = { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
        window.scrollTo({ top: clip.y, behavior: 'instant' });
        return clip;
      });
      await page.waitForTimeout(250);
      const file = `receipt-native-${phase}-mobile.png`;
      await page.screenshot({ path: path.join(__dirname, file), clip: { ...clip, y: 0 }, animations: 'disabled' });
      report.push({ phase, base, width: 390, captureViewportHeight: 2500, clip, file, receiptText: await page.locator('.rh-v2-receipt').innerText(), footerVisible: await page.getByRole('link', { name: 'Read full receipt', exact: true }).isVisible() });
      await page.close();
    }
    fs.writeFileSync(path.join(__dirname, 'receipt-native-capture.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report.map(({phase,footerVisible,clip})=>({phase,footerVisible,clip}))));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
