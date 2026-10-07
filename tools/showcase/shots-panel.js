// Screenshots of House for webOS in demo mode. Usage: node tv.js <app dir> <out dir> [query] [name] [waits...]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [app, out, query = 'demo', name = 'panel', ...waits] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/config\.js/.test(m.text())) errors.push(m.text()); });
  await page.goto('file://' + path.join(app, 'index.html') + '?' + query);
  const times = waits.length ? waits.map(Number) : [1200];
  let n = 0, last = 0;
  for (const t of times) {
    await page.waitForTimeout(t - last); last = t;
    await page.screenshot({ path: path.join(out, `${name}-${String(n++).padStart(2, '0')}.png`) });
  }
  if (errors.length) console.log('ERRORS:', errors.join('\n'));
  await browser.close();
})();
