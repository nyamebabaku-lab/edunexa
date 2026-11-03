import { useEffect, useRef, useState } from 'react';
import { Camera, Upload, Trash2, ZoomIn, Check, RefreshCw, CameraOff } from 'lucide-react';
import { usePhoto, savePhoto, removePhoto, toSquareJpeg } from '../data/photos';
import { Button, Modal, Avatar, toast } from './ui';

function CameraCapture({ onShot, onCancel }) {
  const video = useRef(null);
  const [err, setErr] = useState(null);
  const [facing, setFacing] = useState('user');
  useEffect(() => {
    let stream;
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setErr('The camera only works on a secure (https://) address.');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 960 } }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
      } catch (e) {
        setErr(e.name === 'NotAllowedError' ? 'Camera permission was denied.' : 'No camera is available.');
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);
  const shoot = () => {
    const v = video.current;
    const c = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight });
    const g = c.getContext('2d');
    if (facing === 'user') {
      g.translate(c.width, 0);
      g.scale(-1, 1);
    }
    g.drawImage(v, 0, 0);
    onShot(c.toDataURL('image/jpeg', 0.92));
  };
  if (err)
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-900 p-8 text-center text-slate-200">
        <CameraOff className="h-8 w-8 text-accent-400" />
        <p className="text-sm">{err}</p>
        <Button size="sm" variant="secondary" onClick={onCancel}>Back</Button>
      </div>
    );
  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black">
        <video ref={video} playsInline muted className={`h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
        <div className="pointer-events-none absolute inset-[12%] rounded-full border-2 border-dashed border-white/60" />
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="secondary" icon={RefreshCw} onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>Flip</Button>
        <Button icon={Camera} onClick={shoot}>Capture</Button>
      </div>
    </div>
  );
}

function Cropper({ src, onSave, onCancel }) {
  const box = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState(null);
  const drag = useRef(null);
  useEffect(() => {
    let alive = true;
    toSquareJpeg(src, { size: 320, zoom, offsetX: off.x, offsetY: off.y }).then((u) => alive && setPreview(u));
    return () => {
      alive = false;
    };
  }, [src, zoom, off]);
  const down = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, off };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drag.current) return;
    const B = box.current.clientWidth;
    setOff({ x: drag.current.off.x + (e.clientX - drag.current.x) / B / zoom, y: drag.current.off.y + (e.clientY - drag.current.y) / B / zoom });
  };
  return (
    <div>
      <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} className="relative mx-auto aspect-square w-full max-w-xs cursor-grab touch-none overflow-hidden rounded-2xl bg-slate-100 active:cursor-grabbing dark:bg-white/5">
        {preview && <img src={preview} alt="Crop preview" className="h-full w-full select-none" draggable={false} />}
        <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_0_2px_rgba(255,255,255,.6)]" />
        <div className="pointer-events-none absolute inset-[8%] rounded-full border-2 border-white/70" />
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">Drag to position · use the slider to zoom</p>
      <label className="mx-auto mt-3 flex max-w-xs items-center gap-3">
        <ZoomIn className="h-4 w-4 text-slate-400" />
        <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-brand-600" />
      </label>
      <div className="mt-5 flex justify-center gap-2">
        <Button variant="secondary" onClick={onCancel}>Back</Button>
        <Button icon={Check} onClick={() => onSave(preview)} disabled={!preview}>Save photo</Button>
      </div>
    </div>
  );
}

/** Modal to add, retake, crop or remove a person's photo. */
export default function PhotoEditor({ open, onClose, pkey, name }) {
  const current = usePhoto(pkey);
  const [step, setStep] = useState('view');
  const [src, setSrc] = useState(null);
  const file = useRef(null);
  useEffect(() => {
    if (open) {
      setStep('view');
      setSrc(null);
    }
  }, [open]);
  const pick = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast.error('Please choose an image file');
    const r = new FileReader();
    r.onload = () => {
      setSrc(r.result);
      setStep('crop');
    };
    r.readAsDataURL(f);
  };
  const save = async (dataUrl) => {
    try {
      await savePhoto(pkey, dataUrl);
      toast.success('Photo saved', `Now shown on ${name}'s ID card, reports and profile`);
      onClose();
    } catch {
      toast.error('Could not save the photo', 'Storage may be full on this device');
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={step === 'camera' ? 'Take a photo' : step === 'crop' ? 'Adjust photo' : 'Photo'} subtitle={name} size="sm">
      {step === 'view' && (
        <div className="flex flex-col items-center">
          {current ? <img src={current} alt={name} className="h-40 w-40 rounded-3xl object-cover shadow-lg" /> : <Avatar name={name} size="xl" className="!h-40 !w-40 !text-4xl" />}
          <p className="mt-3 text-center text-xs text-slate-500">Use a clear, front-facing passport-style photo with a plain background.</p>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files[0])} />
          <div className="mt-5 grid w-full grid-cols-2 gap-2">
            <Button variant="secondary" icon={Upload} onClick={() => file.current.click()}>Upload</Button>
            <Button icon={Camera} onClick={() => setStep('camera')}>Take photo</Button>
          </div>
          {current && <Button variant="soft-red" icon={Trash2} className="mt-2 w-full" onClick={async () => { await removePhoto(pkey); toast.info('Photo removed'); onClose(); }}>Remove photo</Button>}
        </div>
      )}
      {step === 'camera' && <CameraCapture onShot={(d) => { setSrc(d); setStep('crop'); }} onCancel={() => setStep('view')} />}
      {step === 'crop' && src && <Cropper src={src} onSave={save} onCancel={() => setStep('view')} />}
    </Modal>
  );
}

