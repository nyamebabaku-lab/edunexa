// Builds flyers.html: 13 EduNexa social ads (1080x1080), following the graphic-design skill.
import fs from 'fs';
import { createRequire } from 'module';
const req = createRequire('/home/BrandsME/projects/edunexa/package.json');
const React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
const L = req('lucide-react');
const QR = req('qrcode');
const URL_ = 'https://nyamebabaku-lab.github.io/edunexa/';
const URL_TXT = 'nyamebabaku-lab.github.io/edunexa';
const ic = (name, size = 40, sw = 2, cls = '') => renderToStaticMarkup(React.createElement(L[name], { size, strokeWidth: sw, className: cls }));
const qr = await QR.toString(URL_, { type: 'svg', margin: 0, color: { dark: '#0a1330', light: '#ffffff' } });

const logo = (dark = false) => `<div class="logo ${dark ? 'on-dark' : ''}"><span class="mark">${ic('GraduationCap', 34, 2.2)}</span><span class="word">Edu<b>Nexa</b></span></div>`;
const cta = (variant = 'red') => `<div class="cta"><span class="btn ${variant}">Try the free demo ${ic('ArrowRight', 26, 2.6)}</span><span class="url">${URL_TXT}</span></div>`;
const phone = (shot, cls = '', style = '') => `<div class="phone ${cls}" style="${style}"><div class="scr" style="background-image:url(shots/${shot}.png)"></div><i class="notch"></i></div>`;
const laptop = (shot, cls = '', style = '', pos = 'left top') => `<div class="laptop ${cls}" style="${style}"><div class="lid"><div class="scr" style="background-image:url(shots/${shot}.png);background-position:${pos}"></div></div><div class="base"></div></div>`;
const chip = (icon, text, cls = '', style = '') => `<div class="chip ${cls}" style="${style}"><span class="ci">${ic(icon, 26, 2.4)}</span>${text}</div>`;

const ads = [];
const ad = (slug, cls, html) => ads.push({ slug, cls, html });

ad('one-app', 'bg-blue', `
  <div class="glow r" style="right:-200px;top:-220px"></div>
  ${logo(true)}
  <div class="copy" style="top:170px;width:940px">
    <div class="eyebrow light">School management + LMS</div>
    <h1 class="h1 white" style="font-size:84px">Run your whole school<br>from <em class="red">one app.</em></h1>
    <p class="sub white">Admissions, fees, results and attendance. Creche to Diploma.</p>
  </div>
  ${laptop('dashboard', '', 'left:300px;top:560px;width:860px')}
  ${phone('m-parent', '', 'left:110px;top:600px;width:230px;transform:rotate(-7deg)')}
  ${cta('red')}`);

ad('parents', 'bg-light', `
  <div class="glow b" style="left:-260px;bottom:-260px"></div>
  ${logo()}
  <div class="copy" style="top:200px;width:520px">
    <div class="eyebrow">For parents</div>
    <h1 class="h1">Every parent, <em class="blue">in the loop.</em></h1>
    <p class="sub">Results, attendance, fees and the school bus, right on their phone.</p>
  </div>
  ${phone('m-parent', '', 'left:600px;top:120px;width:360px;transform:rotate(4deg)')}
  ${chip('ClipboardCheck', '93% attendance', '', 'left:72px;top:640px')}
  ${chip('Award', 'Report card ready', '', 'left:150px;top:730px')}
  ${chip('MessageCircle', 'SMS if absent', 'red', 'left:72px;top:820px')}
  ${cta('blue')}`);

ad('qr-gate', 'bg-dark', `
  <div class="glow r" style="left:-200px;top:-200px;opacity:.45"></div><div class="glow b" style="right:-250px;bottom:-200px"></div>
  ${logo(true)}
  <div class="copy center" style="top:150px">
    <div class="eyebrow light">QR gate attendance</div>
    <h1 class="h1 white" style="font-size:92px">Scan in. Scan out.<br><em class="red">No paper register.</em></h1>
  </div>
  ${laptop('kiosk', 'tablet', 'left:150px;top:450px;width:780px')}
  ${chip('Bell', 'Parent gets a text', 'dark', 'left:720px;top:420px')}
  ${chip('ScanLine', 'Students & staff', 'dark', 'left:60px;top:790px')}
  ${cta('red')}`);

ad('momo-fees', 'bg-sky', `
  <div class="glow r" style="right:-260px;top:-260px;opacity:.35"></div>
  ${logo()}
  <div class="copy" style="top:220px;width:540px">
    <div class="eyebrow">Fees &amp; finance</div>
    <h1 class="h1">School fees, paid with <em class="red">MoMo.</em></h1>
    <p class="sub">Invoices, receipts and arrears reminders, sorted automatically.</p>
  </div>
  ${phone('m-fees', '', 'left:640px;top:110px;width:350px;transform:rotate(-4deg)')}
  ${chip('Smartphone', 'Pay now with MoMo', 'blue', 'left:72px;top:690px')}
  ${chip('Printer', 'Official receipt ready', '', 'left:150px;top:785px')}
  ${cta('red')}`);

