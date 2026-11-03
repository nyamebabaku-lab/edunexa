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
export default function PhotoEditor({ open, onClose, pkey, name, onPick, value }) {
  const saved = usePhoto(pkey);
  // In pick mode (inside a form) the photo is handed back instead of saved straight away.
  const current = value !== undefined ? value : saved;
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
    if (onPick) {
      onPick(dataUrl);
      return onClose();
    }
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
          {current && (
            <Button variant="soft-red" icon={Trash2} className="mt-2 w-full" onClick={async () => {
              if (onPick) onPick(null);
              else {
                await removePhoto(pkey);
                toast.info('Photo removed');
              }
              onClose();
            }}>Remove photo</Button>
          )}
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

/**
 * Photo picker for add/edit forms. `value` is undefined (unchanged), a data URL (new photo)
 * or null (remove); the form saves it with the record via applyPhotoChange().
 */
export function PhotoField({ value, onChange, pkey, name }) {
  const saved = usePhoto(pkey);
  const shown = value === undefined ? saved : value;
  const [open, setOpen] = useState(null);
  const file = useRef(null);
  const pick = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast.error('Please choose an image file');
    const r = new FileReader();
    r.onload = () => setOpen({ src: r.result });
    r.readAsDataURL(f);
  };
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-200 p-3 dark:border-white/10">
      {shown ? <img src={shown} alt={name || 'Photo'} className="h-20 w-20 shrink-0 rounded-2xl object-cover" /> : <Avatar name={name || '?'} size="xl" className="!rounded-2xl" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{shown ? (value ? 'New photo ready — saves with this form' : 'Current photo') : 'No photo yet'}</p>
        <p className="text-xs text-slate-500">Front-facing, plain background. Used on ID cards, report cards and the gate.</p>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={Upload} onClick={() => file.current.click()}>Upload</Button>
          <Button size="sm" variant="secondary" icon={Camera} onClick={() => setOpen({ camera: true })}>Take photo</Button>
          {shown && <Button size="sm" variant="soft-red" icon={Trash2} onClick={() => onChange(null)}>Remove</Button>}
        </div>
      </div>
      {open && <PickPhoto initial={open} name={name} onClose={() => setOpen(null)} onPick={onChange} />}
    </div>
  );
}

function PickPhoto({ initial, name, onClose, onPick }) {
  const [src, setSrc] = useState(initial.src || null);
  return (
    <Modal open onClose={onClose} title={src ? 'Adjust photo' : 'Take a photo'} subtitle={name} size="sm">
      {src ? (
        <Cropper src={src} onCancel={onClose} onSave={(d) => { onPick(d); onClose(); }} />
      ) : (
        <CameraCapture onShot={setSrc} onCancel={onClose} />
      )}
    </Modal>
  );
}
