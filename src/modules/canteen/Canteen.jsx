import { useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  ShoppingBasket, Plus, Minus, CheckCircle2, UtensilsCrossed, Coffee, Soup, Sandwich, CupSoda, Leaf,
  Coins, Receipt, TrendingUp, Package, AlertCircle, PackagePlus, Download, X, CalendarDays, Wallet,
} from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser, usePortalStudent, TODAY } from '../../data/selectors';
import { DAYS } from '../../data/seed';
import { CANTEEN_CATEGORIES, MEAL_SLOTS } from '../../data/canteenSeed';
import { money, moneyShort, fmtDate, fullName, sum, pct, uid, groupBy, downloadCSV, compactNum } from '../../lib/format';
import { Card, CardHeader, PageHeader, Tabs, Button, IconButton, Badge, StatCard, DataTable, Modal, Field, Input, Select, SearchInput, Progress, EmptyState, toast, cx } from '../../components/ui';
import { useChartTheme, axisProps, ChartTooltip } from '../../components/charts';
import CrudPage from '../../components/CrudPage';
import PrintView, { Paper, Letterhead } from '../../components/PrintView';

export const CAT_ICON = { Breakfast: Coffee, Lunch: Soup, Snacks: Sandwich, Drinks: CupSoda };
const CAT_TONE = { Breakfast: 'amber', Lunch: 'blue', Snacks: 'violet', Drinks: 'teal' };
const PAY_METHODS = ['Cash', 'Mobile Money', 'Bill to fees'];

export const todayName = () => {
  const n = fmtDate(TODAY, 'EEEE');
  return DAYS.includes(n) ? n : 'Monday';
};

export const ingredientLevel = (i) =>
  i.qty <= 0 ? { label: 'Out of stock', tone: 'red' } : i.qty <= i.reorderLevel ? { label: 'Low', tone: 'amber' } : { label: 'OK', tone: 'green' };

/** Item ids on sale today: today's breakfast/lunch plus all snacks and drinks. */
export function todaysItemIds(db) {
  const m = db.canteenMenu[todayName()] || { Breakfast: [], Lunch: [] };
  return new Set([...m.Breakfast, ...m.Lunch, ...db.canteenItems.filter((i) => i.category === 'Snacks' || i.category === 'Drinks').map((i) => i.id)]);
}

function buyerName(sale, L) {
  if (sale.buyerType === 'Student') return L.studentName(sale.studentId);
  if (sale.buyerType === 'Staff') return L.staffName(sale.staffId);
  return 'Walk-in / Visitor';
}

