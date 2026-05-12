const { chromium, devices } = require('playwright');

const url = 'https://radar.infopunks.fun/';

async function capture(name, viewport, scrollY, fullPage = false) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `radar-screenshots/${name}.png`,
    fullPage
  });
  await browser.close();
}

(async () => {
  await capture('mobile-top', { width: 390, height: 844 }, 0);
  await capture('mobile-middle-provider', { width: 390, height: 844 }, 900);
  await capture('mobile-lower-telemetry', { width: 390, height: 844 }, 1800);
  await capture('mobile-full', { width: 390, height: 844 }, 0, true);

  await capture('desktop-top', { width: 1440, height: 1000 }, 0);
  await capture('desktop-middle-provider', { width: 1440, height: 1000 }, 800);
  await capture('desktop-lower-telemetry', { width: 1440, height: 1000 }, 1600);
  await capture('desktop-full', { width: 1440, height: 1000 }, 0, true);
})();
