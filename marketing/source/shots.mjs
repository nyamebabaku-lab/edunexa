// Captures crisp screenshots of real EduNexa screens for the ad flyers.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:4173/';
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const OUT = new URL('./shots/', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: EXE, args: ['--headless=old', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const shots = [
  ['dashboard', /Administrator/, '#/', 'd'],
  ['students', /Administrator/, '#/students', 'd'],
  ['profile', /Administrator/, '#/students/stu_112', 'd'],
  ['kiosk', /Administrator/, '#/gate/kiosk', 'd'],
  ['gate', /Administrator/, '#/gate', 'd'],
  ['live', /Teacher/, '#/live', 'd'],
  ['reportcards', /Administrator/, '#/report-cards', 'd'],
  ['finance', /Accountant/, '#/finance', 'd'],
  ['canteen', /Canteen/, '#/canteen', 'd'],
  ['timetable', /Administrator/, '#/timetable', 'd'],
  ['m-parent', /Parent/, '#/', 'm'],
  ['m-student', /Student/, '#/', 'm'],
  ['m-dashboard', /Administrator/, '#/', 'm'],
  ['m-fees', /Parent/, '#/my/fees', 'm'],
  ['m-clock', /Teacher/, '#/clock', 'm'],
];
for (const [name, role, hash, kind] of shots) {
  const ctx = await browser.newContext(kind === 'm'
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE);
  await p.getByRole('button', { name: role }).first().click();
  await sleep(1200);
  await p.goto(BASE + hash); await p.reload();
  await p.locator('h1, h2').first().waitFor({ timeout: 15000 }).catch(() => {});
  await sleep(2200);
  await p.screenshot({ path: `${OUT}${name}.png` });
  console.log(name);
  await ctx.close();
}
await browser.close();