const tile = (init, name, color, off = []) => `<div class="tile"><div class="av" style="background:${color}">${init}</div><div class="nm">${name}${off.map((o) => ic(o, 22, 2.4)).join('')}</div></div>`;
ad('live-classes', 'bg-navy', `
  <div class="glow r" style="right:-220px;top:-220px;opacity:.5"></div>
  ${logo(true)}
  <div class="copy" style="top:160px;width:900px">
    <div class="eyebrow light">Live classes</div>
    <h1 class="h1 white">Teach live. <em class="red">From anywhere.</em></h1>
    <p class="sub white" style="width:760px">Camera, mic, screen sharing and chat.<br>Low-data mode for slow networks.</p>
  </div>
  <div class="call">
    <div class="grid4">
      ${tile('KA', 'Mr. Kwame Asante', '#0d9488')}${tile('KM', 'Kofi Mensah', '#f59e0b', ['MicOff'])}
      ${tile('AF', 'Afua Mensah', '#e11d48')}${tile('CF', 'Comfort Frimpong', '#7c3aed', ['VideoOff'])}
    </div>
    <div class="bar">${['Mic', 'Video', 'MonitorUp', 'Hand', 'MessageSquare'].map((i) => `<span>${ic(i, 28, 2.2)}</span>`).join('')}<span class="end">${ic('PhoneOff', 28, 2.2)}</span></div>
  </div>
  ${cta('red')}`);

ad('report-cards', 'bg-light', `
  <div class="glow b" style="right:-260px;top:-200px"></div>
  ${logo()}
  <div class="copy" style="top:170px;width:900px">
    <div class="eyebrow">Gradebook &amp; reports</div>
    <h1 class="h1">Report cards in <em class="blue">one click.</em></h1>
    <p class="sub" style="width:860px">Grades, positions and remarks, done for you.</p>
  </div>
  ${laptop('reportcards', '', 'left:150px;top:560px;width:1000px', '62% 30%')}
  ${chip('Award', 'GES · WASSCE · Diploma grading', 'blue', 'left:470px;top:640px')}
  ${chip('Check', 'BECE aggregate for JHS', 'red', 'left:590px;top:740px')}
  ${cta('blue')}`);

ad('offline', 'bg-blue', `
  <div class="glow r" style="left:-260px;bottom:-200px;opacity:.5"></div>
  ${logo(true)}
  <div class="copy" style="top:190px;width:600px">
    <div class="bigicon">${ic('WifiOff', 92, 2)}</div>
    <h1 class="h1 white" style="font-size:94px">No internet?<br><em class="red">No problem.</em></h1>
    <p class="sub white">EduNexa keeps working offline and catches up when you're back online.</p>
  </div>
  ${phone('m-dashboard', '', 'left:690px;top:190px;width:320px;transform:rotate(6deg)')}
  <div class="offbar" style="right:72px;top:150px">${ic('WifiOff', 24, 2.4)} You're offline. Changes are saved.</div>
  ${cta('red')}`);

const levels = ['Creche', 'Nursery &amp; KG', 'Primary', 'JHS', 'SHS', 'Diploma'];
ad('creche-to-diploma', 'bg-white', `
  <div class="glow b" style="left:-260px;top:-260px;opacity:.6"></div>
  ${logo()}
  <div class="copy" style="top:180px;width:520px">
    <div class="eyebrow">Every level</div>
    <h1 class="h1" style="font-size:96px">Creche to Diploma.<br><em class="blue">One system.</em></h1>
    <p class="sub">GES, WASSCE and Diploma grading built in. 3 terms, cedis, MoMo.</p>
  </div>
  <div class="ladder">${levels.map((l, i) => `<div class="step" style="margin-left:${(5 - i) * 0}px;width:${300 + i * 28}px;background:${i === 5 ? '#e11d48' : `hsl(226 ${74}% ${58 - i * 5}%)`}"><span>${String(i + 1).padStart(2, '0')}</span>${l}</div>`).reverse().join('')}</div>
  ${cta('red')}`);

