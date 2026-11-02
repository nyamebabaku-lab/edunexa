// Demo data for the school canteen. Uses its own RNG so the rest of the seed is unchanged.
import { addDays, format, isWeekend, parseISO } from 'date-fns';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CANTEEN_CATEGORIES = ['Breakfast', 'Lunch', 'Snacks', 'Drinks'];
export const MEAL_SLOTS = ['Breakfast', 'Lunch'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const pad = (n, w = 3) => String(n).padStart(w, '0');

export function buildCanteen({ students, classes, staff, today }) {
  const r = rng(4242);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const int = (a, b) => Math.floor(r() * (b - a + 1)) + a;

  // ---------- Staff ----------
  const canteenStaff = [
    { first: 'Adwoa', last: 'Sarpong', title: 'Mrs.', gender: 'Female', role: 'Canteen Manager', salary: 4200, allowances: 500, qualification: 'HND Catering' },
    { first: 'Yaa', last: 'Boateng', title: 'Ms.', gender: 'Female', role: 'Canteen Assistant', salary: 2100, allowances: 200, qualification: 'WASSCE' },
    { first: 'Kweku', last: 'Annan', title: 'Mr.', gender: 'Male', role: 'Canteen Assistant', salary: 2100, allowances: 200, qualification: 'WASSCE' },
  ].map((o, i) => ({
    id: `stf_c0${i + 1}`,
    staffNo: `BFIS/ST/C0${i + 1}`,
    title: o.title,
    firstName: o.first,
    lastName: o.last,
    gender: o.gender,
    role: o.role,
    department: 'Canteen',
    phone: `024${int(1000000, 9999999)}`,
    email: `${o.first}.${o.last}@brightfuture.edu.gh`.toLowerCase(),
    qualification: o.qualification,
    salary: o.salary,
    allowances: o.allowances,
    dateJoined: i === 0 ? '2023-01-09' : '2025-09-01',
    status: 'Active',
    ssnitNo: `C0${int(10000000, 99999999)}`,
    bank: pick(['GCB Bank', 'Ecobank', 'Fidelity Bank']),
    accountNo: `${int(1000000000, 9999999999)}`,
  }));
  const manager = canteenStaff[0];

  // ---------- Menu items ----------
  const defs = [
    ['Hausa Koko & Koose', 'Breakfast', 8, 'Spicy millet porridge with bean cakes'],
    ['Tea, Bread & Omelette', 'Breakfast', 12, 'Milo or Lipton tea with butter bread and egg'],
    ['Oats with Milk', 'Breakfast', 10, 'Warm oats, evaporated milk and sugar'],
    ['Tom Brown', 'Breakfast', 8, 'Roasted maize porridge with groundnut'],
    ['Jollof Rice & Chicken', 'Lunch', 35, 'Party jollof with grilled chicken and coleslaw'],
    ['Waakye Special', 'Lunch', 30, 'Waakye with gari, spaghetti, egg, fish and shito'],
    ['Fried Rice & Chicken', 'Lunch', 35, 'Vegetable fried rice with fried chicken'],
    ['Banku & Tilapia', 'Lunch', 40, 'Grilled tilapia with banku, pepper and onions'],
    ['Red Red & Plantain', 'Lunch', 25, 'Bean stew in palm oil with fried ripe plantain'],
    ['Fufu & Light Soup', 'Lunch', 40, 'Fufu with goat light soup'],
    ['Kenkey & Fried Fish', 'Lunch', 25, 'Ga kenkey, fried fish, pepper and shito'],
    ['Yam & Kontomire Stew', 'Lunch', 25, 'Boiled yam with kontomire and egg stew'],
    ['Spaghetti & Meatballs', 'Lunch', 28, 'Spaghetti in tomato sauce with beef meatballs'],
    ['Meat Pie', 'Snacks', 10, 'Flaky pastry with minced beef'],
    ['Sausage Roll', 'Snacks', 8, 'Baked sausage roll'],
    ['Bofrot (3 pcs)', 'Snacks', 5, 'Ghanaian puff-puff'],
    ['Kelewele', 'Snacks', 10, 'Spiced fried plantain with groundnuts'],
    ['Plantain Chips', 'Snacks', 5, 'Crunchy plantain chips'],
    ['Doughnut', 'Snacks', 6, 'Sugar-glazed doughnut'],
    ['Sobolo', 'Drinks', 5, 'Chilled hibiscus drink'],
    ['Bottled Water (500ml)', 'Drinks', 3, 'Voltic mineral water'],
    ['Fresh Pineapple Juice', 'Drinks', 10, 'Freshly pressed, no added sugar'],
    ['Asaana', 'Drinks', 5, 'Caramelised corn drink'],
    ['Yoghurt', 'Drinks', 8, 'Strawberry yoghurt (Fan Yogo)'],
    ['Cold Milo', 'Drinks', 7, 'Chocolate malt drink'],
  ];
  const canteenItems = defs.map(([name, category, price, description], i) => ({
    id: `cfi_${pad(i + 1)}`,
    name,
    category,
    price,
    cost: Math.round(price * (0.48 + r() * 0.14) * 100) / 100,
    description,
    available: i !== 9, // Fufu sold out today
    vegetarian: ['Hausa Koko & Koose', 'Oats with Milk', 'Tom Brown', 'Red Red & Plantain', 'Kelewele', 'Plantain Chips', 'Bofrot (3 pcs)', 'Doughnut', 'Yam & Kontomire Stew'].includes(name) || category === 'Drinks',
  }));
  const byCat = (c) => canteenItems.filter((i) => i.category === c).map((i) => i.id);

  // ---------- Weekly menu ----------
  const bf = byCat('Breakfast');
  const lunch = byCat('Lunch');
  const canteenMenu = Object.fromEntries(
    DAYS.map((d, di) => [
      d,
      {
        Breakfast: [bf[di % bf.length], bf[(di + 1) % bf.length]],
        Lunch: [lunch[di % lunch.length], lunch[(di + 3) % lunch.length], lunch[(di + 6) % lunch.length]],
      },
    ]),
  );

  // ---------- Ingredients ----------
  const ing = [
    ['Rice (perfumed)', 'kg', 18, 50, 'Makola Wholesale'], ['Chicken (frozen)', 'kg', 58, 30, 'Agro-Poultry Ltd'], ['Tilapia', 'kg', 70, 15, 'Tema Fish Market'],
    ['Vegetable oil', 'litre', 35, 20, 'Makola Wholesale'], ['Tomatoes', 'kg', 25, 20, 'Agbogbloshie Market'], ['Onions', 'kg', 15, 15, 'Agbogbloshie Market'],
    ['Plantain', 'bunch', 45, 8, 'Agbogbloshie Market'], ['Beans (black-eyed)', 'kg', 22, 15, 'Makola Wholesale'], ['Flour', 'kg', 14, 25, 'GAFCO'],
    ['Eggs', 'crate', 75, 6, 'Agro-Poultry Ltd'], ['Bread (sliced)', 'loaf', 15, 10, 'Butterfly Bakery'], ['Evaporated milk', 'tin', 12, 24, 'Makola Wholesale'],
    ['Sugar', 'kg', 16, 15, 'Makola Wholesale'], ['Cooking gas (LPG)', 'kg', 18, 30, 'GOIL'], ['Bottled water', 'pack', 30, 10, 'Voltic GH'],
    ['Hibiscus leaves', 'kg', 40, 4, 'Agbogbloshie Market'], ['Yam', 'tuber', 25, 15, 'Agbogbloshie Market'], ['Spaghetti', 'pack', 12, 20, 'Makola Wholesale'],
  ];
  const canteenStock = ing.map(([name, unit, unitCost, reorderLevel, supplier], i) => ({
    id: `cin_${pad(i + 1)}`,
    name,
    unit,
    unitCost,
    reorderLevel,
    supplier,
    qty: [2, 5, 11].includes(i) ? int(1, reorderLevel - 1) : int(reorderLevel + 5, reorderLevel * 4),
  }));

  // ---------- School days this term ----------
  const days = [];
  for (let d = parseISO('2026-09-08'); format(d, 'yyyy-MM-dd') < today; d = addDays(d, 1)) if (!isWeekend(d)) days.push(d);

  const salesDays = parseISO(today).getDay() % 6 ? [...days, parseISO(today)] : days;

  // Weekly purchases & usage
  const canteenStockMoves = [];
  salesDays.forEach((d, i) => {
    if (format(d, 'EEEE') !== 'Monday') return;
    canteenStock.forEach((s) => {
      const q = Math.max(1, Math.round(s.reorderLevel * (0.4 + r() * 0.3)));
      canteenStockMoves.push({ id: `csm_${canteenStockMoves.length + 1}`, ingredientId: s.id, type: 'Purchase', qty: q, cost: Math.round(q * s.unitCost), date: format(d, 'yyyy-MM-dd'), note: s.supplier });
      const usedOn = format(addDays(d, 4), 'yyyy-MM-dd');
      if (usedOn <= today) canteenStockMoves.push({ id: `csm_${canteenStockMoves.length + 1}`, ingredientId: s.id, type: 'Used', qty: Math.max(1, Math.round(q * (0.85 + r() * 0.2))), cost: 0, date: usedOn, note: 'Weekly kitchen usage' });
    });
    if (i % 3 === 0 && format(addDays(d, 2), 'yyyy-MM-dd') <= today) canteenStockMoves.push({ id: `csm_${canteenStockMoves.length + 1}`, ingredientId: 'cin_005', type: 'Waste', qty: int(1, 3), cost: 0, date: format(addDays(d, 2), 'yyyy-MM-dd'), note: 'Spoilt tomatoes' });
  });

  // ---------- Sales ----------
  const eligible = students.filter((s) => classes.find((c) => c.id === s.classId)?.section !== 'Early Years');
  const snacks = byCat('Snacks');
  const drinks = byCat('Drinks');
  const price = Object.fromEntries(canteenItems.map((i) => [i.id, i.price]));
  const canteenSales = [];
  salesDays.forEach((d) => {
    const dayName = format(d, 'EEEE');
    const menu = canteenMenu[dayName];
    const isToday = format(d, 'yyyy-MM-dd') === today;
    const n = isToday ? int(18, 26) : int(55, 85);
    for (let k = 0; k < n; k++) {
      const breakfast = isToday ? r() < 0.7 : r() < 0.25;
      const lines = [];
      if (breakfast) lines.push({ itemId: pick(menu.Breakfast), qty: 1 });
      else if (r() < 0.75) lines.push({ itemId: pick(menu.Lunch), qty: 1 });
      if (r() < 0.45) lines.push({ itemId: pick(snacks), qty: int(1, 2) });
      if (r() < 0.6) lines.push({ itemId: pick(drinks), qty: 1 });
      if (!lines.length) lines.push({ itemId: pick(snacks), qty: 1 });
      const items = lines.map((l) => ({ ...l, price: price[l.itemId] }));
      const roll = r();
      const buyerType = roll < 0.76 ? 'Student' : roll < 0.95 ? 'Staff' : 'Visitor';
      const time = breakfast ? `07:${pad(int(10, 55), 2)}` : isToday || r() < 0.4 ? `10:${pad(int(0, 29), 2)}` : `12:${pad(int(30, 59), 2)}`;
      canteenSales.push({
        id: `csl_${pad(canteenSales.length + 1, 5)}`,
        receiptNo: `CNT-${pad(canteenSales.length + 1, 5)}`,
        date: format(d, 'yyyy-MM-dd'),
        time,
        items,
        total: items.reduce((a, i) => a + i.price * i.qty, 0),
        method: r() < 0.62 ? 'Cash' : 'Mobile Money',
        buyerType,
        studentId: buyerType === 'Student' ? pick(eligible).id : null,
        staffId: buyerType === 'Staff' ? pick(staff).id : null,
        servedBy: pick(canteenStaff).id,
      });
    }
  });

  return { canteenStaff, managerId: manager.id, canteenItems, canteenMenu, canteenStock, canteenStockMoves, canteenSales };
}
