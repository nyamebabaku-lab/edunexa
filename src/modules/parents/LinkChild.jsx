// Parent portal: link another child with their admission number and date of birth. The school approves.
import { useState } from 'react';
import { Link2, Hourglass, CheckCircle2, XCircle } from 'lucide-react';
import { useLive, requestChild } from '../../data/sync';
import { friendly } from '../../lib/supabase';
import { Button, Card, Field, Input, Modal, Badge, toast } from '../../components/ui';

export function LinkChildModal({ open, onClose }) {
  const [adm, setAdm] = useState('');
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!adm.trim() || !dob) return toast.error('Enter both', "Your child's admission number and date of birth");
    setBusy(true);
    try {
      const r = await requestChild(adm.trim(), dob);
      if (!r) toast.error('Details do not match', 'Check the admission number and date of birth with the school office');
      else {
        toast.success('Request sent', `${r.label} — the school will approve it soon`);
        setAdm('');
        setDob('');
        onClose();
      }
    } catch (e) {
      toast.error('Not sent', friendly(e.message));
    }
    setBusy(false);
  };
  return (
    <Modal open={open} onClose={onClose} title="Link another child" subtitle="For a brother or sister at the same school" size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Link2} disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send to the school'}</Button></>}>
      <div className="space-y-4">
        <Field label="Child's admission number"><Input value={adm} onChange={(e) => setAdm(e.target.value)} placeholder="e.g. POMCS/26/0002" autoCapitalize="characters" /></Field>
        <Field label="Child's date of birth" hint="Must match the school's records"><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
        <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-white/5">The school approves every link to keep children safe. You'll get a notification, and the child will appear in your app.</p>
      </div>
    </Modal>
  );
}

/** Dashboard card for parents: link a child, and the state of requests sent. */
export function LinkChildCard() {
  const [open, setOpen] = useState(false);
  const requests = useLive((s) => s.childRequests);
  const me = useLive((s) => s.profile?.user_id);
  const mine = requests.filter((r) => r.user_id === me && r.status !== 'approved').slice(0, 5);
  const ICON = { pending: [Hourglass, 'amber', 'Waiting for the school'], declined: [XCircle, 'red', 'Declined — contact the school'] };
  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15"><Link2 className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 dark:text-white">Another child at this school?</p>
          <p className="text-sm text-slate-500">Link them with their admission number and date of birth.</p>
        </div>
        <Button icon={Link2} onClick={() => setOpen(true)}>Link a child</Button>
      </div>
      {mine.length > 0 && (
        <div className="mt-4 space-y-2">
          {mine.map((r) => {
            const [Icon, tone, text] = ICON[r.status] || [CheckCircle2, 'green', r.status];
            return (
              <div key={r.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-white/5">
                <Icon className="h-4 w-4 text-slate-400" />
                <span className="flex-1">{r.label}</span>
                <Badge tone={tone}>{text}</Badge>
              </div>
            );
          })}
        </div>
      )}
      <LinkChildModal open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
