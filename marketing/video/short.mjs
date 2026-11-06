// Vertical (9:16) ~60 s "What's new" clip for WhatsApp Status / TikTok / Reels, recorded in the app's phone layout.
import { chromium } from 'playwright-core';
import { mkdirSync, readdirSync, renameSync, rmSync, readFileSync, writeFileSync } from 'fs';
const BASE = 'http://localhost:4173/demo/';
const OUT = new URL('./short/', import.meta.url).pathname;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const VW = 405, VH = 720; // CSS pixels; recorded at 1080x1920
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome', args: ['--headless=old', '--hide-scrollbars'] });
const phone = { viewport: { width: VW, height: VH }, deviceScaleFactor: 1080 / VW, isMobile: true, hasTouch: true, geolocation: { latitude: 5.6300, longitude: -0.1300 }, permissions: ['geolocation'] };

// ---------------- setup off camera: Ama on Route A at Baatsona, the attendant starts the morning trip and ticks her on
{
  const ctx = await b.newContext(phone);
  const p = await ctx.newPage();
  await p.goto(BASE);
  await p.waitForTimeout(1500);
  await p.getByRole('button', { name: /Administrator/ }).first().click();
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const k = 'edunexa-db';
    const st = JSON.parse(localStorage.getItem(k));
    const s = st.state;
    const parent = s.users.find((u) => u.role === 'parent');
    const ama = s.students.find((x) => x.parentId === parent.linkedId && x.firstName === 'Ama') || s.students.find((x) => x.parentId === parent.linkedId);
    const route = s.routes.find((r) => r.id === 'rte_01');
    ama.busRouteId = route.id;
    ama.busStopId = route.stopList[2].id;
    const now = new Date();
    s.trips.unshift({ id: 'trp_demo', date: now.toISOString().slice(0, 10), busId: route.busId, routeId: route.id, routeName: route.name, type: 'Morning pick-up', status: 'Running', startedAt: new Date(now.getTime() - 5 * 60000).toISOString(), departed: now.toTimeString().slice(0, 5), riders: { [ama.id]: { on: now.toTimeString().slice(0, 5), stopId: route.stopList[2].id, stopName: route.stopList[2].name } } });
    localStorage.setItem(k, JSON.stringify(st));
  });
  await ctx.storageState({ path: OUT + 'state.json' });
  await ctx.close();
}

