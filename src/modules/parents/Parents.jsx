import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MessageSquare } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLookups, useBalances, useCurrentUser, isGuardianOf } from '../../data/selectors';
import ChildRequests from './ChildRequests';
import { LIVE } from '../../config';
import { deleteParents } from '../../lib/cleanup';
import { fullName, money } from '../../lib/format';
import { Avatar, Badge, PageHeader, Modal, Card, Button, cx } from '../../components/ui';
import CrudPage from '../../components/CrudPage';
import { photoKey } from '../../data/photos';

export default function Parents() {
  const students = useDB((s) => s.students);
  const L = useLookups();
  const bal = useBalances();
  const navigate = useNavigate();
  const [view, setView] = useState(null);
  const user = useCurrentUser();
  const kids = (pid) => students.filter((s) => isGuardianOf(s, pid));
  const users = useDB((s) => s.users);
  const onApp = new Set(users.filter((u) => u.role === 'parent').map((u) => u.linkedId));
  const familyBalance = (pid) => kids(pid).reduce((a, s) => a + bal.get(s.id).balance, 0);

  return (
    <>
      <PageHeader title="Parents & Guardians" subtitle={LIVE ? 'Parents join from the EduNexa app with the school code and their child\'s admission number' : 'Family contacts, linked children and fee positions'} />
      {LIVE && <ChildRequests />}
      <CrudPage
        collection="parents"
        noun="parent"
        onRowClick={setView}
        canAdd={!LIVE}
        canDelete={user?.role === 'admin' || user?.role === 'superadmin'}
        onDelete={deleteParents}
        deleteNote={(list) => { const n = list.reduce((a, p) => a + kids(p.id).length, 0); return n ? `${n} child${n === 1 ? ' stays' : 'ren stay'} in the school with no parent linked — choose a new parent for them later.` : ''; }}
        defaults={{ title: 'Mrs.', gender: 'Female', relation: 'Mother' }}
        searchText={(p) => `${p.firstName} ${p.lastName} ${p.phone} ${p.email} ${kids(p.id).map(fullName).join(' ')}`}
        fields={[
          { name: 'title', label: 'Title', type: 'select', options: ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Rev.'] },
          { name: 'relation', label: 'Relationship', type: 'select', options: ['Father', 'Mother', 'Guardian', 'Uncle', 'Aunt', 'Grandparent'] },
          { name: 'firstName', label: 'First name', required: true },
          { name: 'lastName', label: 'Surname', required: true },
          { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] },
          { name: 'phone', label: 'Phone', type: 'tel', required: true },
          { name: 'altPhone', label: 'Alternative phone', type: 'tel' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'occupation', label: 'Occupation' },
          { name: 'address', label: 'Address' },
        ]}
        columns={[
          {
            key: 'name',
            label: 'Parent',
            sort: (p) => p.lastName,
            render: (p) => (
              <div className="flex items-center gap-3">
                <Avatar name={`${p.firstName} ${p.lastName}`} size="sm" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{p.title} {p.firstName} {p.lastName}</p>
                  <p className="text-xs text-slate-500">{[p.relation, p.occupation].filter(Boolean).join(' · ')}{LIVE && (onApp.has(p.id) ? <span className="ml-1.5 font-semibold text-emerald-600">· On the app</span> : <span className="ml-1.5 text-slate-400">· No app account</span>)}</p>
                </div>
              </div>
            ),
          },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email', hideOnMobile: true },
          {
            key: 'children',
            label: 'Children',
            sort: (p) => kids(p.id).length,
            render: (p) => (
              <div className="flex flex-wrap gap-1">
                {kids(p.id).map((k) => (
                  <Badge key={k.id} tone="blue">{k.firstName} · {L.className(k.classId)}</Badge>
                ))}
              </div>
            ),
          },
          { key: 'balance', label: 'Family balance', sort: (p) => familyBalance(p.id), render: (p) => { const b = familyBalance(p.id); return <span className={cx('font-semibold', b > 0 ? 'text-accent-600' : 'text-emerald-600')}>{money(b)}</span>; } },
        ]}
      />
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${view.title} ${view.firstName} ${view.lastName}` : ''} subtitle={view?.relation}>
        {view && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <a href={`tel:${view.phone}`}><Button variant="soft" icon={Phone}>{view.phone}</Button></a>
              <Button variant="secondary" icon={MessageSquare} onClick={() => navigate('/communication')}>Message</Button>
            </div>
            <p className="text-sm text-slate-500">{view.address} · {view.email}</p>
            <p className="label !mt-6">Children</p>
            {kids(view.id).map((k) => (
              <Card key={k.id} className="flex cursor-pointer items-center gap-3 p-3 hover:shadow-lift" onClick={() => navigate(`/students/${k.id}`)}>
                <Avatar name={fullName(k)} photo={photoKey('Student', k.id)} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{fullName(k)}</p>
                  <p className="text-xs text-slate-500">{L.className(k.classId)} · {k.admissionNo}</p>
                </div>
                <span className={cx('text-sm font-bold', bal.get(k.id).balance > 0 ? 'text-accent-600' : 'text-emerald-600')}>{money(bal.get(k.id).balance)}</span>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
