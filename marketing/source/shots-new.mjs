// Screenshots of the newest EduNexa screens (school bus tracking, gate kiosk, exams…) for flyers 14–16.
// Uses the demo build from `vite preview` (port 4173) with a running bus trip prepared first.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
const BASE = 'http://localhost:4173/demo/';
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: EXE, args: ['--headless=old', '--hide-scrollbars'] });
const geo = { geolocation: { latitude: 5.6290, longitude: -0.1310 }, permissions: ['geolocation'] };

// Prepare: Ama (the demo parent's child) on Route A at Baatsona, morning trip running with her on board.
const prep = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pp = await prep.newPage();
await pp.goto(BASE);
await pp.getByRole('button', { name: /Administrator/ }).first().click();
await sleep(1500);
await pp.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('edunexa-db'));
  const s = st.state;
  const parent = s.users.find((u) => u.role === 'parent');
  const ama = s.students.find((x) => x.parentId === parent.linkedId && x.firstName === 'Ama') || s.students.find((x) => x.parentId === parent.linkedId);
  const route = s.routes.find((r) => r.id === 'rte_01');
  ama.busRouteId = route.id;
  ama.busStopId = route.stopList[2].id;
  const now = new Date();
  const hm = (d) => d.toTimeString().slice(0, 5);
  s.trips.unshift({ id: 'trp_flyer', date: '2026-11-02', // the demo's 'today'
    busId: route.busId, routeId: route.id, routeName: route.name, type: 'Morning pick-up', status: 'Running', startedAt: new Date(now.getTime() - 6 * 60000).toISOString(), departed: hm(new Date(now.getTime() - 6 * 60000)), riders: { [ama.id]: { on: hm(new Date(now.getTime() - 2 * 60000)), stopId: route.stopList[2].id, stopName: route.stopList[2].name } } });
  localStorage.setItem('edunexa-db', JSON.stringify(st));
});
const state = await prep.storageState();
await prep.close();

const shots = [
  ['m-bus-parent', 'parent', '#/transport', 'm'],
  ['m-crew', 'attendant', '#/transport', 'm'],
  ['m-parent-home', 'parent', '#/', 'm'],
  ['kiosk', 'admin', '#/gate/kiosk', 'd'],
  ['gate', 'admin', '#/gate', 'd'],
  ['bus-office', 'admin', '#/transport', 'd'],
  ['exams', 'admin', '#/exams', 'd'],
  ['timetable', 'admin', '#/timetable', 'd'],
];
for (const [name, role, hash, kind] of shots) {
  const ctx = await browser.newContext({
    ...(kind === 'm' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }),
    ...geo, storageState: state,
  });
  const p = await ctx.newPage();
  await p.goto(BASE);
  await p.evaluate((r) => {
    const s = JSON.parse(localStorage.getItem('edunexa-db')).state;
    const u = s.users.find((x) => x.role === r);
    const c = JSON.parse(localStorage.getItem('edunexa-session') || '{"state":{},"version":0}');
    c.state.userId = u.id;
    localStorage.setItem('edunexa-session', JSON.stringify(c));
  }, role);
  await p.goto(BASE + hash);
  await p.reload();
  await p.locator('h1, h2').first().waitFor({ timeout: 15000 }).catch(() => {});
  if (role === 'parent') {
    const sw = p.locator('select[aria-label="Choose child"]');
    if (await sw.count()) await sw.selectOption({ label: await sw.locator('option', { hasText: 'Ama' }).first().innerText() });
  }
  if (name === 'm-crew') {
    await p.getByRole('button', { name: 'Share location from this phone' }).click().catch(() => {});
    await sleep(2500);
  }
  await sleep(name === 'm-bus-parent' || name === 'bus-office' ? 6000 : 2500); // map tiles
  await p.screenshot({ path: `${OUT}${name}.png` });
  console.log(name);
  await ctx.close();
}
await browser.close();
