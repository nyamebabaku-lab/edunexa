// School houses (e.g. for sports and boarding). Students and halls choose from this list.
import { Home } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useCurrentUser } from '../../data/selectors';
import { Badge } from '../../components/ui';
import CrudPage from '../../components/CrudPage';

export const HOUSE_COLOURS = ['#dc2626', '#16a34a', '#2563eb', '#ca8a04', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#475569'];

export default function Houses() {
  const houses = useDB((s) => s.houses || []);
  const students = useDB((s) => s.students);
  const staff = useDB((s) => s.staff);
  const L = useLookups();
  const user = useCurrentUser();
  const canEdit = ['admin', 'headteacher', 'superadmin'].includes(user?.role);
  const members = (name) => students.filter((s) => s.house && s.house.trim().toLowerCase() === String(name).trim().toLowerCase());
  const before = {};
  // Renaming a house moves its students and halls to the new name.
  const onSaved = (rec, v) => {
    const db = useDB.getState();
    const old = before.name;
    if (old && old !== rec.name) {
      db.students.filter((s) => s.house === old).forEach((s) => db.update('students', s.id, { house: rec.name }));
      db.dorms.filter((d) => d.house === old).forEach((d) => db.update('dorms', d.id, { house: rec.name }));
    }
    void v;
  };
  const onDelete = (ids) => {
    const db = useDB.getState();
    const names = new Set(db.houses.filter((h) => ids.includes(h.id)).map((h) => h.name));
    db.students.filter((s) => names.has(s.house)).forEach((s) => db.update('students', s.id, { house: '' }));
    db.dorms.filter((d) => names.has(d.house)).forEach((d) => db.update('dorms', d.id, { house: '' }));
    db.removeMany('houses', ids);
  };
  return (
    <CrudPage
      collection="houses"
      noun="house"
      canEdit={canEdit}
      rows={[...houses].sort((a, b) => a.name.localeCompare(b.name))}
      defaults={{ colour: HOUSE_COLOURS[houses.length % HOUSE_COLOURS.length] }}
      toRecord={(v) => {
        const existing = houses.find((h) => h.id === v.id);
        before.name = existing?.name;
        return { ...v, name: v.name.trim() };
      }}
      onSaved={onSaved}
      onDelete={onDelete}
      deleteNote={(list) => { const n = list.reduce((a, h) => a + members(h.name).length, 0); return n ? `${n} student${n === 1 ? ' is' : 's are'} taken out of ${list.length === 1 ? 'this house' : 'these houses'} (and halls lose the house name).` : ''; }}
      searchText={(h) => `${h.name} ${L.staffName(h.masterId)}`}
      fields={[
        { name: 'name', label: 'House name', required: true, placeholder: 'e.g. Aggrey' },
        { name: 'colour', label: 'Colour', type: 'custom', render: (v, set) => (
          <div className="flex flex-wrap gap-2">
            {HOUSE_COLOURS.map((c) => <button type="button" key={c} aria-label={c} onClick={() => set(c)} className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ${v.colour === c ? 'ring-slate-800 dark:ring-white' : 'ring-transparent'}`} style={{ background: c }} />)}
          </div>
        ) },
        { name: 'masterId', label: 'House master / mistress', type: 'select', options: staff.filter((s) => s.status !== 'Exited').map((s) => ({ value: s.id, label: `${s.title ? s.title + ' ' : ''}${s.firstName} ${s.lastName}` })), placeholder: 'None', span: 2 },
        { name: 'motto', label: 'Motto / note', span: 2 },
      ]}
      columns={[
        { key: 'name', label: 'House', render: (h) => <span className="flex items-center gap-2 font-semibold"><span className="h-3.5 w-3.5 rounded-full" style={{ background: h.colour || '#94a3b8' }} />{h.name}</span> },
        { key: 'master', label: 'House master', hideOnMobile: true, render: (h) => (h.masterId ? L.staffName(h.masterId) : '—') },
        { key: 'students', label: 'Students', sort: (h) => members(h.name).length, render: (h) => <Badge tone="blue"><Home className="mr-1 inline h-3 w-3" />{members(h.name).length}</Badge> },
      ]}
    />
  );
}
