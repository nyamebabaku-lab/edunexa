import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorX, Hand, MessageSquare, Users, PhoneOff, Copy, Send, X, Crown, Radio,
  Loader2, Clock, CircleSlash, LogOut, ShieldOff, Volume2, Link2, ArrowLeft, Gauge, WifiOff, BookOpen,
} from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useLookups } from '../../data/selectors';
import { fullName } from '../../lib/format';
import { normalizeCode, inviteLink, canHost } from '../../lib/live';
import { Avatar, Button, toast, cx } from '../../components/ui';
import { SchoolLogo } from '../../components/layout/Logo';
import { useLiveRoom, openMedia, audioCtx, blackVideoTrack } from './useLiveRoom';
import JitsiRoom from './JitsiRoom';
import { useNetwork, networkInfo } from '../../data/offline';
import { photoKey } from '../../data/photos';

// ---------- small pieces ----------
function useSpeaking(stream, enabled) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    if (!enabled || !track || track._placeholder) return undefined;
    let src;
    let raf;
    let last = 0;
    try {
      const ctx = audioCtx();
      src = ctx.createMediaStreamSource(new MediaStream([track]));
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = (t) => {
        if (t - last > 150) {
          last = t;
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += (buf[i] - 128) ** 2;
          setSpeaking(Math.sqrt(sum / buf.length) > 6);
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } catch {
      /* audio analysis unavailable */
    }
    return () => {
      cancelAnimationFrame(raf);
      src?.disconnect();
    };
  }, [stream, enabled]);
  return speaking;
}

