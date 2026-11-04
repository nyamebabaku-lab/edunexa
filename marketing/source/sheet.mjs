// Contact sheet of rendered ads: node sheet.mjs <dir> <out.png> [cols] [tile]
import { chromium } from 'playwright-core';
import fs from 'fs';
const [dir, outFile, cols = 4, tile = 540] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const browser = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome', args: ['--headless=old'] });
const page = await browser.newPage({ viewport: { width: cols * (+tile + 16) + 16, height: 400 } });
fs.writeFileSync(dir + '/../_sheet.html', `<body style="margin:0;padding:16px;background:#1f2430;display:grid;grid-template-columns:repeat(${cols},${tile}px);gap:16px">${files.map((f) => `<img src="file://${dir}/${f}" style="width:${tile}px;height:${tile}px;border-radius:12px">`).join('')}</body>`);
await page.goto('file://' + dir + '/../_sheet.html');
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();
