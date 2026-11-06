// EduNexa "What's new" tour video: drives the demo app with a visible pointer and on-screen captions, recorded by Playwright.
import { chromium } from 'playwright-core';
import { mkdirSync, readdirSync, renameSync } from 'fs';
const BASE = 'http://localhost:4173/demo/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const W = 1280, H = 720;
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome', args: ['--headless=old', '--hide-scrollbars'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: { width: W, height: H } }, geolocation: { latitude: 5.6300, longitude: -0.1300 }, permissions: ['geolocation'] });

// Pointer, captions and title cards live in the page (re-added after every reload).
await ctx.addInitScript(() => {
  const css = `
  #tour-cursor{position:fixed;z-index:2147483647;left:0;top:0;width:26px;height:26px;pointer-events:none;transform:translate(-4px,-3px);transition:transform .05s}
  #tour-cursor.down::after{content:'';position:absolute;left:-9px;top:-9px;width:44px;height:44px;border-radius:9999px;background:rgba(225,29,72,.35);animation:tp .45s ease-out}
  @keyframes tp{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
  #tour-cap{position:fixed;z-index:2147483646;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);opacity:0;transition:all .45s ease;
    background:rgba(6,12,34,.92);color:#fff;border-radius:18px;padding:14px 22px 14px 18px;max-width:900px;box-shadow:0 12px 40px rgba(0,0,0,.35);
    font-family:'Plus Jakarta Sans',system-ui,sans-serif;display:flex;gap:14px;align-items:center;pointer-events:none}
  #tour-cap.show{opacity:1;transform:translateX(-50%) translateY(0)}
  #tour-cap .tag{background:#e11d48;color:#fff;font-weight:800;font-size:12px;letter-spacing:.12em;padding:5px 9px;border-radius:8px;white-space:nowrap}
  #tour-cap .t{font-weight:800;font-size:22px;line-height:1.2}
  #tour-cap .s{font-size:15px;color:#cbd5e1;margin-top:3px}
  #tour-card{position:fixed;inset:0;z-index:2147483645;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;
    background:radial-gradient(circle at 20% 15%,#1d43d8 0,#0a1330 55%,#060c22 100%);color:#fff;font-family:'Plus Jakarta Sans',system-ui,sans-serif;opacity:0;transition:opacity .6s;pointer-events:none}
  #tour-card.show{opacity:1}
  #tour-card h1{font-size:64px;font-weight:800;margin:22px 0 8px;letter-spacing:-.02em}
  #tour-card h1 b{color:#f43f5e}
  #tour-card p{font-size:24px;color:#cbd5e1;margin:6px 0}
  #tour-card ul{list-style:none;padding:0;margin:26px 0 0;display:grid;grid-template-columns:repeat(3,auto);gap:12px 18px;font-size:19px;color:#e2e8f0}
  #tour-card li{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px 16px 10px 14px;display:flex;align-items:center;gap:10px}
  #tour-card li::before{content:'';width:10px;height:10px;border-radius:9999px;background:#f43f5e;flex:none}
  `;
  const add = () => {
    if (document.getElementById('tour-cursor')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const c = document.createElement('div'); c.id = 'tour-cursor';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#0f172a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const cap = document.createElement('div'); cap.id = 'tour-cap'; document.body.appendChild(cap);
    const card = document.createElement('div'); card.id = 'tour-card'; document.body.appendChild(card);
    const pos = JSON.parse(sessionStorage.getItem('tour-pos') || '[640,360]');
    c.style.left = pos[0] + 'px'; c.style.top = pos[1] + 'px';
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; sessionStorage.setItem('tour-pos', JSON.stringify([e.clientX, e.clientY])); }, true);
    addEventListener('mousedown', () => { c.classList.remove('down'); void c.offsetWidth; c.classList.add('down'); }, true);
  };
  window.__cap = (t, s, tag = 'NEW') => {
    add();
    const el = document.getElementById('tour-cap');
    if (!t) return el.classList.remove('show');
    el.innerHTML = `${tag ? `<span class="tag">${tag}</span>` : ''}<div><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
    el.classList.add('show');
  };
  window.__card = (html) => {
    add();
    const el = document.getElementById('tour-card');
    const cur = document.getElementById('tour-cursor');
    if (!html) { cur.style.visibility = 'visible'; return el.classList.remove('show'); }
    el.innerHTML = html;
    el.classList.add('show');
    cur.style.visibility = 'hidden';
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add); else add();
});

const p = await ctx.newPage();
const wait = (ms) => p.waitForTimeout(ms);
const cap = async (t, s, tag) => { await p.evaluate(([a, b2, c]) => window.__cap(a, b2, c), [t, s, tag === undefined ? 'NEW' : tag]); };
const nocap = () => p.evaluate(() => window.__cap(null));
const card = (html) => p.evaluate((h) => window.__card(h), html);
let mx = 640, my = 360;
async function moveTo(loc) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const bx = await loc.boundingBox();
  if (!bx) return;
  const x = bx.x + bx.width / 2, y = bx.y + bx.height / 2;
  const steps = Math.max(12, Math.round(Math.hypot(x - mx, y - my) / 22));
  await p.mouse.move(x, y, { steps });
  mx = x; my = y;
  await wait(250);
}
async function click(loc, pause = 700) {
  await moveTo(loc);
  await loc.click();
  await wait(pause);
}
async function type(loc, text, pause = 300) {
  await click(loc, 150);
  await loc.fill('');
  await loc.pressSequentially(text, { delay: 45 });
  await wait(pause);
}
const dlg = () => p.getByRole('dialog').last();
async function as(label) {
  await p.evaluate(() => { const k = 'edunexa-session'; const c = JSON.parse(localStorage.getItem(k) || '{"state":{}}'); c.state.userId = null; localStorage.setItem(k, JSON.stringify(c)); });
  await p.goto(BASE + '#/');
  await p.reload();
  await wait(700);
  await cap(`Signing in as the ${label === 'Parent' ? 'parent' : label === 'Bus Attendant' ? 'bus attendant' : label}`, 'Every role gets its own view of the app', 'DEMO');
  await wait(1500);
  await click(p.getByRole('button', { name: new RegExp(label) }).first(), 1200);
}
async function go(path, pause = 1400) {
  await p.goto(BASE + path);
  await wait(pause);
}
async function scrollBy(y, ms = 1200) {
  await p.mouse.wheel(0, y);
  await wait(ms);
}

const LOGO = '<svg width="96" height="96" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d43d8"/><stop offset="1" stop-color="#3b74f6"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g)"/><path d="M18 42 L50 27 L82 42 L50 57 Z" fill="#fff"/><path d="M30 50 V62 Q50 72 70 62 V50 L50 59 Z" fill="#fff"/><rect x="73.5" y="42" width="3" height="24" fill="#e11d48"/><circle cx="75" cy="68" r="3.5" fill="#e11d48"/></svg>';

// ---------------------------------------------------------------- intro
await p.goto(BASE);
await card(`${LOGO}<h1>Edu<b>Nexa</b> — what's new</h1><p>The complete school app for Ghanaian schools</p><ul><li>Live school bus tracking</li><li>Exam timetables</li><li>Smart timetables</li><li>Fair, flexible billing</li><li>Parents link their own children</li><li>Teacher-only marks & live classes</li></ul>`);
await wait(5200);
await card(null);
await wait(800);

// ---------------------------------------------------------------- front page
await cap('Your school, front and centre', 'Each school uploads its own photo — blended into the sign-in page and dashboard automatically');
await wait(4200);
await click(p.getByRole('button', { name: /Administrator/ }).first(), 1500);
await cap('A welcome with your school photo', 'The current term card now shows the real term and week from your term dates');
await moveTo(p.getByText('Current term', { exact: true }).first());
await wait(3800);

// ---------------------------------------------------------------- terms & houses
await go('#/classes');
await cap('Classes, subjects, terms and houses', 'New schools get every GES class and subject automatically — add, edit or delete any');
await wait(2600);
await click(p.getByRole('button', { name: /^Terms/ }));
await cap('Term editor', 'Add terms with their dates — the length in weeks and the holidays are worked out for you');
await click(p.getByRole('button', { name: 'Add term' }).first(), 900);
await moveTo(dlg().locator('input[type=date]').nth(0));
await dlg().locator('input[type=date]').nth(0).fill('2027-09-06');
await moveTo(dlg().locator('input[type=date]').nth(1));
await dlg().locator('input[type=date]').nth(1).fill('2027-12-10');
await moveTo(dlg().getByText('13 weeks 5 days'));
await wait(2200);
await click(dlg().getByRole('button', { name: 'Cancel' }), 600);
await click(p.getByRole('button', { name: /^Houses/ }));
await cap('School houses', 'Create, rename or delete houses with their colours and house masters');
await wait(3600);

// ---------------------------------------------------------------- timetable
await go('#/timetable');
await p.locator('select').first().selectOption({ label: 'JHS 2' });
await cap('Timetable in one tap', 'Every subject gets a fair share, never twice in a row, with no teacher clashes');
await wait(2000);
await click(p.getByRole('button', { name: /automatically/ }));
await moveTo(dlg().getByRole('button', { name: /New arrangement/ }));
await wait(1600);
await click(dlg().getByRole('button', { name: /New arrangement/ }), 2200);
await cap('A new arrangement each time — and Undo', 'Or keep the lessons you placed and fill only the free periods');
await moveTo(p.getByRole('button', { name: 'Undo' }));
await wait(2600);
await click(p.getByRole('button', { name: 'Bell times' }), 1200);
await cap('Bell times are checked', 'Overlapping periods are refused and gaps are flagged before saving');
await wait(3200);
await click(dlg().getByRole('button', { name: 'Cancel' }), 600);

// ---------------------------------------------------------------- exams
await go('#/exams');
await cap('Exam timetables', 'Exam series and papers with rooms and invigilators — published to students and parents');
await wait(3400);
await click(p.getByRole('button', { name: 'Add paper' }), 900);
await click(dlg().getByRole('button', { name: 'All JHS' }), 500);
await dlg().locator('label', { hasText: 'Subject' }).locator('select').selectOption({ index: 2 });
await dlg().locator('input[type=date]').fill('2026-12-01');
await dlg().locator('input[type=time]').nth(0).fill('09:00');
await dlg().locator('input[type=time]').nth(1).fill('10:00');
await click(dlg().getByRole('button', { name: 'Save' }), 1500);
await cap('Clashes are caught', 'A class sitting two papers at once, or an invigilator or room booked twice');
await moveTo(p.getByText(/also sits/).first());
await wait(3400);
await click(p.locator('div', { hasText: /also sits/ }).getByRole('button', { name: 'Delete paper' }).first(), 700);
await click(dlg().getByRole('button', { name: 'Delete', exact: true }), 900);

// ---------------------------------------------------------------- marks
await go('#/gradebook');
await cap('Marks by subject teacher', 'Teachers only enter marks for the subjects they teach — the server enforces it');
await wait(2600);
await click(p.getByRole('button', { name: 'One student' }));
await type(p.getByPlaceholder('Admission no. or name'), 'Kofi');
await wait(600);
await click(p.getByRole('button', { name: /Kofi/ }).first(), 1200);
await cap('Find a student by admission number or name', 'Enter all their marks on one screen — every term is available');
await wait(3400);

// ---------------------------------------------------------------- billing
await go('#/finance');
await click(p.getByRole('button', { name: 'Fee structures' }), 1000);
await cap('Billing that fits every school', 'General fees per level, a one-off admission fee for new students, transport and boarding only for those who use them');
await wait(4200);
await click(p.getByRole('button', { name: 'Extra charges' }), 900);
await click(p.getByRole('button', { name: 'Add a charge' }).first(), 900);
await type(dlg().locator('input').first(), 'Excursion to Cape Coast');
await type(dlg().locator('input[type=number]'), '150');
await click(dlg().getByRole('button', { name: 'A class' }), 500);
await dlg().locator('select').last().selectOption({ label: 'JHS 2' });
await cap('Extra charges for chosen students only', 'Bill one student, a class, a level or everyone — with discounts and waivers per bill');
await wait(2600);
await click(dlg().getByRole('button', { name: /^Bill \d+ student/ }), 2200);

// ---------------------------------------------------------------- students & deleting
await go('#/students');
await cap('Tick, then act', 'Tick several students to mark them withdrawn or delete them — with their records');
await click(p.getByRole('checkbox', { name: 'Tick', exact: true }).nth(0), 300);
await click(p.getByRole('checkbox', { name: 'Tick', exact: true }).nth(1), 300);
await click(p.getByRole('checkbox', { name: 'Tick', exact: true }).nth(2), 1800);
await wait(1600);

// ---------------------------------------------------------------- live classes
await go('#/live');
await cap('Live classes: only the teacher starts and ends', 'The Owner and Head Teacher schedule them and choose the teacher who runs the class', 'NEW');
await click(p.getByRole('button', { name: 'Schedule live class' }), 900);
await type(dlg().locator('input').first(), 'Simultaneous equations revision');
await dlg().locator('label', { hasText: 'Subject' }).locator('select').selectOption({ index: 1 });
await moveTo(dlg().locator('label', { hasText: 'Teacher' }).locator('select'));
await dlg().locator('label', { hasText: 'Teacher' }).locator('select').selectOption({ index: 1 });
await dlg().locator('input[type=date]').fill(new Date().toISOString().slice(0, 10));
await dlg().locator('input[type=time]').fill('23:30');
await click(dlg().getByRole('button', { name: 'Save' }), 1600);
await moveTo(dlg().getByText(/can start and end this class/));
await wait(3200);
await p.keyboard.press('Escape');
await wait(500);

// ---------------------------------------------------------------- transport
await go('#/transport', 1800);
await cap('Live school bus tracking', 'Every bus on one map for the transport office, owner and head teacher');
await wait(3000);
await click(p.getByRole('button', { name: /^Routes/ }), 900);
await click(p.locator('.card p.font-bold', { hasText: 'Route A' }).first(), 1200);
await cap('Routes with stop times', 'Morning pick-up and afternoon drop-off for every stop — each child has their stop');
await wait(2200);
const addSel = dlg().locator('select').first();
await moveTo(addSel);
await addSel.selectOption(await addSel.locator('option', { hasText: 'Ama Mensah' }).first().getAttribute('value'));
await click(dlg().getByRole('button', { name: 'Add' }), 900);
const stopSel = dlg().getByLabel("Ama's stop");
await moveTo(stopSel);
await stopSel.selectOption(await stopSel.locator('option', { hasText: 'Baatsona' }).first().getAttribute('value'));
await wait(2400);
await p.keyboard.press('Escape');
await wait(500);
await as('Bus Attendant');
await go('#/transport', 1200);
await cap('Driver & bus attendant app', 'Start the trip — both phones share the bus location; the attendant ticks children on and off');
await wait(2400);
await click(p.getByRole('button', { name: 'Start morning pick-up' }), 3000);
await scrollBy(420, 900);
const row = p.locator('div.flex', { hasText: 'Ama Mensah' }).filter({ has: p.getByRole('button', { name: 'On' }) }).last();
if (await row.count()) await click(row.getByRole('button', { name: 'On' }), 1600);
await wait(1800);
await as('Parent');
await go('#/transport', 600);
const sw = p.locator('select[aria-label="Choose child"]');
if (await sw.count()) { await moveTo(sw); await sw.selectOption({ label: await sw.locator('option', { hasText: 'Ama' }).first().innerText() }); }
await wait(2000);
await cap('Parents watch the bus live', '"About 5 minutes away", "got on the bus" and "dropped off" notifications — and one tap to call the driver');
await wait(6000);

// ---------------------------------------------------------------- outro
await nocap();
await card(`${LOGO}<h1>Edu<b>Nexa</b></h1><p>Try the demo: <b style="color:#fff">nyamebabaku-lab.github.io/edunexa/demo</b></p><p>Android app for schools · parents · teachers · staff</p><ul><li>Gate kiosk ticks class registers</li><li>Parents join with the admission number</li><li>Two guardians per child</li></ul>`);
await wait(5500);
await ctx.close();
await b.close();
const f = readdirSync(OUT).filter((x) => x.endsWith('.webm')).map((x) => OUT + x);
renameSync(f[f.length - 1], OUT + 'tour.webm');
console.log('recorded', OUT + 'tour.webm');
