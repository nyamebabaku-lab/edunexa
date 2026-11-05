// Accounts: approve, suspend, activate, deactivate, reset passwords and delete.
// School Owner/Admin: their own school. Super Admin: every school.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Ban, CircleCheck, PowerOff, Trash2, KeyRound, UserCheck, Hourglass, Users, RefreshCw } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser } from '../../data/selectors';
import { useLive, setAccountStatus, deleteAccount, resetPassword, refreshUsers } from '../../data/sync';
import { ROLES } from '../../lib/permissions';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { Avatar, Badge, Button, Card, DataTable, EmptyState, IconButton, PageHeader, Select, Tabs, Modal, Field, Input, confirmDialog, toast, Spinner } from '../../components/ui';

const STATUS_TONE = { Pending: 'amber', Active: 'green', Suspended: 'red', Deactivated: 'slate' };

export function useAccountActions() {
  const [busy, setBusy] = useState(null);
  const run = async (id, fn, done) => {
    setBusy(id);
    try {
      await fn();
      if (done) toast.success(done);
      await refreshUsers();
    } catch (e) {
      toast.error('Not done', e.message);
    }
    setBusy(null);
  };
  return { busy, run };
}

export default function Accounts() {
  const me = useCurrentUser();
  const users = useDB((s) => s.users);
  const schools = useLive((s) => s.schools);
  const isSuper = me.role === 'superadmin';
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('Pending');
  const [role, setRole] = useState('');
  const school = params.get('school') || '';
  const { busy, run } = useAccountActions();
  const [reset, setReset] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const schoolName = useMemo(() => Object.fromEntries(schools.map((s) => [s.id, s.name])), [schools]);
  const others = users.filter((u) => u.id !== me.id && (!school || u.schoolId === school));
  const rows = others.filter((u) => (tab === 'All' || u.status === tab) && (!role || u.role === role));
  const count = (st) => others.filter((u) => u.status === st).length;

  const ask = async (u, status) => {
    let reason = null;
    if (status === 'suspended' || status === 'deactivated') {
      reason = window.prompt(`Reason for ${status === 'suspended' ? 'suspending' : 'deactivating'} ${u.name} (optional — they will see it):`, '');
      if (reason === null) return;
    }
    const verb = { active: u.status === 'Pending' ? 'approved' : 'activated', suspended: 'suspended', deactivated: 'deactivated' }[status];
    run(u.id, () => setAccountStatus(u.id, status, reason), `${u.name} ${verb}`);
  };
  const remove = async (u) => {
    if (!(await confirmDialog(`Delete ${u.name}'s account?`, 'They will no longer be able to sign in. School records (student, staff, payments…) are kept. This cannot be undone.', { confirmLabel: 'Delete account' }))) return;
    run(u.id, () => deleteAccount(u.id), 'Account deleted');
  };
  const canManage = (u) => isSuper || (!u.isOwner && u.role !== 'superadmin');

  const columns = [
    {
      key: 'name', label: 'Account', sort: (u) => u.name,
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-white">{u.name}{u.isOwner && <Badge tone="blue" className="ml-2">Owner</Badge>}</p>
            <p className="truncate text-xs text-slate-500">{[u.email, u.phone].filter(Boolean).join(' · ') || '—'}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', label: 'Role', sort: (u) => u.role, render: (u) => <Badge tone={u.role === 'superadmin' ? 'red' : u.role === 'admin' ? 'blue' : 'slate'}>{ROLES[u.role]?.label || u.role}</Badge> },
    ...(isSuper ? [{ key: 'school', label: 'School', sort: (u) => schoolName[u.schoolId] || '', render: (u) => <span className="text-sm">{schoolName[u.schoolId] || (u.role === 'superadmin' ? 'EduNexa' : '—')}</span> }] : []),
    { key: 'match', label: 'Linked to', hideOnMobile: true, render: (u) => (u.matchLabel ? <span className="text-xs text-slate-600 dark:text-slate-300">{u.matchLabel}</span> : <span className="text-xs text-slate-400">{u.linkedId ? 'Staff record' : '—'}</span>) },
    { key: 'createdAt', label: 'Signed up', hideOnMobile: true, sort: (u) => u.createdAt, render: (u) => <span className="text-xs text-slate-500">{fmtDate(u.createdAt)}<br />{u.lastLogin ? `Last in ${fmtDateTime(u.lastLogin)}` : 'Never signed in'}</span> },
    { key: 'status', label: 'Status', sort: (u) => u.status, render: (u) => <Badge tone={STATUS_TONE[u.status]} dot>{u.status}</Badge> },
    {
      key: 'actions', label: '', className: 'text-right',
      render: (u) =>
        busy === u.id ? <Spinner className="ml-auto h-5 w-5 text-brand-600" /> : canManage(u) ? (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {u.status === 'Pending' && <Button size="sm" icon={Check} onClick={() => ask(u, 'active')}>Approve</Button>}
            {(u.status === 'Suspended' || u.status === 'Deactivated') && <Button size="sm" variant="secondary" icon={CircleCheck} onClick={() => ask(u, 'active')}>Activate</Button>}
            {u.status === 'Active' && <IconButton icon={Ban} label="Suspend" onClick={() => ask(u, 'suspended')} />}
            {u.status !== 'Deactivated' && u.status !== 'Pending' && <IconButton icon={PowerOff} label="Deactivate" onClick={() => ask(u, 'deactivated')} />}
            {u.status === 'Pending' && <IconButton icon={Ban} label="Reject (deactivate)" onClick={() => ask(u, 'deactivated')} />}
            <IconButton icon={KeyRound} label="Reset password" onClick={() => setReset({ u, pw: '' })} />
            <IconButton icon={Trash2} label="Delete" tone="soft-red" onClick={() => remove(u)} />
          </div>
        ) : <span className="text-xs text-slate-400">{u.isOwner ? 'Managed by EduNexa' : ''}</span>,
    },
  ];

  const roleOptions = Object.entries(ROLES).filter(([k]) => k !== 'superadmin' || isSuper).map(([value, r]) => ({ value, label: r.label }));
  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle={isSuper ? 'Every account on EduNexa. Approve school owners here or on the Schools page.' : 'Approve the teachers, parents, students and staff who join your school with its code.'}
        actions={<Button variant="secondary" icon={refreshing ? Spinner : RefreshCw} onClick={async () => { setRefreshing(true); await refreshUsers().catch(() => {}); setRefreshing(false); }}>Refresh</Button>}
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'Pending', label: 'Pending', icon: Hourglass, count: count('Pending') },
          { value: 'Active', label: 'Active', icon: UserCheck, count: count('Active') },
          { value: 'Suspended', label: 'Suspended', icon: Ban, count: count('Suspended') },
          { value: 'Deactivated', label: 'Deactivated', icon: PowerOff, count: count('Deactivated') },
          { value: 'All', label: 'All', icon: Users, count: others.length },
        ]}
      />
      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          initialSort={{ key: 'createdAt', dir: 'desc' }}
          searchText={(u) => [u.name, u.email, u.phone, u.matchLabel, u.admissionNo, ROLES[u.role]?.label, schoolName[u.schoolId]].join(' ')}
          toolbar={
            <div className="flex flex-wrap gap-2">
              <Select className="!w-auto" value={role} onChange={(e) => setRole(e.target.value)} options={roleOptions} placeholder="All roles" />
              {isSuper && <Select className="!w-auto" value={school} onChange={(e) => setParams(e.target.value ? { school: e.target.value } : {})} options={schools.map((s) => ({ value: s.id, label: s.name }))} placeholder="All schools" />}
            </div>
          }
          empty={<EmptyState icon={tab === 'Pending' ? Hourglass : Users} title={tab === 'Pending' ? 'No accounts waiting for approval' : 'No accounts here'} />}
        />
      </Card>
      <p className="mt-4 text-xs text-slate-500">
        Parents and students are matched to a student record by admission number when they sign up — check the "Linked to" column before approving.
        Teachers and staff get a staff record on approval (an existing record with the same phone or email is reused).
      </p>

      <Modal
        open={!!reset}
        onClose={() => setReset(null)}
        title="Reset password"
        subtitle={reset && `Set a temporary password for ${reset.u.name}, then tell them in person or by phone.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReset(null)}>Cancel</Button>
            <Button icon={KeyRound} onClick={() => { const { u, pw } = reset; setReset(null); run(u.id, () => resetPassword(u.id, pw), `New password set for ${u.name}`); }} disabled={!reset || reset.pw.length < 8 || !/\d/.test(reset.pw)}>Set password</Button>
          </>
        }
      >
        {reset && (
          <Field label="Temporary password" hint="At least 8 characters with a number. They can change it from their profile menu.">
            <Input value={reset.pw} onChange={(e) => setReset({ ...reset, pw: e.target.value })} placeholder="e.g. school2026" />
          </Field>
        )}
      </Modal>
    </>
  );
}
