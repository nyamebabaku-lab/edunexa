// Parents asking to link another child from their portal (admission number + date of birth).
// The Owner/Admin or Head Teacher approves; the child then shows in that parent's app.
import { useState } from 'react';
import { Check, X, Link2 } from 'lucide-react';
import { useLive, decideChildRequest } from '../../data/sync';
import { useDB } from '../../data/store';
import { fmtDateTime } from '../../lib/format';
import { Card, CardHeader, Button, Badge, toast } from '../../components/ui';
import { friendly } from '../../lib/supabase';

export default function ChildRequests() {
  const all = useLive((s) => s.childRequests);
  const users = useDB((s) => s.users);
  const [busy, setBusy] = useState(null);
  const pending = all.filter((r) => r.status === 'pending');
  if (!pending.length) return null;
  const who = (uid) => users.find((u) => u.id === uid);
  const decide = async (r, approve) => {
    setBusy(r.id);
    try {
      await decideChildRequest(r.id, approve);
      toast.success(approve ? 'Child linked' : 'Request declined', `${who(r.user_id)?.name || 'Parent'} → ${r.label}`);
    } catch (e) {
      toast.error('Not done', friendly(e.message));
    }
    setBusy(null);
  };
  return (
    <Card className="mb-6 ring-2 ring-amber-300 dark:ring-amber-500/40">
      <CardHeader title={`Children to link (${pending.length})`} subtitle="Parents who entered another child's admission number and date of birth" icon={Link2} />
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {pending.map((r) => {
          const u = who(r.user_id);
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{u?.name || 'A parent'} <span className="font-normal text-slate-500">wants to link</span> {r.label}</p>
                <p className="text-xs text-slate-500">{u?.phone || u?.email} · {fmtDateTime(r.created_at)}{u?.matchLabel ? ` · already parent of ${u.matchLabel.split(' · ')[0]}` : ''}</p>
              </div>
              <Badge tone="amber">Waiting</Badge>
              <Button size="sm" icon={Check} disabled={busy === r.id} onClick={() => decide(r, true)}>Approve</Button>
              <Button size="sm" variant="soft-red" icon={X} disabled={busy === r.id} onClick={() => decide(r, false)}>Decline</Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