const ctx = await b.newContext({ ...phone, storageState: OUT + 'state.json', recordVideo: { dir: OUT, size: { width: 1080, height: 1920 } } });
await ctx.addInitScript(() => {
  const css = `
  #tc{position:fixed;z-index:2147483647;left:0;top:0;width:20px;height:20px;pointer-events:none;transform:translate(-3px,-2px)}
  #tc.down::after{content:'';position:absolute;left:-10px;top:-10px;width:40px;height:40px;border-radius:9999px;background:rgba(225,29,72,.4);animation:tp .45s ease-out}
  @keyframes tp{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
  #cap{position:fixed;z-index:2147483646;left:12px;right:12px;top:58px;transform:translateY(-14px);opacity:0;transition:all .4s ease;
    background:rgba(6,12,34,.94);color:#fff;border-radius:18px;padding:12px 14px;box-shadow:0 12px 30px rgba(0,0,0,.35);
    font-family:'Plus Jakarta Sans',system-ui,sans-serif;pointer-events:none}
  #cap.show{opacity:1;transform:translateY(0)}
  #cap .tag{display:inline-block;background:#e11d48;color:#fff;font-weight:800;font-size:10px;letter-spacing:.14em;padding:3px 7px;border-radius:6px;margin-bottom:6px}
  #cap .t{font-weight:800;font-size:21px;line-height:1.15}
  #cap .s{font-size:13.5px;color:#cbd5e1;margin-top:4px;line-height:1.3}
  #card{position:fixed;inset:0;z-index:2147483645;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:24px;
    background:radial-gradient(circle at 30% 10%,#1d43d8 0,#0a1330 55%,#060c22 100%);color:#fff;font-family:'Plus Jakarta Sans',system-ui,sans-serif;opacity:0;transition:opacity .5s;pointer-events:none}
  #card.show{opacity:1}
  #card h1{font-size:40px;font-weight:800;margin:18px 0 6px;letter-spacing:-.02em;line-height:1.05}
  #card h1 b{color:#f43f5e}
  #card p{font-size:17px;color:#cbd5e1;margin:6px 0;line-height:1.35}
  #card ul{list-style:none;padding:0;margin:22px 0 0;display:flex;flex-direction:column;gap:9px;font-size:16px;color:#e2e8f0;text-align:left}
  #card li{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px 14px;display:flex;align-items:center;gap:10px}
  #card li::before{content:'';width:9px;height:9px;border-radius:9999px;background:#f43f5e;flex:none}
  #card .url{margin-top:22px;font-weight:800;font-size:18px;color:#fff;background:#e11d48;border-radius:14px;padding:10px 16px}
  `;
  const add = () => {
    if (document.getElementById('tc')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const c = document.createElement('div'); c.id = 'tc';
    c.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#0f172a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    c.style.left = '-50px';
    document.body.appendChild(c);
    for (const id of ['cap', 'card']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); }
    const move = (x, y) => { c.style.left = x + 'px'; c.style.top = y + 'px'; };
    addEventListener('mousemove', (e) => move(e.clientX, e.clientY), true);
    addEventListener('touchstart', (e) => { const t = e.touches[0]; move(t.clientX, t.clientY); c.classList.remove('down'); void c.offsetWidth; c.classList.add('down'); }, true);
    addEventListener('mousedown', () => { c.classList.remove('down'); void c.offsetWidth; c.classList.add('down'); }, true);
  };
  window.__cap = (t, s, tag = 'NEW') => { add(); const el = document.getElementById('cap'); if (!t) return el.classList.remove('show'); el.innerHTML = `${tag ? `<span class="tag">${tag}</span>` : ''}<div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}`; el.classList.add('show'); };
  window.__card = (html) => { add(); const el = document.getElementById('card'); if (!html) return el.classList.remove('show'); el.innerHTML = html; el.classList.add('show'); };
  const cover = () => {
    if (sessionStorage.getItem('cover') !== '1') return;
    add();
    const el = document.getElementById('card');
    el.style.transition = 'none';
    el.innerHTML = '<svg width="78" height="78" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d43d8"/><stop offset="1" stop-color="#3b74f6"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g)"/><path d="M18 42 L50 27 L82 42 L50 57 Z" fill="#fff"/><path d="M30 50 V62 Q50 72 70 62 V50 L50 59 Z" fill="#fff"/><rect x="73.5" y="42" width="3" height="24" fill="#e11d48"/><circle cx="75" cy="68" r="3.5" fill="#e11d48"/></svg>';
    el.classList.add('show');
    requestAnimationFrame(() => (el.style.transition = ''));
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => { add(); cover(); }); else { add(); cover(); }
});
const p = await ctx.newPage();
const T0 = Date.now();
const wait = (ms) => p.waitForTimeout(ms);
const DUR = JSON.parse(readFileSync(new URL('./voice-short/durations.json', import.meta.url)));
const marks = [];
let cur = null;
// A scene lasts as long as its narration (plus a short breath), however quick its actions are.
async function finish() {
  if (!cur) return;
  const need = (DUR[cur.id] || 0) * 1000 + 450;
  const el = Date.now() - cur.at;
  if (el < need) await wait(need - el);
}
async function scene(id) {
  await finish();
  cur = { id, at: Date.now() };
  marks.push({ id, at: (Date.now() - T0) / 1000 });
}
const cap = (t, s, tag = 'NEW') => p.evaluate(([a, b2, c]) => window.__cap(a, b2, c), [t, s, tag]);
const card = (h) => p.evaluate((x) => window.__card(x), h);
let mx = 200, my = 400;
async function tap(loc, pause = 700) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const bx = await loc.boundingBox();
  if (bx) { const x = bx.x + bx.width / 2, y = bx.y + bx.height / 2; await p.mouse.move(x, y, { steps: Math.max(10, Math.round(Math.hypot(x - mx, y - my) / 18)) }); mx = x; my = y; await wait(200); }
  await loc.click();
  await wait(pause);
}
const dlg = () => p.getByRole('dialog').last();
// Switch person without showing the sign-in page.
async function as(role, path) {
  await p.evaluate((r) => {
    const s = JSON.parse(localStorage.getItem('edunexa-db')).state;
    const u = s.users.find((x) => x.role === r);
    const k = 'edunexa-session';
    const c = JSON.parse(localStorage.getItem(k) || '{"state":{},"version":0}');
    c.state.userId = u.id;
    localStorage.setItem(k, JSON.stringify(c));
  }, role);
  await p.evaluate(() => sessionStorage.setItem('cover', '1'));
  await card('<svg width="78" height="78" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#1d43d8"/></svg>');
  await wait(350);
  await p.goto(BASE + '#' + path);
  await p.reload();
  // wait until the screen has its content, then lift the cover
  await p.waitForFunction(() => (document.querySelector('main')?.innerText || '').trim().length > 40 && !document.querySelector('main .animate-spin'), null, { timeout: 15000 }).catch(() => {});
  await wait(350);
  await p.evaluate(() => sessionStorage.removeItem('cover'));
  await card(null);
  await wait(450);
}
const LOGO = '<svg width="78" height="78" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d43d8"/><stop offset="1" stop-color="#3b74f6"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g)"/><path d="M18 42 L50 27 L82 42 L50 57 Z" fill="#fff"/><path d="M30 50 V62 Q50 72 70 62 V50 L50 59 Z" fill="#fff"/><rect x="73.5" y="42" width="3" height="24" fill="#e11d48"/><circle cx="75" cy="68" r="3.5" fill="#e11d48"/></svg>';

