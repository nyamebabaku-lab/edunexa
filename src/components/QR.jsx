import { useEffect, useRef, useState } from 'react';
import QRCodeLib from 'qrcode';
import jsQR from 'jsqr';
import { CameraOff, RefreshCw } from 'lucide-react';
import { Button } from './ui';

export function QRCode({ value, size = 220, className, dark = '#0f1d4d' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && value) QRCodeLib.toCanvas(ref.current, value, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark, light: '#ffffff' } });
  }, [value, size, dark]);
  return <canvas ref={ref} className={className} style={{ width: size, height: size }} aria-label="QR code" />;
}

/**
 * Live camera QR scanner. Calls onResult(text) once per distinct code, then pauses
 * for `cooldown` ms so a code held in front of the camera isn't read repeatedly.
 */
export function QRScanner({ onResult, cooldown = 2500, facingMode = 'environment', className = '' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const cb = useRef(onResult);
  cb.current = onResult;

  useEffect(() => {
    let stream;
    let raf;
    let stopped = false;
    let pausedUntil = 0;
    let last = '';
    setError(null);

    const tick = () => {
      if (stopped) return;
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA && Date.now() > pausedUntil) {
        const w = 480;
        const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(v, 0, 0, w, h);
        const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        if (code?.data && (code.data !== last || Date.now() > pausedUntil + cooldown)) {
          last = code.data;
          pausedUntil = Date.now() + cooldown;
          cb.current(code.data);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(window.isSecureContext ? 'This browser cannot use the camera.' : 'The camera only works on a secure (https://) address.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = videoRef.current;
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true');
        await v.play();
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setError(e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser settings, then try again.' : e.name === 'NotFoundError' ? 'No camera was found on this device.' : `Could not start the camera (${e.name || e.message}).`);
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode, cooldown, attempt]);

  if (error)
    return (
      <div className={`flex flex-col items-center justify-center gap-3 rounded-3xl bg-slate-900 p-8 text-center text-slate-200 ${className}`}>
        <CameraOff className="h-8 w-8 text-accent-400" />
        <p className="max-w-xs text-sm">{error}</p>
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
      </div>
    );
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-black ${className}`}>
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[62%] w-[62%] max-w-[280px] rounded-3xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,.35)]">
          <div className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-accent-500 shadow-[0_0_12px_2px] shadow-accent-500" />
        </div>
      </div>
    </div>
  );
}
