// The school photo blended into the sign-in page and dashboard greeting.
// The school's theme colour tints it (multiply), and a gradient fades it into the page so text stays readable.
import { useState } from 'react';
import { useDB } from '../data/store';
import { DEFAULT_FRONT, rememberedSchool } from '../lib/front';
import { cx } from './ui';

/** Picture to show: the school's own (signed in), else the last school on this device, else the default. */
export function useFrontImage({ signedIn = true } = {}) {
  const own = useDB((s) => s.settings.frontImage);
  const [remembered] = useState(() => rememberedSchool());
  if (signedIn && own) return own;
  return remembered?.image || own || DEFAULT_FRONT;
}

/**
 * variant 'panel': dark full-height panel (desktop sign-in).
 * variant 'top': phone header that fades into the page below.
 * variant 'banner': dashboard greeting strip, darker on the left where the text sits.
 */
export function FrontBackdrop({ src, variant = 'panel', className }) {
  const [failed, setFailed] = useState(false);
  const img = failed ? DEFAULT_FRONT : src || DEFAULT_FRONT;
  return (
    <div aria-hidden className={cx('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <img src={img} alt="" onError={() => setFailed(true)} className={cx('h-full w-full object-cover', variant === 'panel' && 'scale-105')} draggable={false} />
      <div className="absolute inset-0 bg-brand-600/40 mix-blend-multiply" />
      {variant === 'panel' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/70 to-navy-900/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-950/40 to-transparent" />
        </>
      )}
      {variant === 'top' && <div className="absolute inset-0 bg-gradient-to-b from-navy-950/20 via-white/30 to-white dark:via-navy-950/40 dark:to-navy-950" />}
      {variant === 'banner' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-brand-900/95 via-brand-800/75 to-brand-700/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/40 to-transparent" />
        </>
      )}
    </div>
  );
}
