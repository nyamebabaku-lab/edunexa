// Super Admin: every school on EduNexa — approve, suspend, re-activate or delete; plus the platform dashboard.
import { useNavigate } from 'react-router-dom';
import { Building2, Check, Ban, CircleCheck, Trash2, Users, Hourglass, School, UserCheck, GraduationCap } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser } from '../../data/selectors';
import { useLive, setSchoolStatus, deleteSchool } from '../../data/sync';
import { useAccountActions } from './Accounts';
import { fmtDate } from '../../lib/format';
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, IconButton, PageHeader, StatCard, confirmDialog, Spinner } from '../../components/ui';
import { ROLES } from '../../lib/permissions';

const TONE = { pending: 'amber', active: 'green', suspended: 'red' };

function SchoolLogo({ s, size = 'h-10 w-10' }) {
  const logo = s.settings?.logo;
  return logo ? <img src={logo} alt="" className={`${size} shrink-0 rounded-xl bg-white object-contain p-0.5 ring-1 ring-slate-100`} /> : <span className={`${size} flex shrink-0 items-center justify-center rounded-xl text-white`} style={{ background: s.settings?.theme?.brand || '#2556eb' }}><School className="h-5 w-5" /></span>;
}

function useSchoolRows() {
  const schools = useLive((s) => s.schools);
  const stats = useLive((s) => s.stats);
  const users = useDB((s) => s.users);
  return schools.map((s) => ({ ...s, owner: users.find((u) => u.id === s.owner_id), students: stats[s.id]?.students || 0, accounts: stats[s.id]?.accounts || 0, pendingAccounts: users.filter((u) => u.schoolId === s.id && u.status === 'Pending').length }));
}

function SchoolActions({ s }) {
  const { busy, run } = useAccountActions();
  const act = (status) => {
    let reason = null;
    if (status === 'suspended') {
      reason = window.prompt(`Reason for suspending ${s.name} (the school will see it):`, '');
      if (reason === null) return;
    }
    run(s.id, () => setSchoolStatus(s.id, status, reason), `${s.name} ${status === 'active' ? (s.status === 'pending' ? 'approved' : 'activated') : 'suspended'}`);
  };
  const remove = async () => {
    if (!(await confirmDialog(`Delete ${s.name}?`, 'Every record of this school (students, fees, results…) and every account in it will be permanently deleted. This cannot be undone.', { confirmLabel: 'Delete school' }))) return;
    if (window.prompt(`Type the school name to confirm: ${s.name}`) !== s.name) return;
    run(s.id, () => deleteSchool(s.id), 'School deleted');
  };
  if (busy) return <Spinner className="ml-auto h-5 w-5 text-brand-600" />;
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {s.status === 'pending' && <Button size="sm" icon={Check} onClick={() => act('active')}>Approve</Button>}
      {s.status === 'suspended' && <Button size="sm" variant="secondary" icon={CircleCheck} onClick={() => act('active')}>Activate</Button>}
      {s.status === 'active' && <IconButton icon={Ban} label="Suspend school" onClick={() => act('suspended')} />}
      <IconButton icon={Trash2} label="Delete school" tone="soft-red" onClick={remove} />
    </div>
  );
}

export default function Schools() {
  const rows = useSchoolRows();
  const navigate = useNavigate();
  const columns = [
    {
      key: 'name', label: 'School', sort: (s) => s.name,
      render: (s) => (
        <div className="flex items-center gap-3">
          <SchoolLogo s={s} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-white">{s.name}</p>
            <p className="text-xs text-slate-500">{s.city || '—'} · code <span className="font-mono">{s.code}</span></p>
          </div>
        </div>
      ),
    },
    { key: 'owner', label: 'Owner', hideOnMobile: true, render: (s) => (s.owner ? <span className="text-sm">{s.owner.name}<br /><span className="text-xs text-slate-500">{[s.owner.email, s.owner.phone].filter(Boolean).join(' · ')}</span></span> : <span className="text-xs text-slate-400">—</span>) },
    { key: 'students', label: 'Students', sort: (s) => s.students, render: (s) => <span className="font-semibold">{s.students}</span> },
    { key: 'accounts', label: 'Accounts', sort: (s) => s.accounts, render: (s) => <span>{s.accounts}{s.pendingAccounts > 0 && <Badge tone="amber" className="ml-2">{s.pendingAccounts} pending</Badge>}</span> },
    { key: 'created_at', label: 'Registered', hideOnMobile: true, sort: (s) => s.created_at, render: (s) => <span className="text-xs text-slate-500">{fmtDate(s.created_at)}</span> },
    { key: 'status', label: 'Status', sort: (s) => s.status, render: (s) => <Badge tone={TONE[s.status]} dot>{s.status[0].toUpperCase() + s.status.slice(1)}</Badge> },
    { key: 'actions', label: '', className: 'text-right', render: (s) => <SchoolActions s={s} /> },
  ];
  return (
    <>
      <PageHeader title="Schools" subtitle="Approve new schools, suspend or re-activate them. Click a school to see its accounts." />
      <Card>
        <DataTable columns={columns} rows={rows} onRowClick={(s) => navigate(`/accounts?school=${s.id}`)} initialSort={{ key: 'created_at', dir: 'desc' }}
          searchText={(s) => [s.name, s.city, s.code, s.owner?.name, s.owner?.email].join(' ')}
          empty={<EmptyState icon={Building2} title="No schools yet" text="Schools appear here when an owner registers in EduNexa Admin." />} />
      </Card>
    </>
  );
}

export function PlatformDashboard() {
  const me = useCurrentUser();
  const rows = useSchoolRows();
  const users = useDB((s) => s.users);
  const navigate = useNavigate();
  const pendingSchools = rows.filter((s) => s.status === 'pending');
  const pendingUsers = users.filter((u) => u.status === 'Pending');
  return (
    <>
      <PageHeader title={`Welcome, ${me.name.split(' ')[0]}`} subtitle="EduNexa platform overview" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Schools" value={rows.length} icon={Building2} tone="blue" sub={`${rows.filter((s) => s.status === 'active').length} active`} onClick={() => navigate('/schools')} />
        <StatCard label="Schools to approve" value={pendingSchools.length} icon={Hourglass} tone="amber" onClick={() => navigate('/schools')} />
        <StatCard label="Accounts" value={users.length} icon={Users} tone="navy" sub={`${pendingUsers.length} pending`} onClick={() => navigate('/accounts')} />
        <StatCard label="Students on EduNexa" value={rows.reduce((a, s) => a + s.students, 0)} icon={GraduationCap} tone="green" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Schools waiting for approval" icon={Building2} action={<Button size="sm" variant="ghost" onClick={() => navigate('/schools')}>All schools</Button>} />
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {pendingSchools.length === 0 && <p className="p-5 text-sm text-slate-500">Nothing to approve right now.</p>}
            {pendingSchools.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-4">
                <SchoolLogo s={s} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-slate-500">{s.owner?.name} · {s.owner?.email || s.owner?.phone} · {fmtDate(s.created_at)}</p>
                </div>
                <SchoolActions s={s} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Latest sign-ups" icon={UserCheck} action={<Button size="sm" variant="ghost" onClick={() => navigate('/accounts')}>All accounts</Button>} />
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {users.slice(0, 8).map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0"><p className="truncate font-semibold">{u.name}</p><p className="truncate text-xs text-slate-500">{ROLES[u.role]?.label} · {rows.find((s) => s.id === u.schoolId)?.name || 'EduNexa'}</p></div>
                <Badge tone={{ Pending: 'amber', Active: 'green', Suspended: 'red', Deactivated: 'slate' }[u.status]}>{u.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