// 1. title (shown before the app is visible)
await p.goto(BASE + '#/');
await card(`${LOGO}<h1>Edu<b>Nexa</b><br>what's new</h1><p>The school app for Ghanaian schools</p>`);
await as('parent', '/transport');
await p.evaluate(() => window.__card(`${document.getElementById('card')?.innerHTML || ''}`));
await card(`${LOGO}<h1>Edu<b>Nexa</b><br>what's new</h1><p>The school app for Ghanaian schools</p>`);
await scene('s01');
const sw = p.locator('select[aria-label="Choose child"]');
if (await sw.count()) await sw.selectOption({ label: await sw.locator('option', { hasText: 'Ama' }).first().innerText() });

// 2. parent: live bus
await scene('s02');
await card(null);
await wait(500);
await cap('Watch the school bus live', 'See the bus on the map while it drives your child\'s route');
await scene('s03');
await cap('"5 minutes away" alerts', 'Plus "got on the bus" and "dropped off" — and one tap to call the driver or attendant');
await wait(1500);
await p.mouse.wheel(0, 520);

// 3. bus attendant
await scene('s04');
await as('attendant', '/transport');
await cap('Driver & bus attendant app', 'Both phones share the bus location — the attendant ticks children on and off at each stop');
await wait(1500);
await p.mouse.wheel(0, 380);

// 4. timetable
await scene('s05');
await as('admin', '/timetable');
await cap('Timetable in one tap', 'Fair share for every subject, never twice in a row, no teacher clashes — with Undo');
await wait(1200);
await tap(p.getByRole('button', { name: /automatically/ }), 900);
await tap(dlg().getByRole('button', { name: /New arrangement/ }), 1800);
await p.mouse.wheel(0, 220);

// 5. exams
await scene('s06');
await as('admin', '/exams');
await cap('Exam timetables', 'Papers, rooms and invigilators — clashes caught, published to students & parents');
await wait(1500);
await p.mouse.wheel(0, 300);

// 6. marks
await scene('s07');
await as('admin', '/gradebook');
await cap('Marks by subject teacher', 'Find a student by name or admission number — teachers only mark the subjects they teach');
await tap(p.getByRole('button', { name: 'One student' }), 400);
const q = p.getByPlaceholder('Admission no. or name');
await tap(q, 100);
await q.pressSequentially('Kofi', { delay: 70 });
await wait(400);
await tap(p.getByRole('button', { name: /Kofi/ }).first(), 800);

// 7. billing
await scene('s08');
await as('admin', '/finance');
await tap(p.getByRole('button', { name: 'Fee structures' }), 400);
await cap('Billing that fits your school', 'Admission fee for new students · transport & boarding only for users · extra charges & discounts');
await wait(1800);
await p.mouse.wheel(0, 360);

// 8. terms & houses
await scene('s09');
await as('admin', '/classes');
await tap(p.getByRole('button', { name: /^Terms/ }), 300);
await cap('Terms, classes & houses', 'Term lengths worked out from the dates · every GES class and subject set up for new schools');

// 9. parents join + live classes (one card)
await scene('s10');
await as('admin', '/');
await cap('And much more', 'Parents link their own children · two guardians per child · gate kiosk ticks registers · teacher-only live classes', 'ALSO');

// 10. end
await scene('s11');
await cap(null);
await card(`${LOGO}<h1>Edu<b>Nexa</b></h1><p>Run your whole school from one app</p><ul><li>Live school bus tracking</li><li>Exam & lesson timetables</li><li>Fees, marks, attendance</li></ul><div class="url">Try the free demo</div><p style="margin-top:10px;font-size:15px">nyamebabaku-lab.github.io/edunexa/demo</p>`);
await finish();
await wait(1200);
writeFileSync(OUT + 'marks.json', JSON.stringify(marks, null, 1));
await ctx.close();
await b.close();
const f = readdirSync(OUT).filter((x) => x.endsWith('.webm')).map((x) => OUT + x);
renameSync(f[f.length - 1], OUT + 'short.webm');
console.log('recorded', OUT + 'short.webm');