const mods = [['UserPlus', 'Admissions'], ['Users', 'Students'], ['Wallet', 'Fees &amp; MoMo'], ['Banknote', 'Payroll'], ['ClipboardCheck', 'Attendance'], ['BookMarked', 'Gradebook'], ['FileText', 'Report cards'], ['MonitorPlay', 'E-learning'], ['Video', 'Live classes'], ['ScanLine', 'QR gate'], ['Bus', 'Transport'], ['BookOpen', 'Library'], ['UtensilsCrossed', 'Canteen'], ['Package', 'Store'], ['BedDouble', 'Hostel'], ['MessageCircle', 'SMS &amp; notices']];
ad('all-modules', 'bg-dark', `
  <div class="glow b" style="right:-260px;top:-260px"></div><div class="glow r" style="left:-300px;bottom:-300px;opacity:.35"></div>
  ${logo(true)}
  <div class="copy center" style="top:160px">
    <h1 class="h1 white" style="font-size:80px">Everything your school <em class="red">runs on.</em></h1>
  </div>
  <div class="mods">${mods.map(([i, t], k) => `<div class="mod ${k === 8 || k === 9 ? 'hot' : ''}">${ic(i, 40, 2)}<span>${t}</span></div>`).join('')}</div>
  ${cta('red')}`);

ad('canteen', 'bg-warm', `
  <div class="glow r" style="right:-240px;bottom:-200px;opacity:.35"></div>
  ${logo()}
  <div class="copy" style="top:170px;width:900px">
    <div class="eyebrow">Canteen point of sale</div>
    <h1 class="h1">Even the canteen <em class="red">adds up.</em></h1>
    <p class="sub" style="width:860px">Sales, weekly menu, kitchen stock and income.</p>
  </div>
  ${laptop('canteen', '', 'left:-120px;top:520px;width:960px', '40% 40%')}
  ${chip('UtensilsCrossed', 'Jollof · Waakye · Kelewele', '', 'left:610px;top:520px')}
  ${chip('Wallet', 'Cash, MoMo or fee bill', 'blue', 'left:690px;top:615px')}
  ${chip('TrendingUp', 'Daily income', 'red', 'left:760px;top:710px')}
  ${cta('blue')}`);

const before = ['Exercise books for fees', 'Paper attendance registers', 'Hand-written report cards', 'Lost receipts'];
const after = ['MoMo payments &amp; receipts', 'QR gate clock-in', 'Report cards in one click', 'Parents see it all'];
ad('paper-vs-app', 'bg-white split', `
  <div class="half left"></div><div class="half right"></div>
  ${logo()}
  <div class="copy center" style="top:150px"><h1 class="h1" style="font-size:78px">Still running your school <em class="red">on paper?</em></h1></div>
  <div class="col l"><div class="tag">Before</div>${before.map((b) => `<div class="li x">${ic('X', 28, 3)}<span>${b}</span></div>`).join('')}</div>
  <div class="col r"><div class="tag">With EduNexa</div>${after.map((b) => `<div class="li ok">${ic('Check', 28, 3)}<span>${b}</span></div>`).join('')}</div>
  ${cta('red')}`);

ad('pocket', 'bg-light', `
  <div class="glow b" style="left:50%;top:40%;margin-left:-300px"></div>
  ${logo()}
  <div class="copy center" style="top:150px">
    <h1 class="h1" style="font-size:92px">Your school, <em class="blue">in your pocket.</em></h1>
    <p class="sub">iPhone, Android or any browser. Nothing to install.</p>
  </div>
  ${phone('m-student', '', 'left:150px;top:470px;width:270px;transform:rotate(-9deg)')}
  ${phone('m-clock', '', 'left:665px;top:470px;width:270px;transform:rotate(9deg)')}
  ${phone('m-parent', 'front', 'left:395px;top:430px;width:300px')}
  ${cta('red')}`);

ad('scan-demo', 'bg-blue', `
  <div class="glow r" style="right:-240px;top:-240px;opacity:.55"></div>
  ${logo(true)}
  <div class="copy" style="top:270px;width:520px">
    <div class="eyebrow light">See it for yourself</div>
    <h1 class="h1 white" style="font-size:96px">Scan to try <em class="red">the demo.</em></h1>
    <p class="sub white">Open a portal in your browser. No download needed.</p>
    <div class="portals">${[['ShieldCheck', 'Admin'], ['Presentation', 'Teacher'], ['HeartHandshake', 'Parent'], ['GraduationCap', 'Student']].map(([i, t]) => `<span>${ic(i, 26, 2.2)}${t}</span>`).join('')}</div>
  </div>
  <div class="qrcard"><div class="qr">${qr}</div><div class="qrl">${ic('ScanLine', 30, 2.4)} Point your camera here</div></div>
  ${cta('white')}`);

const css = fs.readFileSync(new URL('./flyers.css', import.meta.url), 'utf8');
fs.writeFileSync(new URL('./flyers.html', import.meta.url), `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=block" rel="stylesheet"><style>${css}</style></head><body>
${ads.map((a, i) => `<section class="ad ${a.cls}" id="ad-${String(i + 1).padStart(2, '0')}" data-slug="${a.slug}">${a.html}</section>`).join('\n')}
</body></html>`);
console.log(ads.length, 'ads');
