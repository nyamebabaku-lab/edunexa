// Import from Excel: download the template, upload a filled workbook, preview, then import (works offline too).
import { useState } from 'react';
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle, CloudUpload, WifiOff, ListChecks, RotateCcw } from 'lucide-react';
import { useDB } from '../../data/store';
import { useLive } from '../../data/sync';
import { SHEETS, buildTemplate, planImport, WRITE_ORDER } from '../../lib/importer';
import { LIVE, IS_NATIVE, SITE } from '../../config';
import { Badge, Button, Card, CardHeader, PageHeader, Spinner, toast, cx } from '../../components/ui';

const loadXLSX = () => import('xlsx');
const TEMPLATE_NAME = 'EduNexa-Import-Template.xlsx';

export default function Import() {
  const [plan, setPlan] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [open, setOpen] = useState({});
  const pending = useLive((s) => s.pending);
  const online = typeof navigator === 'undefined' || navigator.onLine;

  const template = async () => {
    if (IS_NATIVE) return window.open(`${SITE}${TEMPLATE_NAME}`, '_system');
    const XLSX = await loadXLSX();
    XLSX.writeFile(buildTemplate(XLSX), TEMPLATE_NAME);
  };
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setDone(null);
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
      const p = planImport(XLSX, wb, useDB.getState());
      if (!p.sheets.length) toast.error('Nothing found', 'Use the EduNexa template — sheet names and headings must match.');
      setPlan(p);
      setFile(f.name);
    } catch (e2) {
      toast.error('Could not read that file', e2.message);
    }
    setBusy(false);
  };
  const run = () => {
    const db = useDB.getState();
    let n = 0;
    WRITE_ORDER.forEach((col) => {
      const recs = plan.writes[col];
      if (recs?.length) {
        db.bulkUpsert(col, recs);
        n += recs.length;
      }
    });
    if (plan.settings) db.updateSettings(plan.settings);
    setDone(n);
    setPlan(null);
    toast.success('Import complete', `${n} records saved${LIVE ? (navigator.onLine ? ' and uploading' : ' on this device — they upload when you are back online') : ''}`);
  };
  const errors = plan?.sheets.reduce((a, s) => a + s.errors.length, 0) || 0;

  return (
    <>
      <PageHeader title="Import from Excel" subtitle="Move your existing records into EduNexa: students & parents, staff, classes, fee balances, past scores, library books and store stock." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><FileSpreadsheet className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-white">1. Get the template</p>
                <p className="mt-1 text-sm text-slate-500">One Excel file with a sheet for each kind of record, an example row and a "Read me" sheet. Fill only the sheets you need.</p>
              </div>
              <Button variant="secondary" icon={Download} onClick={template}>Download template</Button>
            </div>
            <div className="mt-6 flex flex-wrap items-start gap-4 border-t border-slate-100 pt-6 dark:border-white/5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10"><Upload className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-white">2. Upload your filled file</p>
                <p className="mt-1 text-sm text-slate-500">Nothing is saved until you check the preview and press Import. Importing the same file again updates records instead of duplicating them.</p>
              </div>
              <label className={cx('inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700', busy && 'pointer-events-none opacity-60')}>
                {busy ? <Spinner /> : <Upload className="h-4 w-4" />} Choose Excel file
                <input type="file" accept=".xlsx,.xls,.ods,.csv" className="hidden" onChange={pick} />
              </label>
            </div>
          </Card>

          {plan && (
            <Card>
              <CardHeader title={`Preview · ${file}`} icon={ListChecks} subtitle={`${plan.total} records ready${errors ? ` · ${errors} row problem${errors === 1 ? '' : 's'} (those rows are skipped or partly filled)` : ' · no problems found'}`} />
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {plan.sheets.map((s) => (
                  <div key={s.name} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="flex-1 font-semibold">{s.name}</p>
                      {s.add > 0 && <Badge tone="green">{s.add} new</Badge>}
                      {s.update > 0 && <Badge tone="blue">{s.update} updated</Badge>}
                      {s.errors.length > 0 && <button onClick={() => setOpen({ ...open, [s.name]: !open[s.name] })}><Badge tone="amber">{s.errors.length} problem{s.errors.length === 1 ? '' : 's'} {open[s.name] ? '▲' : '▼'}</Badge></button>}
                    </div>
                    {open[s.name] && (
                      <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl bg-amber-50/60 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                        {s.errors.map((e, i) => <li key={i}><b>Row {e.row}:</b> {e.msg}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-white/5">
                <Button variant="ghost" icon={RotateCcw} onClick={() => setPlan(null)}>Cancel</Button>
                <Button icon={CloudUpload} onClick={run} disabled={!plan.total}>Import {plan.total} records</Button>
              </div>
            </Card>
          )}

          {done != null && (
            <Card className="flex items-center gap-4 p-5">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" />
              <div className="flex-1 text-sm">
                <p className="font-bold text-slate-900 dark:text-white">{done} records imported</p>
                {LIVE && <p className="text-slate-500">{pending ? `${pending} change${pending === 1 ? '' : 's'} still uploading${online ? '…' : ' — waiting for internet'}` : 'All uploaded to your school account.'}</p>}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {LIVE && !online && (
            <Card className="flex gap-3 p-5 text-sm">
              <WifiOff className="h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-slate-600 dark:text-slate-300">You're offline. You can still import: records are saved on this device and uploaded automatically when the connection returns. Keep this device signed in until then.</p>
            </Card>
          )}
          <Card>
            <CardHeader title="What the template contains" icon={FileSpreadsheet} />
            <div className="divide-y divide-slate-100 text-sm dark:divide-white/5">
              {SHEETS.map((s) => (
                <div key={s.name} className="px-5 py-3">
                  <p className="font-semibold text-slate-900 dark:text-white">{s.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{s.about}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{s.cols.map((c) => c[0]).join(' · ')}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="flex gap-3 p-5 text-xs text-slate-500">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <p>Tip: if your admission numbers start with 0 (e.g. 00123), format that column as <b>Text</b> in Excel before typing so the zeros are kept. Phone numbers are fixed automatically.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
