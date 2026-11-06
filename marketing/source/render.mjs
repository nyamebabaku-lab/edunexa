// Renders every .ad section of flyers.html to out/NN-slug.png at 2x (2160x2160).
import { chromium } from 'playwright-core';
import fs from 'fs';
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const dir = new URL('.', import.meta.url).pathname;
const out = process.argv[2] || dir + 'out/';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, args: ['--headless=old'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: Number(process.env.DPR || 2) });
await page.goto('file://' + dir + (process.env.HTML || 'flyers.html'));
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
await page.waitForTimeout(800);
for (const el of await page.$$('section.ad')) {
  const id = await el.getAttribute('id'); const slug = await el.getAttribute('data-slug');
  await el.screenshot({ path: `${out}${id.slice(3)}-${slug}.png` });
}
await browser.close();
console.log(fs.readdirSync(out).join('\n'));