/** A person's avatar with a camera button that opens the photo editor. */
export function EditableAvatar({ pkey, name, size = 'xl', canEdit, className }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`relative shrink-0 ${className || ''}`}>
      <Avatar name={name} size={size} photo={pkey} className="ring-4" />
      {canEdit && (
        <button onClick={() => setOpen(true)} className="no-print absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-2 ring-white hover:bg-brand-700 dark:ring-navy-900" aria-label="Change photo" title="Change photo">
          <Camera className="h-4 w-4" />
        </button>
      )}
      <PhotoEditor open={open} onClose={() => setOpen(false)} pkey={pkey} name={name} />
    </div>
  );
}

/** Passport-style photo for printed documents, with an initials fallback. */
export function Portrait({ pkey, name, className = 'h-28 w-24' }) {
  const img = usePhoto(pkey);
  if (img) return <img src={img} alt={name} className={`rounded-lg object-cover ${className}`} />;
  return (
    <div className={`flex items-center justify-center rounded-lg bg-slate-100 ${className}`}>
      <Avatar name={name} size="lg" />
    </div>
  );
}

const norm = (s) => (s || '').toUpperCase().replace(/\.[A-Z0-9]+$/, '').replace(/[^A-Z0-9]/g, '');

/**
 * Upload many photos at once. Files are matched by the number in their name,
 * e.g. "BFIS_26_0112.jpg" or "BFIS-ST-002.png".
 */
export function BulkPhotoUpload({ open, onClose, people, personType }) {
  const fileRef = useRef(null);
  const [state, setState] = useState(null); // { total, done, matched: [], unmatched: [] }
  useEffect(() => {
    if (open) setState(null);
  }, [open]);
  const run = async (files) => {
    const byCode = Object.fromEntries(people.map((p) => [norm(p.code), p]));
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    const res = { total: list.length, done: 0, matched: [], unmatched: [] };
    setState({ ...res });
    for (const f of list) {
      const p = byCode[norm(f.name)];
      if (p) {
        try {
          await savePhoto(`${personType}:${p.id}`, await toSquareJpeg(f));
          res.matched.push({ file: f.name, name: p.name });
        } catch {
          res.unmatched.push({ file: f.name, why: 'unreadable image' });
        }
      } else res.unmatched.push({ file: f.name, why: 'no matching number' });
      res.done++;
      setState({ ...res });
    }
    toast.success('Photos uploaded', `${res.matched.length} matched, ${res.unmatched.length} skipped`);
  };
  return (
    <Modal open={open} onClose={onClose} title={`Bulk ${personType.toLowerCase()} photos`} subtitle="Name each file with the person's number" size="md">
      {!state ? (
        <div className="space-y-4 text-sm">
          <div className="rounded-2xl bg-slate-50 p-4 text-slate-600 dark:bg-white/5 dark:text-slate-300">
            <p className="font-semibold text-slate-800 dark:text-white">How to name files</p>
            <p className="mt-1">Use the {personType === 'Student' ? 'admission' : 'staff'} number; slashes can be dashes or underscores:</p>
            <p className="mt-2 font-mono text-xs">{people.slice(0, 2).map((p) => `${p.code.replace(/\//g, '_')}.jpg`).join('   ')}</p>
            <p className="mt-2 text-xs text-slate-500">Each photo is centre-cropped to a square and compressed to about 20 KB. You can adjust any photo later from the person's profile.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => run(e.target.files)} />
          <Button icon={Upload} className="w-full" onClick={() => fileRef.current.click()}>Choose photos</Button>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <div className="mb-1 flex justify-between"><span>{state.done < state.total ? 'Processing…' : 'Done'}</span><span>{state.done}/{state.total}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(state.done / Math.max(1, state.total)) * 100}%` }} /></div>
          </div>
          <p className="font-semibold text-emerald-600">{state.matched.length} photo(s) matched</p>
          {state.unmatched.length > 0 && (
            <div>
              <p className="font-semibold text-accent-600">{state.unmatched.length} skipped</p>
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-slate-500">{state.unmatched.map((u) => <li key={u.file}>{u.file} — {u.why}</li>)}</ul>
            </div>
          )}
          {state.done === state.total && <Button className="w-full" onClick={onClose}>Close</Button>}
        </div>
      )}
    </Modal>
  );
}
