// Steps through the demo week recap by pressing Right, one screenshot per step. Usage: node tvrecap.js <app dir> <out dir> [steps]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [app, out, steps = '24'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.log('ERROR', e.message));
  await page.goto('file://' + path.join(app, 'index.html') + '?demo&recap');
  await page.waitForTimeout(400);
  for (let n = 0; n < +steps; n++) {
    await page.waitForTimeout(2600);
    if (await page.$eval('#recap', (el) => el.hidden)) break;
    await page.screenshot({ path: path.join(out, `recap-${String(n).padStart(2, '0')}.png`) });
    await page.keyboard.press('ArrowRight');
  }
  await browser.close();
})();
