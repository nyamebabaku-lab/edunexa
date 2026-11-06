// Builds flyers-new.html: flyers 14–16 (school bus tracking, gate kiosk, what's new), same design system as gen.mjs.
import fs from 'fs';
import { createRequire } from 'module';
const req = createRequire('/home/BrandsME/projects/edunexa/package.json');
const React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
const L = req('lucide-react');
const QR = req('qrcode');
const URL_ = 'https://nyamebabaku-lab.github.io/edunexa/demo/';
const URL_TXT = 'nyamebabaku-lab.github.io/edunexa/demo';
const ic = (name, size = 40, sw = 2, cls = '') => renderToStaticMarkup(React.createElement(L[name], { size, strokeWidth: sw, className: cls }));
const qr = await QR.toString(URL_, { type: 'svg', margin: 0, color: { dark: '#0a1330', light: '#ffffff' } });

const logo = (dark = false) => `<div class="logo ${dark ? 'on-dark' : ''}"><span class="mark">${ic('GraduationCap', 34, 2.2)}</span><span class="word">Edu<b>Nexa</b></span></div>`;
const cta = (variant = 'red') => `<div class="cta"><span class="btn ${variant}">Try the free demo ${ic('ArrowRight', 26, 2.6)}</span><span class="url">${URL_TXT}</span></div>`;
const phone = (shot, cls = '', style = '') => `<div class="phone ${cls}" style="${style}"><div class="scr" style="background-image:url(shots/${shot}.png)"></div><i class="notch"></i></div>`;
const laptop = (shot, cls = '', style = '', pos = 'left top') => `<div class="laptop ${cls}" style="${style}"><div class="lid"><div class="scr" style="background-image:url(shots/${shot}.png);background-position:${pos}"></div></div><div class="base"></div></div>`;
const chip = (icon, text, cls = '', style = '') => `<div class="chip ${cls}" style="${style}"><span class="ci">${ic(icon, 26, 2.4)}</span>${text}</div>`;

const ads = [];
const ad = (slug, cls, html) => ads.push({ slug, cls, html });

ad('bus-live', 'bg-dark', `
  <div class="glow r" style="left:-240px;top:-220px;opacity:.45"></div><div class="glow b" style="right:-260px;bottom:-240px"></div>
  ${logo(true)}
  <div class="copy" style="top:170px;width:520px">
    <div class="eyebrow light">New · School bus tracking</div>
    <h1 class="h1 white" style="font-size:80px">Watch the school bus <em class="red">live.</em></h1>
    <p class="sub white" style="font-size:29px">Parents follow the bus on the map, all the way to their child's stop.</p>
  </div>
  ${phone('m-bus-parent', 'front', 'left:600px;top:96px;width:380px;transform:rotate(3deg)')}
  ${chip('BellRing', 'Bus is 5 minutes away', 'dark', 'left:72px;top:600px')}
  ${chip('BadgeCheck', 'Ama got on the bus', 'dark', 'left:130px;top:690px')}
  ${chip('PhoneCall', 'One tap to call the driver', 'dark', 'left:72px;top:780px')}
  ${cta('red')}`);

ad('gate-kiosk', 'bg-light', `
  <div class="glow b" style="left:-260px;bottom:-260px"></div><div class="glow r" style="right:-300px;top:-300px;opacity:.25"></div>
  ${logo()}
  <div class="copy" style="top:170px;width:940px">
    <div class="eyebrow">New · Gate kiosk</div>
    <h1 class="h1" style="font-size:80px">Scan in at the gate.<br><em class="blue">Register done.</em></h1>
    <p class="sub" style="width:900px;font-size:29px">Every clock-in ticks the class register, Present or Late, and tells the parent.</p>
  </div>
  ${laptop('kiosk', 'tablet', 'left:380px;top:500px;width:680px')}
  ${chip('ScanLine', 'Scan ID card or QR', '', 'left:60px;top:540px')}
  ${chip('ClipboardCheck', 'Register: Present', 'blue', 'left:40px;top:640px')}
  ${chip('MessageCircle', 'Parent gets a text', 'red', 'left:60px;top:740px')}
  ${cta('blue')}`);

const news = [
  ['Bus', 'Live bus tracking'], ['ScanLine', 'Gate ticks registers'], ['NotebookPen', 'Exam timetables'], ['CalendarClock', 'Timetable in one tap'],
  ['Wallet', 'Admission fees & extra charges'], ['GraduationCap', 'Marks by subject teacher'], ['Users', 'Parents link their children'], ['Video', 'Teacher-led live classes'],
];
ad('whats-new', 'bg-blue', `
  <div class="glow r" style="right:-260px;top:-260px;opacity:.45"></div>
  ${logo(true)}
  <div class="copy" style="top:170px;width:940px">
    <div class="eyebrow light">What's new</div>
    <h1 class="h1 white" style="font-size:82px">EduNexa just got <em class="red" style="color:#ff5a7a">even better.</em></h1>
  </div>
  <div class="newgrid">${news.map(([i, t], k) => `<div class="nw ${k < 2 ? 'hot' : ''}"><span class="ni">${ic(i, 34, 2.2)}</span><span>${t}</span></div>`).join('')}</div>
  ${cta('white')}`);

const css = fs.readFileSync(new URL('./flyers.css', import.meta.url), 'utf8') + `
.newgrid{position:absolute;left:72px;right:72px;top:420px;display:grid;grid-template-columns:1fr 1fr;gap:16px;z-index:4}
.nw{display:flex;align-items:center;gap:16px;height:100px;padding:0 22px;border-radius:24px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);color:#fff;font-size:27px;font-weight:700;line-height:1.15}
.nw .ni{flex:none;width:58px;height:58px;border-radius:16px;display:grid;place-items:center;background:rgba(255,255,255,.16);color:#fff}
.nw.hot{background:#fff;color:var(--ink)}.nw.hot .ni{background:var(--red);color:#fff}
`;
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=block" rel="stylesheet"><style>${css}</style></head><body>
${ads.map((a, i) => `<section class="ad ${a.cls}" id="ad-${String(i + 14).padStart(2, '0')}" data-slug="${a.slug}">${a.html}</section>`).join('\n')}
</body></html>`;
fs.writeFileSync(new URL('./flyers-new.html', import.meta.url), html);
console.log('flyers-new.html', ads.length);