function VideoEl({ stream, muted, mirror, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={cx('h-full w-full', mirror && '-scale-x-100', className)} />;
}

function Tile({ p, stream, self, big, audioOnly }) {
  const speaking = useSpeaking(stream, p.mic);
  const showVideo = stream && (p.cam || p.screen) && !(audioOnly && !self) && p.bw !== 'audio';
  return (
    <div className={cx('relative overflow-hidden rounded-2xl bg-navy-800 ring-2 transition', speaking ? 'ring-emerald-400' : 'ring-transparent', big ? 'h-full' : 'aspect-video')}>
      {showVideo ? (
        <VideoEl stream={stream} muted={self} mirror={self && !p.screen} className={p.screen ? 'object-contain bg-black' : 'object-cover'} />
      ) : (
        <>
          {stream && !self && <VideoEl stream={stream} muted={false} className="hidden" />}
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-navy-800 to-navy-950">
            <Avatar name={p.name} photo={photoKey(p.role === 'student' ? 'Student' : 'Staff', p.personId)} size={big ? 'xl' : 'lg'} />
          </div>
        </>
      )}
      <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
        <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-black/55 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
          {p.host && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
          {!p.mic ? <MicOff className="h-3.5 w-3.5 shrink-0 text-accent-400" /> : speaking ? <Volume2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> : null}
          <span className="truncate">{p.name}{self ? ' (you)' : ''}</span>
        </span>
        {p.screen && <span className="rounded-lg bg-brand-600 px-2 py-1 text-[10px] font-bold text-white">Presenting</span>}
      </div>
      {p.hand && <span className="absolute right-2 top-2 flex h-8 w-8 animate-bounce items-center justify-center rounded-full bg-amber-400 text-navy-950 shadow-lg"><Hand className="h-4 w-4" /></span>}
      {!stream && !self && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-lg bg-black/55 px-2 py-1 text-[10px] text-slate-200"><Loader2 className="h-3 w-3 animate-spin" /> Connecting video…</span>}
    </div>
  );
}

function CtrlButton({ on, onClick, icon: Icon, offIcon: OffIcon, label, danger, badge, disabled, title }) {
  const I = on === false && OffIcon ? OffIcon : Icon;
  return (
    <button onClick={onClick} disabled={disabled} title={title || label}
      className={cx('relative flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold transition disabled:opacity-40 sm:px-4',
        danger ? 'bg-accent-600 text-white hover:bg-accent-700' : on === false ? 'bg-accent-600/20 text-accent-200 hover:bg-accent-600/30' : on === true ? 'bg-white/15 text-white hover:bg-white/25' : 'text-slate-200 hover:bg-white/10')}>
      <I className="h-5 w-5" />
      <span className="hidden sm:block">{label}</span>
      {badge ? <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] text-white">{badge}</span> : null}
    </button>
  );
}

function StatusScreen({ icon: Icon, title, text, children, spin }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-950 px-6 text-center text-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10"><Icon className={cx('h-7 w-7', spin && 'animate-spin')} /></div>
      <p className="mt-5 text-2xl font-extrabold">{title}</p>
      {text && <p className="mt-2 max-w-md text-slate-400">{text}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  );
}

// ---------- the room ----------
function Room({ code, session, isHost, me, media, initial, onExit }) {
  const db = useDB();
  const L = useLookups();
  const settings = db.settings.live;
  const [panel, setPanel] = useState(null);
  const [text, setText] = useState('');
  const [seen, setSeen] = useState(0);
  const [started] = useState(Date.now());
  const [, tick] = useState(0);
  const chatEnd = useRef(null);

  const onAttendance = useMemo(() => {
    if (!isHost || !session) return undefined;
    return (ev, p) => {
      const s = useDB.getState().liveSessions.find((x) => x.id === session.id);
      if (!s) return;
      const t = format(new Date(), 'HH:mm');
      const list = [...(s.attendance || [])];
      if (ev === 'join') list.push({ personType: p.personType || 'Student', personId: p.personId, name: p.name, joinedAt: t, leftAt: null, peer: p.id });
      else {
        const i = list.findLastIndex((a) => a.peer === p.id && !a.leftAt);
        if (i >= 0) list[i] = { ...list[i], leftAt: t };
      }
      useDB.getState().update('liveSessions', s.id, { attendance: list });
    };
  }, [isHost, session]);

  const room = useLiveRoom({ code, isHost, me, stream: media.stream, initial, settings, onAttendance });
  const net = useNetwork();

  useEffect(() => {
    if (isHost && session && room.status === 'live') db.update('liveSessions', session.id, { status: 'Live', startedAt: new Date().toISOString() });
  }, [isHost, room.status === 'live']); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (panel === 'chat') setSeen(room.chat.length);
    chatEnd.current?.scrollIntoView({ block: 'end' });
  }, [room.chat.length, panel]);
  useEffect(() => {
    const last = room.chat[room.chat.length - 1];
    if (last && panel !== 'chat' && last.from !== me.name) toast.info(last.from, last.text.slice(0, 80));
  }, [room.chat.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const end = () => {
    if (isHost && session) db.update('liveSessions', session.id, { status: 'Ended', endedAt: new Date().toISOString(), chat: room.chat.slice(-200) });
    room.leave(isHost ? 'ended-host' : 'left');
  };

  const status = room.status;
  if (!net.online && status !== 'ended' && status !== 'ended-host') {
    return <StatusScreen icon={WifiOff} title="You're offline" text="Live classes need an internet connection. You'll rejoin automatically when it's back. Meanwhile, lesson notes and assignments still work offline."><Button variant="secondary" icon={BookOpen} onClick={() => { room.leave('left'); window.location.hash = '#/lms'; }}>Open lessons</Button></StatusScreen>;
  }
  if (status === 'ended') return <StatusScreen icon={CircleSlash} title="The class has ended" text="Your teacher has closed this live session."><Button onClick={onExit}>Back to live classes</Button></StatusScreen>;
  if (status === 'ended-host') return <StatusScreen icon={CircleSlash} title="Class ended" text={`Attendance has been saved${session ? ` for ${session.title}` : ''}.`}><Button onClick={onExit}>Back to live classes</Button></StatusScreen>;
  if (status === 'left') return <StatusScreen icon={LogOut} title="You left the class"><Button onClick={() => window.location.reload()}>Rejoin</Button><Button variant="secondary" onClick={onExit}>Back to live classes</Button></StatusScreen>;
  if (status === 'removed') return <StatusScreen icon={ShieldOff} title="You were removed from the class" text="Your teacher removed you from this session."><Button onClick={onExit}>Back</Button></StatusScreen>;
  if (status === 'full') return <StatusScreen icon={Users} title="This class is full" text={`Built-in live classes allow up to ${settings.maxParticipants} people. Ask your teacher to switch to large-class video.`}><Button onClick={onExit}>Back</Button></StatusScreen>;
  if (status === 'error') return <StatusScreen icon={CircleSlash} title="Couldn't connect" text={room.error}><Button onClick={() => window.location.reload()}>Try again</Button><Button variant="secondary" onClick={onExit}>Back</Button></StatusScreen>;
  if (status === 'waiting' || (status === 'connecting' && !isHost)) {
    return (
      <StatusScreen icon={status === 'waiting' ? Clock : Loader2} spin={status === 'connecting'} title={status === 'waiting' ? 'Waiting for your teacher to start the class' : 'Connecting…'} text={status === 'waiting' ? "You'll join automatically as soon as the class starts. Keep this page open." : undefined}>
        <Button variant="secondary" onClick={() => { room.leave('left'); onExit(); }}>Leave</Button>
      </StatusScreen>
    );
  }

  const meEntry = room.roster.find((p) => p.id === room.myId) || { id: room.myId, name: me.name, host: isHost, mic: room.mic, cam: room.cam, hand: room.hand, screen: room.screen };
  const others = room.roster.filter((p) => p.id !== room.myId);
  const everyone = [{ ...meEntry, mic: room.mic, cam: room.cam, hand: room.hand, screen: room.screen }, ...others];
  const streamOf = (p) => (p.id === room.myId ? media.stream : room.streams[p.id]);
  const spotlight = everyone.find((p) => p.screen) || (everyone.length > 2 ? everyone.find((p) => p.host && p.id !== room.myId) : null);
  const rest = spotlight ? everyone.filter((p) => p !== spotlight) : everyone;
  const cols = rest.length <= 1 ? 'grid-cols-1' : rest.length <= 4 ? 'grid-cols-2' : rest.length <= 9 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-3 md:grid-cols-4';
  const isStudent = me.role === 'student';
  const micLocked = isStudent && !room.rules.studentsCanUnmute && !isHost;
  const camLocked = isStudent && !room.rules.studentsCanUseCamera && !isHost;
  const hands = everyone.filter((p) => p.hand).length;
  const elapsed = Math.floor((Date.now() - started) / 1000);

  const doMic = () => {
    const r = room.toggleMic();
    if (r === false) toast.info('Microphone locked', 'Your teacher has muted students. Raise your hand to speak.');
    if (r === 'no-device') toast.error('No microphone available', 'Allow microphone access in your browser, then rejoin.');
  };
  const doCam = async () => {
    if (!room.cam && room.bw === 'audio') return toast.info('Audio-only mode is on', 'Switch data mode to Normal or Low to use video');
    const r = await room.toggleCam();
    if (r === false) toast.info(room.screen ? 'Stop presenting first' : 'Camera locked', room.screen ? undefined : 'Your teacher has turned off student cameras.');
    if (r === 'no-device') toast.error('No camera available', 'Allow camera access in your browser.');
  };
  const doScreen = async () => {
    const r = await room.toggleScreen();
    if (r === 'unsupported') toast.error('Screen sharing is not supported on this device');
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-navy-950 text-white">
      <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <SchoolLogo className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{session?.title || `Live class ${code}`}</p>
          <p className="truncate text-xs text-slate-400">{session ? `${L.className(session.classId)} · ${L.subjectName(session.subjectId)} · ${L.staffName(session.teacherId)}` : 'Joined with a class code'}</p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-accent-600 px-3 py-1 text-xs font-bold sm:flex"><Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span>
        <button onClick={() => { navigator.clipboard?.writeText(inviteLink(code)); toast.success('Invite link copied', `Class code ${code}`); }} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">
          <Link2 className="h-4 w-4" /> <span className="hidden sm:inline">{code}</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className={cx('min-h-0 flex-1 p-3', spotlight ? 'flex flex-col gap-3 lg:flex-row' : 'overflow-y-auto')}>
          {spotlight && (
            <div className="min-h-0 flex-1">
              <Tile p={spotlight} stream={streamOf(spotlight)} self={spotlight.id === room.myId} big audioOnly={room.bw === 'audio'} />
            </div>
          )}
          <div className={cx(spotlight ? 'flex shrink-0 gap-3 overflow-auto lg:w-72 lg:flex-col' : cx('mx-auto grid max-w-6xl content-center gap-3', cols, 'min-h-full'))}>
            {rest.map((p) => (
              <div key={p.id} className={spotlight ? 'w-44 shrink-0 lg:w-full' : ''}>
                <Tile p={p} stream={streamOf(p)} self={p.id === room.myId} audioOnly={room.bw === 'audio'} />
              </div>
            ))}
          </div>
          {others.length === 0 && !spotlight && (
            <p className="mt-4 text-center text-sm text-slate-400">{isHost ? `You're live. Share the class code ${code} or the invite link with your students.` : 'Connected. Waiting for others…'}</p>
          )}
        </main>

        {panel && (
          <aside className="absolute inset-0 z-20 flex flex-col bg-navy-900 sm:static sm:w-80 sm:border-l sm:border-white/5">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <p className="font-bold">{panel === 'chat' ? 'Class chat' : `People (${everyone.length})`}</p>
              <button onClick={() => setPanel(null)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Close panel"><X className="h-4 w-4" /></button>
            </div>
            {panel === 'chat' ? (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {room.chat.length === 0 && <p className="text-center text-sm text-slate-500">No messages yet. Say hello 👋</p>}
                  {room.chat.map((m) => (
                    <div key={m.id}>
                      <p className="text-xs font-semibold text-slate-400">{m.from}{m.role === 'teacher' && <span className="ml-1 text-amber-300">· Teacher</span>} <span className="font-normal text-slate-500">{format(new Date(m.at), 'HH:mm')}</span></p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{m.text}</p>
                    </div>
                  ))}
                  <div ref={chatEnd} />
                </div>
                <form className="flex gap-2 border-t border-white/5 p-3" onSubmit={(e) => { e.preventDefault(); room.sendChat(text); setText(''); }}>
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message the class…" className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-brand-500" />
                  <button className="rounded-xl bg-brand-600 px-3 hover:bg-brand-700" aria-label="Send"><Send className="h-4 w-4" /></button>
                </form>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-3">
                {isHost && (
                  <div className="mb-3 space-y-2 rounded-2xl bg-white/5 p-3 text-sm">
                    <Button size="sm" variant="danger" icon={MicOff} className="w-full" onClick={() => { room.muteAll(); toast.success('Everyone muted'); }}>Mute everyone</Button>
                    {[['studentsCanUnmute', 'Students can unmute'], ['studentsCanUseCamera', 'Students can turn on camera']].map(([k, label]) => (
                      <label key={k} className="flex items-center justify-between gap-2 py-1">
                        <span>{label}</span>
                        <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={room.rules[k]} onChange={(e) => room.setRule({ [k]: e.target.checked })} />
                      </label>
                    ))}
                  </div>
                )}
                {[...everyone].sort((a, b) => b.hand - a.hand || b.host - a.host).map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-white/5">
                    <Avatar name={p.name} photo={photoKey(p.role === 'student' ? 'Student' : 'Staff', p.personId)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}{p.id === room.myId ? ' (you)' : ''}</p>
                      <p className="text-[11px] text-slate-400">{p.host ? 'Teacher · host' : p.role === 'teacher' ? 'Teacher' : 'Student'}</p>
                    </div>
                    {p.hand && <Hand className="h-4 w-4 text-amber-300" />}
                    {p.mic ? <Mic className="h-4 w-4 text-slate-300" /> : <MicOff className="h-4 w-4 text-accent-400" />}
                    {p.cam ? <Video className="h-4 w-4 text-slate-300" /> : <VideoOff className="h-4 w-4 text-accent-400" />}
                    {isHost && p.id !== room.myId && (
                      <div className="flex gap-1">
                        {p.hand && <button title="Lower hand" onClick={() => room.command(p.id, 'lowerhand')} className="rounded-lg p-1 hover:bg-white/10"><Hand className="h-3.5 w-3.5" /></button>}
                        {p.mic && <button title="Mute" onClick={() => room.command(p.id, 'mute')} className="rounded-lg p-1 hover:bg-white/10"><MicOff className="h-3.5 w-3.5" /></button>}
                        {p.cam && <button title="Turn off camera" onClick={() => room.command(p.id, 'camoff')} className="rounded-lg p-1 hover:bg-white/10"><VideoOff className="h-3.5 w-3.5" /></button>}
                        <button title="Remove from class" onClick={() => room.command(p.id, 'remove')} className="rounded-lg p-1 text-accent-300 hover:bg-white/10"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="flex items-center justify-center gap-1 border-t border-white/5 px-2 py-2 safe-bottom sm:gap-2">
        <CtrlButton on={room.mic} onClick={doMic} icon={Mic} offIcon={MicOff} label={room.mic ? 'Mute' : micLocked ? 'Locked' : 'Unmute'} />
        <CtrlButton on={room.cam} onClick={doCam} icon={Video} offIcon={VideoOff} label={room.cam ? 'Stop video' : camLocked ? 'Locked' : 'Start video'} />
        {!isStudent && <CtrlButton on={room.screen ? true : undefined} onClick={doScreen} icon={room.screen ? MonitorX : MonitorUp} label={room.screen ? 'Stop sharing' : 'Share screen'} />}
        {!isHost && <CtrlButton on={room.hand ? true : undefined} onClick={room.toggleHand} icon={Hand} label={room.hand ? 'Lower hand' : 'Raise hand'} />}
        <CtrlButton on={room.bw === 'normal' ? undefined : true} onClick={() => { const next = { normal: 'low', low: 'audio', audio: 'normal' }[room.bw]; room.setBw(next); toast.info({ normal: 'Normal video', low: 'Low-data video', audio: 'Audio only' }[next], { normal: 'Best quality', low: 'Smaller video, uses about a quarter of the data', audio: 'No video sent or received; uses the least data' }[next]); }} icon={Gauge} label={{ normal: 'Data: normal', low: 'Data: low', audio: 'Audio only' }[room.bw]} />
        <CtrlButton onClick={() => setPanel(panel === 'chat' ? null : 'chat')} icon={MessageSquare} label="Chat" badge={panel === 'chat' ? 0 : Math.max(0, room.chat.length - seen)} />
        <CtrlButton onClick={() => setPanel(panel === 'people' ? null : 'people')} icon={Users} label={`People ${everyone.length}`} badge={isHost ? hands : 0} />
        <CtrlButton danger onClick={end} icon={PhoneOff} label={isHost ? 'End class' : 'Leave'} />
      </footer>
    </div>
  );
}

// ---------- lobby + routing ----------
export default function LiveRoom() {
  const { code: raw } = useParams();
  const code = normalizeCode(raw);
  const navigate = useNavigate();
  const db = useDB();
  const user = useCurrentUser();
  const L = useLookups();
  const session = db.liveSessions.find((s) => s.code === code);
  const isHost = !!session && canHost(user, session);
  const provider = session?.provider || db.settings.live.provider;
  const person = user.role === 'student' ? L.student(user.linkedId) : user.role === 'parent' ? null : L.staff(user.linkedId);
  const myName = user.role === 'student' ? fullName(person) : person ? `${person.title} ${person.firstName} ${person.lastName}` : user.name;
  const me = { name: myName, role: user.role === 'student' ? 'student' : user.role === 'parent' ? 'parent' : 'teacher', personType: user.role === 'student' ? 'Student' : 'Staff', personId: user.linkedId };
  const startMuted = me.role === 'student' && db.settings.live.studentsStartMuted;

  const [media, setMedia] = useState(null);
  const net0 = networkInfo();
  const [pre, setPre] = useState({ mic: !startMuted, cam: !net0.saveData, bw: net0.saveData ? 'audio' : net0.slow ? 'low' : 'normal' });
  const net = useNetwork();
  const [joined, setJoined] = useState(false);
  const exit = () => navigate('/live');

  useEffect(() => {
    if (provider === 'jitsi') return undefined;
    let alive = true;
    let opened;
    openMedia({ cam: true, mic: true }).then((m) => {
      opened = m;
      if (!alive) return m.stream.getTracks().forEach((t) => t.stop());
      setMedia(m);
      setPre((p) => ({ ...p, mic: p.mic && m.hasMic, cam: p.cam && m.hasCam }));
    });
    return () => {
      alive = false;
      if (!joined) opened?.stream.getTracks().forEach((t) => t.stop());
    };
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!media) return;
    media.stream.getAudioTracks().forEach((t) => (t.enabled = pre.mic));
    media.stream.getVideoTracks().forEach((t) => (t.enabled = pre.cam));
  }, [media, pre]);

  if (user.role === 'parent') return <StatusScreen icon={ShieldOff} title="Live classes are for teachers and students"><Button onClick={exit}>Back</Button></StatusScreen>;
  if (provider === 'jitsi') return <JitsiRoom code={code} session={session} isHost={isHost} me={me} onExit={exit} />;

  if (joined && media) {
    // Turning the camera off in the lobby should release it before joining.
    return <Room code={code} session={session} isHost={isHost} me={me} media={media} initial={pre} onExit={exit} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-navy-950 text-white">
      <header className="flex items-center gap-3 px-5 py-4">
        <button onClick={exit} className="rounded-xl p-2 hover:bg-white/10" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <SchoolLogo className="h-9 w-9" />
        <p className="font-bold">{db.settings.schoolName}</p>
      </header>
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 px-5 pb-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="relative aspect-video overflow-hidden rounded-3xl bg-navy-800 ring-1 ring-white/10">
          {media && pre.cam ? <VideoEl stream={media.stream} muted mirror className="object-cover" /> : (
            <div className="flex h-full items-center justify-center">{media ? <Avatar name={myName} photo={photoKey(me.personType, me.personId)} size="xl" /> : <Loader2 className="h-8 w-8 animate-spin text-slate-400" />}</div>
          )}
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-3">
            <button onClick={() => (media?.hasMic ? setPre({ ...pre, mic: !pre.mic }) : toast.error('No microphone available'))} className={cx('flex h-12 w-12 items-center justify-center rounded-full', pre.mic ? 'bg-white/20' : 'bg-accent-600')} aria-label="Toggle microphone">{pre.mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
            <button onClick={() => (media?.hasCam ? setPre({ ...pre, cam: !pre.cam }) : toast.error('No camera available'))} className={cx('flex h-12 w-12 items-center justify-center rounded-full', pre.cam ? 'bg-white/20' : 'bg-accent-600')} aria-label="Toggle camera">{pre.cam ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</button>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-accent-400">{isHost ? 'You are the host' : 'Ready to join?'}</p>
          <h1 className="mt-2 text-3xl font-extrabold">{session?.title || 'Live class'}</h1>
          {session && <p className="mt-2 text-slate-400">{L.className(session.classId)} · {L.subjectName(session.subjectId)} · {L.staffName(session.teacherId)}</p>}
          <p className="mt-1 font-mono text-sm text-slate-500">Class code {code}</p>
          {media?.error && <p className="mt-4 rounded-2xl bg-amber-500/15 p-3 text-sm text-amber-200">{media.error}</p>}
          {!net.online && <p className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-500/15 p-3 text-sm text-amber-200"><WifiOff className="h-4 w-4 shrink-0" /> You're offline. Connect to the internet to join the live class.</p>}
          <div className="mt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Gauge className="h-3.5 w-3.5" /> Data use {net.slow && <span className="normal-case text-amber-300">· slow connection detected</span>}</p>
            <div className="grid grid-cols-3 gap-2">
              {[['normal', 'Normal', 'Best video'], ['low', 'Low data', '~¼ the data'], ['audio', 'Audio only', 'Least data']].map(([k, label, sub]) => (
                <button key={k} onClick={() => setPre({ ...pre, bw: k, cam: k === 'audio' ? false : pre.cam })} className={cx('rounded-xl border px-2 py-2 text-left text-xs transition', pre.bw === k ? 'border-brand-400 bg-brand-500/20' : 'border-white/10 hover:border-white/30')}>
                  <p className="font-bold text-white">{label}</p>
                  <p className="text-slate-400">{sub}</p>
                </button>
              ))}
            </div>
          </div>
          {startMuted && <p className="mt-4 text-sm text-slate-400">Students join with their microphone off. Unmute when your teacher asks you to speak.</p>}
          <Button size="lg" className="mt-6 w-full" icon={isHost ? Radio : Video} disabled={!media || !net.online} onClick={() => {
            // Joining with the camera off releases it (light goes off) and sends black frames instead.
            if (!pre.cam) {
              media.stream.getVideoTracks().forEach((t) => {
                media.stream.removeTrack(t);
                t.stop();
              });
              media.stream.addTrack(blackVideoTrack());
            }
            setJoined(true);
          }}>
            {isHost ? 'Start class' : 'Join class'}
          </Button>
          <p className="mt-3 text-center text-xs text-slate-500">Joining as <b className="text-slate-300">{myName}</b>{isHost ? ' — students can join once you start.' : ''}</p>
          {isHost && (
            <button onClick={() => { navigator.clipboard?.writeText(inviteLink(code)); toast.success('Invite link copied'); }} className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-semibold text-brand-300 hover:text-brand-200"><Copy className="h-4 w-4" /> Copy invite link</button>
          )}
        </div>
      </div>
    </div>
  );
}
