import { useState } from 'react';
import { Package, AlertCircle, ShoppingCart, Truck, PackagePlus, CheckCircle2, Boxes } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, stockLevel, TODAY } from '../../data/selectors';
import { money, moneyShort, fmtDate, fullName, sum, uid } from '../../lib/format';
import { PageHeader, Tabs, Badge, Button, StatCard, Modal, Field, Select, Input, DataTable, toast } from '../../components/ui';
import CrudPage from '../../components/CrudPage';

const CATS = ['Uniforms', 'Stationery', 'Books', 'Cleaning', 'Lab', 'Kitchen', 'Sports', 'ICT'];

export default function Store() {
  const db = useDB();
  const L = useLookups();
  const [tab, setTab] = useState('items');
  const [move, setMove] = useState(null);
  const item = (id) => db.storeItems.find((i) => i.id === id);

  const saveMove = () => {
    const it = item(move.itemId);
    const qty = Number(move.qty);
    if (!it || !qty || qty <= 0) return toast.error('Select an item and quantity');
    if (move.type !== 'In' && qty > it.stock) return toast.error('Not enough stock', `${it.stock} ${it.unit} available`);
    const amount = move.type === 'Sale' ? qty * it.price : 0;
    db.add('stockMoves', { itemId: it.id, type: move.type, qty, date: TODAY, note: move.note || (move.type === 'In' ? 'Stock received' : move.type === 'Sale' ? 'Sold to student' : 'Issued for school use'), studentId: move.studentId || null, amount });
    db.update('storeItems', it.id, { stock: it.stock + (move.type === 'In' ? qty : -qty) });
    if (move.type === 'Sale' && move.billTo === 'fees' && move.studentId) {
      db.add('invoices', { id: uid('inv'), invoiceNo: `INV-ST-${String(db.invoices.length + 1).padStart(4, '0')}`, studentId: move.studentId, termId: db.settings.currentTerm, date: TODAY, dueDate: TODAY, items: [{ name: `${it.name} × ${qty}`, amount }], discount: 0, discountReason: '', total: amount });
      toast.success('Sale recorded', `${money(amount)} added to ${L.studentName(move.studentId)}'s fees`);
    } else toast.success('Stock updated', `${it.name}: ${move.type === 'In' ? '+' : '−'}${qty}`);
    setMove(null);
  };

  const receivePO = (po) => {
    po.items.forEach((li) => {
      const it = item(li.itemId);
      db.update('storeItems', li.itemId, { stock: it.stock + li.qty });
      db.add('stockMoves', { itemId: li.itemId, type: 'In', qty: li.qty, date: TODAY, note: `Received on ${po.poNo}`, studentId: null, amount: 0 });
    });
    db.update('purchaseOrders', po.id, { status: 'Received' });
    toast.success('Purchase order received', 'Stock levels updated');
  };

  const low = db.storeItems.filter((i) => i.stock <= i.reorderLevel);
  const sales30 = db.stockMoves.filter((m) => m.type === 'Sale');

  return (
    <>
      <PageHeader
        title="Store & Inventory"
        subtitle="Uniforms, books, stationery and supplies"
        actions={
          <>
            <Button variant="secondary" icon={PackagePlus} onClick={() => setMove({ type: 'In', qty: 1 })}>Receive stock</Button>
            <Button icon={ShoppingCart} onClick={() => setMove({ type: 'Sale', qty: 1, billTo: 'fees' })}>Sell to student</Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Items" value={db.storeItems.length} icon={Boxes} />
        <StatCard label="Stock value" value={moneyShort(sum(db.storeItems, (i) => i.stock * i.cost))} icon={Package} tone="navy" sub="At cost price" />
        <StatCard label="Low / out of stock" value={low.length} icon={AlertCircle} tone="red" />
        <StatCard label="Sales recorded" value={moneyShort(sum(sales30, (m) => m.amount))} icon={ShoppingCart} tone="green" sub={`${sales30.length} transactions`} />
      </div>
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'items', label: 'Items' }, { value: 'moves', label: 'Stock movement' }, { value: 'po', label: 'Purchase orders' }, { value: 'suppliers', label: 'Suppliers' }]} />

      {tab === 'items' && (
        <CrudPage collection="storeItems" noun="item" defaults={{ category: 'Stationery', unit: 'pcs', stock: 0, reorderLevel: 10 }}
          toRecord={(v) => (v.sku ? v : { ...v, sku: `SKU-${String(db.storeItems.length + 1).padStart(4, '0')}` })}
          fields={[
            { name: 'name', label: 'Item name', required: true, span: 2 }, { name: 'category', label: 'Category', type: 'select', options: CATS },
            { name: 'unit', label: 'Unit', type: 'select', options: ['pcs', 'set', 'pack', 'box', 'ream', 'bag', 'gal'] },
            { name: 'cost', label: 'Cost price', type: 'number' }, { name: 'price', label: 'Selling price', type: 'number', required: true },
            { name: 'stock', label: 'Current stock', type: 'number' }, { name: 'reorderLevel', label: 'Reorder level', type: 'number' },
            { name: 'supplierId', label: 'Supplier', type: 'select', options: db.suppliers.map((s) => ({ value: s.id, label: s.name })) },
          ]}
          columns={[
            { key: 'name', label: 'Item', render: (i) => <div><p className="font-semibold">{i.name}</p><p className="text-xs text-slate-500">{i.sku}</p></div> },
            { key: 'category', label: 'Category', hideOnMobile: true, render: (i) => <Badge tone="blue">{i.category}</Badge> },
            { key: 'price', label: 'Price', render: (i) => money(i.price) },
            { key: 'stock', label: 'Stock', render: (i) => <span className="font-bold">{i.stock} <span className="font-normal text-slate-400">{i.unit}</span></span> },
            { key: 'level', label: 'Level', sort: (i) => i.stock - i.reorderLevel, render: (i) => { const s = stockLevel(i); return <Badge tone={s.tone} dot>{s.label}</Badge>; } },
          ]}
        />
      )}
      {tab === 'moves' && (
        <DataTable
          rows={db.stockMoves}
          initialSort={{ key: 'date', dir: 'desc' }}
          searchText={(m) => `${item(m.itemId)?.name} ${m.note} ${m.studentId ? L.studentName(m.studentId) : ''}`}
          columns={[
            { key: 'date', label: 'Date', render: (m) => fmtDate(m.date) },
            { key: 'item', label: 'Item', render: (m) => <span className="font-semibold">{item(m.itemId)?.name}</span> },
            { key: 'type', label: 'Type', render: (m) => <Badge tone={m.type === 'In' ? 'green' : m.type === 'Sale' ? 'blue' : 'amber'}>{m.type}</Badge> },
            { key: 'qty', label: 'Qty', render: (m) => <span className={m.type === 'In' ? 'text-emerald-600' : 'text-accent-600'}>{m.type === 'In' ? '+' : '−'}{m.qty}</span> },
            { key: 'note', label: 'Details', hideOnMobile: true, render: (m) => <span className="text-slate-500">{m.studentId ? L.studentName(m.studentId) : m.note}</span> },
            { key: 'amount', label: 'Value', render: (m) => (m.amount ? money(m.amount) : '—') },
          ]}
        />
      )}
      {tab === 'po' && (
        <DataTable
          rows={db.purchaseOrders}
          columns={[
            { key: 'poNo', label: 'PO', render: (p) => <span className="font-mono font-semibold">{p.poNo}</span> },
            { key: 'date', label: 'Date', render: (p) => fmtDate(p.date) },
            { key: 'supplier', label: 'Supplier', render: (p) => db.suppliers.find((s) => s.id === p.supplierId)?.name },
            { key: 'items', label: 'Items', hideOnMobile: true, render: (p) => <span className="text-xs text-slate-500">{p.items.map((li) => `${item(li.itemId)?.name} ×${li.qty}`).join(', ')}</span> },
            { key: 'total', label: 'Total', render: (p) => money(sum(p.items, (li) => li.qty * li.cost)) },
            { key: 'status', label: 'Status', render: (p) => <Badge tone={p.status === 'Received' ? 'green' : p.status === 'Ordered' ? 'blue' : 'slate'}>{p.status}</Badge> },
            { key: 'act', label: '', nosort: true, render: (p) => p.status !== 'Received' && <Button size="sm" variant="soft" icon={p.status === 'Draft' ? Truck : CheckCircle2} onClick={() => (p.status === 'Draft' ? (db.update('purchaseOrders', p.id, { status: 'Ordered' }), toast.success('PO sent to supplier')) : receivePO(p))}>{p.status === 'Draft' ? 'Send' : 'Receive'}</Button> },
          ]}
          toolbar={<Button icon={PackagePlus} onClick={() => {
            const lines = low.map((i) => ({ itemId: i.id, qty: i.reorderLevel * 3, cost: i.cost }));
            if (!lines.length) return toast.info('Nothing below reorder level');
            db.add('purchaseOrders', { poNo: `PO-2026-${String(db.purchaseOrders.length + 13).padStart(3, '0')}`, supplierId: low[0].supplierId, date: TODAY, items: lines, status: 'Draft' });
            toast.success('Draft PO created', `${lines.length} low-stock items`);
          }}>Auto-create PO from low stock</Button>}
        />
      )}
      {tab === 'suppliers' && (
        <CrudPage collection="suppliers" noun="supplier"
          fields={[{ name: 'name', label: 'Company', required: true, span: 2 }, { name: 'contact', label: 'Contact person' }, { name: 'phone', label: 'Phone', type: 'tel' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'category', label: 'Supplies', type: 'select', options: CATS }]}
          columns={[{ key: 'name', label: 'Supplier', render: (s) => <span className="font-semibold">{s.name}</span> }, { key: 'category', label: 'Category', render: (s) => <Badge tone="blue">{s.category}</Badge> }, { key: 'contact', label: 'Contact' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email', hideOnMobile: true }]}
        />
      )}

      <Modal open={!!move} onClose={() => setMove(null)} title={move?.type === 'In' ? 'Receive stock' : move?.type === 'Sale' ? 'Sell to student' : 'Issue stock'} size="sm"
        footer={<><Button variant="secondary" onClick={() => setMove(null)}>Cancel</Button><Button onClick={saveMove}>Save</Button></>}>
        {move && (
          <div className="space-y-4">
            <Field label="Item"><Select value={move.itemId || ''} onChange={(e) => setMove({ ...move, itemId: e.target.value })} placeholder="Select item…" options={db.storeItems.map((i) => ({ value: i.id, label: `${i.name} (${i.stock} in stock · ${money(i.price)})` }))} /></Field>
            <Field label="Quantity"><Input type="number" min="1" value={move.qty} onChange={(e) => setMove({ ...move, qty: e.target.value })} /></Field>
            {move.type === 'Sale' && (
              <>
                <Field label="Student"><Select value={move.studentId || ''} onChange={(e) => setMove({ ...move, studentId: e.target.value })} placeholder="Select student…" options={[...db.students].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((s) => ({ value: s.id, label: `${fullName(s)} · ${L.className(s.classId)}` }))} /></Field>
                <Field label="Payment"><Select value={move.billTo} onChange={(e) => setMove({ ...move, billTo: e.target.value })} options={[{ value: 'fees', label: "Add to student's fee bill" }, { value: 'cash', label: 'Paid now (cash / MoMo)' }]} /></Field>
                {move.itemId && <p className="rounded-xl bg-brand-50 p-3 text-sm font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">Total: {money((Number(move.qty) || 0) * (item(move.itemId)?.price || 0))}</p>}
              </>
            )}
            {move.type === 'In' && <Field label="Note"><Input value={move.note || ''} onChange={(e) => setMove({ ...move, note: e.target.value })} placeholder="e.g. Delivery from supplier" /></Field>}
          </div>
        )}
      </Modal>
    </>
  );
}