function CanteenReceipt({ sale }) {
  const db = useDB();
  const L = useLookups();
  const item = (id) => db.canteenItems.find((i) => i.id === id);
  return (
    <Paper className="mx-auto max-w-sm !p-6">
      <Letterhead title="Canteen Receipt" />
      <div className="flex justify-between text-xs text-slate-500">
        <span className="font-mono font-bold text-accent-700">{sale.receiptNo}</span>
        <span>{fmtDate(sale.date)} · {sale.time}</span>
      </div>
      <p className="mt-2 text-sm">Customer: <b>{buyerName(sale, L)}</b></p>
      <table className="mt-4 w-full text-sm">
        <tbody>
          {sale.items.map((l, i) => (
            <tr key={i} className="border-b border-dashed border-slate-200">
              <td className="py-1.5">{l.qty} × {item(l.itemId)?.name}</td>
              <td className="py-1.5 text-right">{money(l.qty * l.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-between text-base font-extrabold text-brand-800"><span>Total</span><span>{money(sale.total)}</span></div>
      <p className="mt-1 text-xs text-slate-500">Paid by {sale.method}{sale.tendered ? ` · tendered ${money(sale.tendered)} · change ${money(sale.tendered - sale.total)}` : ''}</p>
      <p className="mt-4 text-center text-xs text-slate-400">Served by {L.staffName(sale.servedBy)} · Enjoy your meal!</p>
    </Paper>
  );
}

// ---------------------------------------------------------------- Point of sale
function POS() {
  const db = useDB();
  const L = useLookups();
  const user = useCurrentUser();
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState({});
  const [buyerType, setBuyerType] = useState('Student');
  const [buyerId, setBuyerId] = useState('');
  const [method, setMethod] = useState('Cash');
  const [tendered, setTendered] = useState('');
  const [receipt, setReceipt] = useState(null);
  const onMenu = todaysItemIds(db);
  const items = db.canteenItems
    .filter((i) => onMenu.has(i.id))
    .filter((i) => cat === 'All' || i.category === cat)
    .filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()));
  const lines = Object.entries(cart).map(([id, qty]) => ({ item: db.canteenItems.find((i) => i.id === id), qty })).filter((l) => l.item);
  const total = sum(lines, (l) => l.item.price * l.qty);
  const todaySales = db.canteenSales.filter((s) => s.date === TODAY);

  const addItem = (it) => {
    if (!it.available) return toast.error('Sold out', it.name);
    setCart((c) => ({ ...c, [it.id]: (c[it.id] || 0) + 1 }));
  };
  const setQty = (id, d) => setCart((c) => {
    const n = (c[id] || 0) + d;
    const next = { ...c };
    if (n <= 0) delete next[id]; else next[id] = n;
    return next;
  });

  const complete = () => {
    if (!lines.length) return toast.error('Cart is empty');
    if (buyerType !== 'Visitor' && !buyerId) return toast.error(`Select the ${buyerType.toLowerCase()}`);
    if (method === 'Bill to fees' && buyerType !== 'Student') return toast.error('Only students can be billed to fees');
    if (method === 'Cash' && tendered && Number(tendered) < total) return toast.error('Amount tendered is less than total');
    const now = new Date();
    const sale = {
      id: uid('csl'),
      receiptNo: `CNT-${String(db.canteenSales.length + 1).padStart(5, '0')}`,
      date: TODAY,
      time: format(now, 'HH:mm'),
      items: lines.map((l) => ({ itemId: l.item.id, qty: l.qty, price: l.item.price })),
      total,
      method,
      tendered: method === 'Cash' && tendered ? Number(tendered) : null,
      buyerType,
      studentId: buyerType === 'Student' ? buyerId : null,
      staffId: buyerType === 'Staff' ? buyerId : null,
      servedBy: user.linkedId,
    };
    db.add('canteenSales', sale);
    if (method === 'Bill to fees') {
      db.add('invoices', { id: uid('inv'), invoiceNo: `INV-CN-${String(db.invoices.length + 1).padStart(4, '0')}`, studentId: buyerId, termId: db.settings.currentTerm, date: TODAY, dueDate: TODAY, items: [{ name: `Canteen ${sale.receiptNo}`, amount: total }], discount: 0, discountReason: '', total });
    }
    toast.success('Sale complete', `${money(total)} · ${method}`);
    setCart({});
    setTendered('');
    setReceipt(sale);
  };

  const buyerOpts = buyerType === 'Student'
    ? [...db.students].filter((s) => s.status === 'Active').sort((a, b) => a.lastName.localeCompare(b.lastName)).map((s) => ({ value: s.id, label: `${fullName(s)} · ${L.className(s.classId)}` }))
    : db.staff.map((s) => ({ value: s.id, label: `${s.title} ${s.firstName} ${s.lastName} · ${s.role}` }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Tabs value={cat} onChange={setCat} tabs={['All', ...CANTEEN_CATEGORIES]} />
          <SearchInput value={q} onChange={setQ} placeholder="Find a food…" className="sm:ml-auto sm:w-60" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
          {items.map((it) => {
            const Icon = CAT_ICON[it.category];
            const inCart = cart[it.id];
            return (
              <button
                key={it.id}
                onClick={() => addItem(it)}
                className={cx(
                  'card relative flex flex-col p-4 text-left transition active:scale-[.98]',
                  it.available ? 'hover:-translate-y-0.5 hover:shadow-lift' : 'cursor-not-allowed opacity-50',
                  inCart && '!border-brand-500 ring-4 ring-brand-500/10',
                )}
              >
                {inCart && <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">{inCart}</span>}
                <div className={cx('flex h-10 w-10 items-center justify-center rounded-xl', it.available ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15' : 'bg-slate-100 text-slate-400')}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-bold text-slate-900 dark:text-white">{it.name}</p>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-sm font-extrabold text-brand-700 dark:text-brand-300">{money(it.price)}</span>
                  {!it.available ? <Badge tone="red">Sold out</Badge> : it.vegetarian && <Leaf className="h-3.5 w-3.5 text-emerald-500" />}
                </div>
              </button>
            );
          })}
        </div>
        {items.length === 0 && <Card><EmptyState icon={UtensilsCrossed} title="Nothing on the menu here" /></Card>}
      </div>

      <Card className="h-fit xl:sticky xl:top-24">
        <CardHeader title="Current order" subtitle={`Today: ${todaySales.length} sales · ${money(sum(todaySales, (s) => s.total))}`} icon={ShoppingBasket} action={lines.length > 0 && <Button size="sm" variant="ghost" onClick={() => setCart({})}>Clear</Button>} />
        <div className="space-y-2 p-5">
          {lines.length === 0 && <p className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 dark:border-white/10">Tap foods to add them to the order</p>}
          {lines.map(({ item, qty }) => (
            <div key={item.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-slate-500">{money(item.price)} each</p>
              </div>
              <IconButton icon={Minus} label="Less" tone="secondary" className="!h-8 !w-8" onClick={() => setQty(item.id, -1)} />
              <span className="w-6 text-center text-sm font-bold">{qty}</span>
              <IconButton icon={Plus} label="More" tone="secondary" className="!h-8 !w-8" onClick={() => setQty(item.id, 1)} />
              <span className="w-20 text-right text-sm font-bold">{money(item.price * qty)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-4 border-t border-slate-100 p-5 dark:border-white/5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer">
              <Select value={buyerType} onChange={(e) => { setBuyerType(e.target.value); setBuyerId(''); if (e.target.value !== 'Student' && method === 'Bill to fees') setMethod('Cash'); }} options={['Student', 'Staff', 'Visitor']} />
            </Field>
            <Field label="Payment">
              <Select value={method} onChange={(e) => setMethod(e.target.value)} options={buyerType === 'Student' ? PAY_METHODS : PAY_METHODS.slice(0, 2)} />
            </Field>
          </div>
          {buyerType !== 'Visitor' && (
            <Field label={buyerType}>
              <Select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} placeholder={`Select ${buyerType.toLowerCase()}…`} options={buyerOpts} />
            </Field>
          )}
          {method === 'Cash' && (
            <Field label="Cash tendered (optional)" hint={tendered && Number(tendered) >= total ? `Change: ${money(Number(tendered) - total)}` : undefined}>
              <Input type="number" min="0" value={tendered} onChange={(e) => setTendered(e.target.value)} />
            </Field>
          )}
          {method === 'Bill to fees' && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">The total will be added to the student's fee bill for this term.</p>}
          <div className="flex items-center justify-between text-lg font-extrabold">
            <span>Total</span>
            <span className="text-brand-700 dark:text-brand-300">{money(total)}</span>
          </div>
          <Button size="lg" className="w-full" icon={CheckCircle2} onClick={complete} disabled={!lines.length}>Complete sale</Button>
        </div>
      </Card>
      <PrintView open={!!receipt} onClose={() => setReceipt(null)} title="Canteen receipt">{receipt && <CanteenReceipt sale={receipt} />}</PrintView>
    </div>
  );
}

// ---------------------------------------------------------------- Menu items
function MenuItems() {
  const db = useDB();
  const sold = useMemo(() => {
    const m = {};
    db.canteenSales.forEach((s) => s.items.forEach((l) => (m[l.itemId] = (m[l.itemId] || 0) + l.qty)));
    return m;
  }, [db.canteenSales]);
  return (
    <CrudPage
      collection="canteenItems"
      noun="food item"
      defaults={{ category: 'Lunch', available: true, vegetarian: false }}
      fields={[
        { name: 'name', label: 'Food name', required: true, span: 2 },
        { name: 'category', label: 'Category', type: 'select', options: CANTEEN_CATEGORIES, required: true },
        { name: 'price', label: 'Selling price', type: 'number', required: true, step: '0.5' },
        { name: 'cost', label: 'Cost to make', type: 'number', step: '0.01', hint: 'Used to work out profit margin' },
        { name: 'available', label: 'Available today', type: 'checkbox' },
        { name: 'vegetarian', label: 'Vegetarian', type: 'checkbox' },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      searchText={(i) => `${i.name} ${i.category} ${i.description}`}
      columns={[
        { key: 'name', label: 'Food', render: (i) => <div><p className="font-semibold">{i.name} {i.vegetarian && <Leaf className="inline h-3.5 w-3.5 text-emerald-500" />}</p><p className="max-w-xs truncate text-xs text-slate-500">{i.description}</p></div> },
        { key: 'category', label: 'Category', render: (i) => <Badge tone={CAT_TONE[i.category]}>{i.category}</Badge> },
        { key: 'price', label: 'Price', render: (i) => <span className="font-bold">{money(i.price)}</span> },
        { key: 'cost', label: 'Cost', hideOnMobile: true, render: (i) => money(i.cost) },
        { key: 'margin', label: 'Margin', hideOnMobile: true, sort: (i) => (i.price - i.cost) / i.price, render: (i) => <Badge tone={(i.price - i.cost) / i.price >= 0.4 ? 'green' : 'amber'}>{pct(i.price - i.cost, i.price)}%</Badge> },
        { key: 'sold', label: 'Sold (term)', sort: (i) => sold[i.id] || 0, render: (i) => sold[i.id] || 0 },
        {
          key: 'available',
          label: 'Status',
          sort: (i) => (i.available ? 1 : 0),
          render: (i) => (
            <button onClick={(e) => { e.stopPropagation(); db.update('canteenItems', i.id, { available: !i.available }); toast.success(i.available ? 'Marked sold out' : 'Back on sale', i.name); }}>
              <Badge tone={i.available ? 'green' : 'red'} dot>{i.available ? 'Available' : 'Sold out'}</Badge>
            </button>
          ),
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------- Weekly menu
function WeeklyMenu({ readOnly }) {
  const db = useDB();
  const item = (id) => db.canteenItems.find((i) => i.id === id);
  const today = todayName();
  const setSlot = (day, slot, ids) => db.setKey('canteenMenu', (m) => ({ ...m, [day]: { ...m[day], [slot]: ids } }));
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {DAYS.map((day) => (
          <Card key={day} className={cx('flex flex-col', day === today && '!border-brand-500 ring-4 ring-brand-500/10')}>
            <div className={cx('rounded-t-2xl px-4 py-3', day === today ? 'bg-brand-600 text-white' : 'bg-slate-50 dark:bg-white/[.03]')}>
              <p className="font-bold">{day}</p>
              {day === today && <p className="text-xs text-brand-100">Today</p>}
            </div>
            <div className="flex-1 space-y-4 p-4">
              {MEAL_SLOTS.map((slot) => {
                const ids = db.canteenMenu[day]?.[slot] || [];
                const SlotIcon = CAT_ICON[slot];
                return (
                  <div key={slot}>
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400"><SlotIcon className="h-3.5 w-3.5" /> {slot}</p>
                    <div className="space-y-1.5">
                      {ids.map((id) => {
                        const it = item(id);
                        if (!it) return null;
                        return (
                          <div key={id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5">
                            <div className="min-w-0 flex-1">
                              <p className={cx('truncate text-sm font-semibold', !it.available && 'line-through opacity-60')}>{it.name}</p>
                              <p className="text-xs text-brand-600 dark:text-brand-300">{money(it.price)}</p>
                            </div>
                            {!readOnly && <button onClick={() => setSlot(day, slot, ids.filter((x) => x !== id))} className="text-slate-400 hover:text-accent-600" aria-label="Remove"><X className="h-4 w-4" /></button>}
                          </div>
                        );
                      })}
                      {!readOnly && (
                        <select
                          value=""
                          onChange={(e) => e.target.value && setSlot(day, slot, [...ids, e.target.value])}
                          className="w-full rounded-xl border border-dashed border-slate-300 bg-transparent px-3 py-2 text-xs font-semibold text-slate-500 outline-none hover:border-brand-400 dark:border-white/10"
                        >
                          <option value="">+ Add {slot.toLowerCase()} dish</option>
                          {db.canteenItems.filter((i) => i.category === slot && !ids.includes(i.id)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-500">Snacks and drinks are on sale every day.</p>
    </>
  );
}

// ---------------------------------------------------------------- Kitchen stock
function KitchenStock() {
  const db = useDB();
  const [move, setMove] = useState(null);
  const ing = (id) => db.canteenStock.find((i) => i.id === id);
  const low = db.canteenStock.filter((i) => i.qty <= i.reorderLevel);
  const monthStart = TODAY.slice(0, 7);
  const purchasesMonth = sum(db.canteenStockMoves.filter((m) => m.type === 'Purchase' && m.date.startsWith(format(subDays(parseISO(TODAY), 30), 'yyyy-MM'))), (m) => m.cost);

  const save = () => {
    const it = ing(move.ingredientId);
    const qty = Number(move.qty);
    if (!it || !qty || qty <= 0) return toast.error('Choose an ingredient and quantity');
    if (move.type !== 'Purchase' && qty > it.qty) return toast.error('Not enough in stock', `${it.qty} ${it.unit} left`);
    const cost = move.type === 'Purchase' ? Number(move.cost) || qty * it.unitCost : 0;
    db.add('canteenStockMoves', { ingredientId: it.id, type: move.type, qty, cost, date: TODAY, note: move.note || (move.type === 'Purchase' ? it.supplier : move.type === 'Used' ? 'Kitchen usage' : 'Spoilt / wasted') });
    db.update('canteenStock', it.id, { qty: it.qty + (move.type === 'Purchase' ? qty : -qty), ...(move.type === 'Purchase' ? { unitCost: Math.round((cost / qty) * 100) / 100 } : {}) });
    toast.success('Stock updated', `${it.name}: ${move.type === 'Purchase' ? '+' : '−'}${qty} ${it.unit}`);
    setMove(null);
  };

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ingredients" value={db.canteenStock.length} icon={Package} />
        <StatCard label="Stock value" value={moneyShort(sum(db.canteenStock, (i) => i.qty * i.unitCost))} icon={Coins} tone="navy" />
        <StatCard label="Low / out" value={low.length} icon={AlertCircle} tone="red" sub={low.slice(0, 2).map((i) => i.name).join(', ')} />
        <StatCard label="Purchases (last month)" value={moneyShort(purchasesMonth)} icon={Receipt} tone="amber" sub={`This month: ${moneyShort(sum(db.canteenStockMoves.filter((m) => m.type === 'Purchase' && m.date.startsWith(monthStart)), (m) => m.cost))}`} />
      </div>
      <CrudPage
        collection="canteenStock"
        noun="ingredient"
        defaults={{ unit: 'kg', qty: 0, reorderLevel: 10 }}
        toolbar={<Button variant="secondary" icon={PackagePlus} onClick={() => setMove({ type: 'Purchase', qty: 1 })}>Receive / use stock</Button>}
        fields={[
          { name: 'name', label: 'Ingredient', required: true, span: 2 },
          { name: 'unit', label: 'Unit', type: 'select', options: ['kg', 'litre', 'crate', 'bunch', 'loaf', 'tin', 'pack', 'tuber', 'bag', 'pcs'] },
          { name: 'unitCost', label: 'Unit cost', type: 'number', step: '0.01' },
          { name: 'qty', label: 'Quantity in stock', type: 'number' },
          { name: 'reorderLevel', label: 'Reorder level', type: 'number' },
          { name: 'supplier', label: 'Supplier / market', span: 2 },
        ]}
        columns={[
          { key: 'name', label: 'Ingredient', render: (i) => <div><p className="font-semibold">{i.name}</p><p className="text-xs text-slate-500">{i.supplier}</p></div> },
          { key: 'qty', label: 'In stock', render: (i) => <span className="font-bold">{i.qty} <span className="font-normal text-slate-400">{i.unit}</span></span> },
          { key: 'reorderLevel', label: 'Reorder at', hideOnMobile: true, render: (i) => `${i.reorderLevel} ${i.unit}` },
          { key: 'unitCost', label: 'Unit cost', hideOnMobile: true, render: (i) => money(i.unitCost) },
          { key: 'value', label: 'Value', hideOnMobile: true, sort: (i) => i.qty * i.unitCost, render: (i) => money(i.qty * i.unitCost) },
          { key: 'level', label: 'Level', sort: (i) => i.qty - i.reorderLevel, render: (i) => { const l = ingredientLevel(i); return <Badge tone={l.tone} dot>{l.label}</Badge>; } },
          { key: 'act', label: '', nosort: true, render: (i) => <Button size="sm" variant="soft" onClick={(e) => { e.stopPropagation(); setMove({ type: 'Purchase', qty: i.reorderLevel, ingredientId: i.id }); }}>Restock</Button> },
        ]}
      />
      <h3 className="mb-3 mt-8 text-lg font-extrabold text-slate-900 dark:text-white">Stock movements</h3>
      <DataTable
        rows={db.canteenStockMoves}
        initialSort={{ key: 'date', dir: 'desc' }}
        searchText={(m) => `${ing(m.ingredientId)?.name} ${m.type} ${m.note}`}
        columns={[
          { key: 'date', label: 'Date', render: (m) => fmtDate(m.date) },
          { key: 'ing', label: 'Ingredient', sort: (m) => ing(m.ingredientId)?.name, render: (m) => <span className="font-semibold">{ing(m.ingredientId)?.name}</span> },
          { key: 'type', label: 'Type', render: (m) => <Badge tone={m.type === 'Purchase' ? 'green' : m.type === 'Waste' ? 'red' : 'blue'}>{m.type}</Badge> },
          { key: 'qty', label: 'Qty', render: (m) => <span className={m.type === 'Purchase' ? 'text-emerald-600' : 'text-accent-600'}>{m.type === 'Purchase' ? '+' : '−'}{m.qty} {ing(m.ingredientId)?.unit}</span> },
          { key: 'cost', label: 'Cost', render: (m) => (m.cost ? money(m.cost) : '—') },
          { key: 'note', label: 'Note', hideOnMobile: true, render: (m) => <span className="text-slate-500">{m.note}</span> },
        ]}
      />
      <Modal open={!!move} onClose={() => setMove(null)} title="Kitchen stock movement" size="sm" footer={<><Button variant="secondary" onClick={() => setMove(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {move && (
          <div className="space-y-4">
            <Field label="Type"><Select value={move.type} onChange={(e) => setMove({ ...move, type: e.target.value })} options={[{ value: 'Purchase', label: 'Purchase (stock in)' }, { value: 'Used', label: 'Used in kitchen' }, { value: 'Waste', label: 'Spoilt / wasted' }]} /></Field>
            <Field label="Ingredient"><Select value={move.ingredientId || ''} onChange={(e) => setMove({ ...move, ingredientId: e.target.value })} placeholder="Select…" options={db.canteenStock.map((i) => ({ value: i.id, label: `${i.name} (${i.qty} ${i.unit})` }))} /></Field>
            <Field label="Quantity"><Input type="number" min="0" value={move.qty} onChange={(e) => setMove({ ...move, qty: e.target.value })} /></Field>
            {move.type === 'Purchase' && (
              <Field label="Total cost" hint={move.ingredientId ? `Default: ${money((Number(move.qty) || 0) * (ing(move.ingredientId)?.unitCost || 0))}` : undefined}>
                <Input type="number" min="0" value={move.cost || ''} onChange={(e) => setMove({ ...move, cost: e.target.value })} />
              </Field>
            )}
            <Field label="Note"><Input value={move.note || ''} onChange={(e) => setMove({ ...move, note: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------- Income
export function useCanteenIncome(range) {
  const db = useDB();
  return useMemo(() => {
    const termStart = db.terms.find((t) => t.id === db.settings.currentTerm)?.start || TODAY;
    const from = range === 'term' ? termStart : format(subDays(parseISO(TODAY), range === '7' ? 6 : 29), 'yyyy-MM-dd');
    const sales = db.canteenSales.filter((s) => s.date >= from && s.date <= TODAY);
    const purchases = db.canteenStockMoves.filter((m) => m.type === 'Purchase' && m.date >= from && m.date <= TODAY);
    const itemOf = Object.fromEntries(db.canteenItems.map((i) => [i.id, i]));
    const revenue = sum(sales, (s) => s.total);
    const foodCost = sum(sales.flatMap((s) => s.items), (l) => (itemOf[l.itemId]?.cost || 0) * l.qty);
    const daily = Object.entries(groupBy(sales, (s) => s.date)).sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({ date: fmtDate(date, 'd MMM'), revenue: sum(list, (s) => s.total), count: list.length }));
    const byItem = {};
    sales.forEach((s) => s.items.forEach((l) => {
      byItem[l.itemId] ||= { qty: 0, revenue: 0 };
      byItem[l.itemId].qty += l.qty;
      byItem[l.itemId].revenue += l.qty * l.price;
    }));
    const top = Object.entries(byItem).map(([id, v]) => ({ item: itemOf[id], ...v })).filter((x) => x.item).sort((a, b) => b.revenue - a.revenue);
    const byCat = CANTEEN_CATEGORIES.map((c) => ({ cat: c, revenue: sum(top.filter((t) => t.item.category === c), (t) => t.revenue) }));
    const byMethod = Object.entries(groupBy(sales, (s) => s.method)).map(([m, l]) => ({ m, revenue: sum(l, (s) => s.total), count: l.length }));
    const byBuyer = Object.entries(groupBy(sales, (s) => s.buyerType)).map(([m, l]) => ({ m, revenue: sum(l, (s) => s.total), count: l.length }));
    return { from, sales, revenue, purchases: sum(purchases, (m) => m.cost), foodCost, daily, top, byCat, byMethod, byBuyer };
  }, [db, range]);
}

function Income() {
  const L = useLookups();
  const db = useDB();
  const t = useChartTheme();
  const [range, setRange] = useState('30');
  const [receipt, setReceipt] = useState(null);
  const inc = useCanteenIncome(range);
  const item = (id) => db.canteenItems.find((i) => i.id === id);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={range} onChange={setRange} tabs={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: 'term', label: 'This term' }]} />
        <Button variant="secondary" icon={Download} className="ml-auto" onClick={() => downloadCSV(`canteen-sales-${range}`, inc.sales.map((s) => ({ Receipt: s.receiptNo, Date: s.date, Time: s.time, Customer: buyerName(s, L), Type: s.buyerType, Items: s.items.map((l) => `${l.qty}x ${item(l.itemId)?.name}`).join('; '), Total: s.total, Method: s.method })))}>Export sales</Button>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue" value={moneyShort(inc.revenue)} icon={TrendingUp} tone="green" sub={`${inc.sales.length} sales · avg ${money(inc.sales.length ? inc.revenue / inc.sales.length : 0)}`} />
        <StatCard label="Ingredient purchases" value={moneyShort(inc.purchases)} icon={Receipt} tone="red" sub="Cash spent on stock" />
        <StatCard label="Net income" value={moneyShort(inc.revenue - inc.purchases)} icon={Wallet} tone="blue" sub="Revenue − purchases" />
        <StatCard label="Food margin" value={`${pct(inc.revenue - inc.foodCost, inc.revenue)}%`} icon={Coins} tone="amber" sub={`Est. food cost ${moneyShort(inc.foodCost)}`} />
      </div>
      <Card>
        <CardHeader title="Daily revenue" subtitle={`From ${fmtDate(inc.from)}`} icon={TrendingUp} />
        <div className="h-[260px] px-2 pb-4 pt-4">
          <ResponsiveContainer>
            <BarChart data={inc.daily} margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="date" {...axisProps(t)} interval="preserveStartEnd" minTickGap={16} />
              <YAxis {...axisProps(t)} width={48} tickFormatter={(v) => compactNum(v)} />
              <Tooltip content={<ChartTooltip format={money} />} cursor={{ fill: t.soft }} />
              <Bar dataKey="revenue" name="Revenue" fill={t.primary} radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Revenue by category" icon={UtensilsCrossed} />
          <div className="space-y-4 p-5">
            {inc.byCat.map((c) => (
              <div key={c.cat}>
                <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium text-slate-600 dark:text-slate-300">{c.cat}</span><span className="font-bold">{money(c.revenue)} <span className="font-normal text-slate-400">· {pct(c.revenue, inc.revenue)}%</span></span></div>
                <Progress value={pct(c.revenue, inc.revenue)} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Best sellers" icon={TrendingUp} />
          <div className="divide-y divide-slate-100 px-5 pb-3 dark:divide-white/5">
            {inc.top.slice(0, 7).map((x, i) => (
              <div key={x.item.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
                <span className="flex-1 truncate font-medium">{x.item.name}</span>
                <span className="text-xs text-slate-500">{x.qty} sold</span>
                <span className="w-24 text-right font-bold">{money(x.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="How customers pay" icon={Wallet} />
          <div className="space-y-4 p-5">
            {inc.byMethod.map((m) => (
              <div key={m.m}>
                <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium text-slate-600 dark:text-slate-300">{m.m}</span><span className="font-bold">{pct(m.revenue, inc.revenue)}%</span></div>
                <Progress value={pct(m.revenue, inc.revenue)} tone={m.m === 'Cash' ? 'green' : m.m === 'Mobile Money' ? 'amber' : 'blue'} />
              </div>
            ))}
            <p className="label !mt-6">Customers</p>
            {inc.byBuyer.map((m) => (
              <div key={m.m} className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">{m.m}</span><span className="font-semibold">{m.count} sales · {money(m.revenue)}</span></div>
            ))}
          </div>
        </Card>
      </div>
      <h3 className="mb-3 mt-8 text-lg font-extrabold text-slate-900 dark:text-white">Sales</h3>
      <DataTable
        rows={inc.sales}
        initialSort={{ key: 'date', dir: 'desc' }}
        onRowClick={setReceipt}
        searchText={(s) => `${s.receiptNo} ${buyerName(s, L)} ${s.method} ${s.items.map((l) => item(l.itemId)?.name).join(' ')}`}
        columns={[
          { key: 'receiptNo', label: 'Receipt', render: (s) => <span className="font-mono text-xs font-semibold">{s.receiptNo}</span> },
          { key: 'date', label: 'Date', sort: (s) => `${s.date} ${s.time}`, render: (s) => `${fmtDate(s.date, 'd MMM')} · ${s.time}` },
          { key: 'buyer', label: 'Customer', sort: (s) => buyerName(s, L), render: (s) => <div><p className="font-medium">{buyerName(s, L)}</p><p className="text-xs text-slate-500">{s.buyerType}</p></div> },
          { key: 'items', label: 'Items', hideOnMobile: true, nosort: true, render: (s) => <span className="text-xs text-slate-500">{s.items.map((l) => `${l.qty}× ${item(l.itemId)?.name}`).join(', ')}</span> },
          { key: 'total', label: 'Total', render: (s) => <span className="font-bold text-emerald-600">{money(s.total)}</span> },
          { key: 'method', label: 'Paid', render: (s) => <Badge tone={s.method === 'Cash' ? 'slate' : s.method === 'Mobile Money' ? 'amber' : 'blue'}>{s.method}</Badge> },
        ]}
      />
      <PrintView open={!!receipt} onClose={() => setReceipt(null)} title="Canteen receipt">{receipt && <CanteenReceipt sale={receipt} />}</PrintView>
    </>
  );
}

// ---------------------------------------------------------------- Parent / student view
function FamilyCanteen() {
  const db = useDB();
  const { student } = usePortalStudent();
  const [tab, setTab] = useState('menu');
  const item = (id) => db.canteenItems.find((i) => i.id === id);
  const mine = db.canteenSales.filter((s) => s.studentId === student.id);
  const termStart = db.terms.find((t) => t.id === db.settings.currentTerm)?.start;
  const termSpend = sum(mine.filter((s) => s.date >= termStart), (s) => s.total);
  return (
    <>
      <PageHeader title="Canteen" subtitle={`This week's menu and ${student.firstName}'s purchases`} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Spent this term" value={money(termSpend)} icon={Wallet} tone="blue" sub={`${mine.filter((s) => s.date >= termStart).length} purchases`} />
        <StatCard label="Average per visit" value={money(mine.length ? sum(mine, (s) => s.total) / mine.length : 0)} icon={Coins} tone="green" />
        <StatCard label="Lunch from" value={money(Math.min(...db.canteenItems.filter((i) => i.category === 'Lunch').map((i) => i.price)))} icon={Soup} tone="amber" />
        <StatCard label="Today" value={todayName()} icon={CalendarDays} tone="navy" sub={`${(db.canteenMenu[todayName()]?.Lunch || []).length} lunch dishes`} />
      </div>
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'menu', label: 'Weekly menu' }, { value: 'prices', label: 'Price list' }, { value: 'history', label: 'Purchases', count: mine.length }]} />
      {tab === 'menu' && <WeeklyMenu readOnly />}
      {tab === 'prices' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {CANTEEN_CATEGORIES.map((c) => {
            const Icon = CAT_ICON[c];
            return (
              <Card key={c}>
                <CardHeader title={c} icon={Icon} />
                <div className="divide-y divide-slate-100 px-5 pb-3 dark:divide-white/5">
                  {db.canteenItems.filter((i) => i.category === c).map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                      <span className={cx(!i.available && 'text-slate-400 line-through')}>{i.name} {i.vegetarian && <Leaf className="inline h-3 w-3 text-emerald-500" />}</span>
                      <span className="shrink-0 font-bold">{money(i.price)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {tab === 'history' && (
        <DataTable
          rows={mine}
          search={false}
          initialSort={{ key: 'date', dir: 'desc' }}
          empty={<EmptyState icon={UtensilsCrossed} title="No canteen purchases yet" />}
          columns={[
            { key: 'date', label: 'Date', sort: (s) => `${s.date} ${s.time}`, render: (s) => `${fmtDate(s.date, 'EEE d MMM')} · ${s.time}` },
            { key: 'items', label: 'Items', nosort: true, render: (s) => <span className="whitespace-normal text-sm">{s.items.map((l) => `${l.qty}× ${item(l.itemId)?.name}`).join(', ')}</span> },
            { key: 'total', label: 'Total', render: (s) => <span className="font-bold">{money(s.total)}</span> },
            { key: 'method', label: 'Paid', render: (s) => <Badge tone={s.method === 'Bill to fees' ? 'blue' : 'slate'}>{s.method}</Badge> },
          ]}
        />
      )}
    </>
  );
}

export default function Canteen() {
  const user = useCurrentUser();
  const db = useDB();
  const isAccountant = user.role === 'accountant';
  const [tab, setTab] = useState(isAccountant ? 'income' : 'pos');
  if (user.role === 'parent' || user.role === 'student') return <FamilyCanteen />;
  const lowCount = db.canteenStock.filter((i) => i.qty <= i.reorderLevel).length;
  const tabs = isAccountant
    ? [{ value: 'income', label: 'Income', icon: TrendingUp }]
    : [
        { value: 'pos', label: 'Point of sale', icon: ShoppingBasket },
        { value: 'items', label: 'Menu items', icon: UtensilsCrossed, count: db.canteenItems.length },
        { value: 'menu', label: 'Weekly menu', icon: CalendarDays },
        { value: 'stock', label: 'Kitchen stock', icon: Package, count: lowCount || undefined },
        { value: 'income', label: 'Income', icon: TrendingUp },
      ];
  return (
    <>
      <PageHeader title="Canteen" subtitle="Sell food, plan the menu, manage kitchen stock and track income" actions={<Badge tone="blue">Today: {todayName()}</Badge>} />
      {tabs.length > 1 && <Tabs className="mb-6" value={tab} onChange={setTab} tabs={tabs} />}
      {tab === 'pos' && <POS />}
      {tab === 'items' && <MenuItems />}
      {tab === 'menu' && <WeeklyMenu />}
      {tab === 'stock' && <KitchenStock />}
      {tab === 'income' && <Income />}
    </>
  );
}

