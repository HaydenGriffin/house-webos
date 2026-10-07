// Renders the README images from demo-mode screenshots. Usage: node render.js <shots dir> <out dir>
// Take the shots first with shots.js (same folder).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const [shots, out] = process.argv.slice(2);
const img = (n) => 'file://' + path.join(shots, n);

const base = `<style>
@font-face { font-family: AHN; src: url(file://${path.resolve(__dirname, '../../app/fonts/ahn-latin.woff2')}); font-weight: 200 800; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: AHN; color: #f4f2ee; background: #0b0c0f; -webkit-font-smoothing: antialiased; }
.canvas { position: relative; overflow: hidden; background: radial-gradient(900px 500px at 75% 10%, #1d2027, transparent 70%),
  radial-gradient(700px 500px at 10% 100%, #15171c, transparent 70%), #0b0c0f; }
.tv { position: relative; padding: 14px; border-radius: 18px; background: linear-gradient(180deg, #2a2c31, #141518);
  box-shadow: 0 0 0 1px #3a3d44 inset, 0 50px 90px -30px rgba(0,0,0,.9), 0 0 120px -20px rgba(255,199,107,.12); }
.tv img { display: block; width: 100%; border-radius: 6px; }
.stand { margin: 0 auto; width: 34%; height: 16px; border-radius: 0 0 10px 10px; background: linear-gradient(180deg, #2a2c31, #17181b); }
.card { border-radius: 18px; overflow: hidden; box-shadow: 0 0 0 1px #24272e, 0 30px 60px -30px rgba(0,0,0,.9); }
.card img { display: block; width: 100%; }
h1 { font-weight: 700; letter-spacing: -.01em; }
.eyebrow { text-transform: uppercase; letter-spacing: .18em; font-size: 15px; font-weight: 600; color: #ffc76b; }
p.lead { color: #b9b4ac; font-size: 22px; line-height: 1.5; }
</style>`;

const hero = `${base}
<div class="canvas" style="width:1600px;height:1010px">
  <div style="position:absolute;left:90px;top:96px;width:1420px;display:flex;justify-content:space-between;align-items:flex-end">
    <div><div class="eyebrow">Home Assistant on an LG TV</div>
      <h1 style="font-size:64px;margin-top:14px">House for webOS</h1></div>
    <p class="lead" style="width:560px;text-align:right">Lights, the TV, music and who’s home, from the sofa with the
      remote. And on Sunday, a recap of your week at home.</p>
  </div>
  <div style="position:absolute;left:250px;top:280px;width:1100px">
    <div class="tv"><img src="${img('panel-00.png')}"></div><div class="stand"></div>
  </div>
</div>`;

const cards = [['recap-01.png', 'Steps, head to head'], ['recap-06.png', 'A quick question'], ['recap-08.png', 'What we ate'],
  ['recap-04.png', 'The energy bill'], ['recap-09.png', 'The vacuum’s week'], ['recap-17.png', 'And the winner is…']];
const grid = `${base}
<div class="canvas" style="width:1600px;height:1010px;padding:84px 90px">
  <div class="eyebrow">Your week at home</div>
  <h1 style="font-size:48px;margin:12px 0 10px">A Wrapped-style recap, every Sunday</h1>
  <p class="lead" style="margin-bottom:44px">Full-screen cards, one idea each, from a stats object any automation can fill.</p>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:36px 30px">
    ${cards.map(([f, t]) => `<div><div class="card"><img src="${img(f)}"></div>
      <p style="margin-top:14px;font-size:20px;color:#b9b4ac">${t}</p></div>`).join('')}
  </div>
</div>`;

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1600, height: 1200 } });
  for (const [name, html] of Object.entries({ 'hero.png': hero, 'recap.png': grid })) {
    const file = path.join(os.tmpdir(), 'house-' + name + '.html');
    fs.writeFileSync(file, html);
    await page.goto('file://' + file);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await (await page.$('.canvas')).screenshot({ path: path.join(out, name) });
    console.log('wrote', name);
  }
  await browser.close();
})();
