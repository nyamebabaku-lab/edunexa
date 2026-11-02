import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Loader2, CircleSlash } from 'lucide-react';
import { useDB } from '../../data/store';
import { Button } from '../../components/ui';

const loaded = {};
function loadScript(src) {
  loaded[src] ||= new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement('script'), { src, async: true });
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
  return loaded[src];
}

/** Large-class video through a Jitsi server (meet.jit.si, 8x8 JaaS or the school's own). */
export default function JitsiRoom({ code, session, isHost, me, onExit }) {
  const db = useDB();
  const live = db.settings.live;
  const box = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let api;
    const domain = live.jaasAppId ? '8x8.vc' : live.jitsiDomain || 'meet.jit.si';
    const room = `EduNexa${code.replace('-', '')}${db.settings.schoolName.replace(/[^A-Za-z]/g, '').slice(0, 12)}`;
    const roomName = live.jaasAppId ? `${live.jaasAppId}/${room}` : room;
    const student = me.role === 'student';
    loadScript(`https://${domain}/${live.jaasAppId ? `${live.jaasAppId}/` : ''}external_api.js`)
      .then(() => {
        api = new window.JitsiMeetExternalAPI(domain, {
          roomName,
          parentNode: box.current,
          width: '100%',
          height: '100%',
          userInfo: { displayName: me.name },
          configOverwrite: {
            prejoinPageEnabled: true,
            disableDeepLinking: true,
            startWithAudioMuted: student && live.studentsStartMuted,
            startWithVideoMuted: student && !live.studentsCanUseCamera,
            subject: session?.title || 'Live class',
          },
          interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false, MOBILE_APP_PROMO: false },
        });
        setLoading(false);
        const att = (ev, p) => {
          if (!isHost || !session) return;
          const s = useDB.getState().liveSessions.find((x) => x.id === session.id);
          const t = format(new Date(), 'HH:mm');
          const list = [...(s.attendance || [])];
          if (ev === 'join') list.push({ personType: 'Student', personId: null, name: p.displayName || 'Guest', joinedAt: t, leftAt: null, peer: p.id });
          else {
            const i = list.findLastIndex((a) => a.peer === p.id && !a.leftAt);
            if (i >= 0) list[i] = { ...list[i], leftAt: t };
          }
          useDB.getState().update('liveSessions', s.id, { attendance: list });
        };
        api.addListener('participantJoined', (p) => att('join', p));
        api.addListener('participantLeft', (p) => att('leave', p));
        api.addListener('videoConferenceJoined', () => isHost && session && useDB.getState().update('liveSessions', session.id, { status: 'Live', startedAt: new Date().toISOString() }));
        api.addListener('readyToClose', () => {
          if (isHost && session) useDB.getState().update('liveSessions', session.id, { status: 'Ended', endedAt: new Date().toISOString() });
          onExit();
        });
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
    return () => api?.dispose();
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 flex flex-col bg-navy-950 text-white">
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-2">
        <button onClick={onExit} className="rounded-xl p-2 hover:bg-white/10" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <p className="flex-1 truncate font-bold">{session?.title || `Live class ${code}`}</p>
        <span className="text-xs text-slate-400">Large-class video · {live.jaasAppId ? '8x8 JaaS' : live.jitsiDomain}</span>
      </div>
      <div ref={box} className="relative flex-1">
        {loading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <CircleSlash className="h-8 w-8 text-accent-400" />
            <p className="max-w-sm text-slate-300">Couldn't reach the video server. {error}</p>
            <Button variant="secondary" onClick={onExit}>Back</Button>
          </div>
        )}
      </div>
    </div>
  );
}
