# Showcase images

The README images come from demo mode (no Home Assistant needed):

```bash
cd tools/showcase
npm install playwright && npx playwright install chromium
mkdir -p /tmp/house-shots
node shots-panel.js ../../app /tmp/house-shots demo panel 1500
node shots-recap.js ../../app /tmp/house-shots 30
node render.js /tmp/house-shots ../../docs/images
```

`render.js` picks specific recap steps by file name (`recap-01.png` and so on), so check them if you change the demo
stats.
