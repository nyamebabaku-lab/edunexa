// Peer-to-peer live classroom engine (WebRTC via PeerJS).
//
// Topology: every participant sends audio/video to every other participant (mesh),
// which suits groups of up to ~8. The host (teacher) is the source of truth for the
// roster, chat and classroom rules; everyone keeps a data connection to the host.
import { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { hostPeerId, guestPeerId, iceServers } from '../../lib/live';

// ---------- Placeholder tracks keep both audio and video slots negotiated when a device is off ----------
let sharedCtx;
export const audioCtx = () => (sharedCtx ||= new (window.AudioContext || window.webkitAudioContext)());

export function blackVideoTrack() {
  const c = Object.assign(document.createElement('canvas'), { width: 320, height: 180 });
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  const track = c.captureStream(1).getVideoTracks()[0];
  track._placeholder = true;
  // Repaint occasionally so the stream keeps producing frames.
  const t = setInterval(() => g.fillRect(0, 0, 1, 1), 1000);
  track.addEventListener('ended', () => clearInterval(t));
  return track;
}
function silentAudioTrack() {
  const ctx = audioCtx();
  const dst = ctx.createMediaStreamDestination();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  osc.connect(gain).connect(dst);
  osc.start();
  const track = dst.stream.getAudioTracks()[0];
  track._placeholder = true;
  return track;
}

const VIDEO = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } };
const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

/** Opens camera/mic for the pre-join screen; missing devices fall back to placeholders. */
export async function openMedia({ cam = true, mic = true } = {}) {
  const out = { stream: new MediaStream(), hasCam: false, hasMic: false, error: null };
  if (!navigator.mediaDevices?.getUserMedia) {
    out.error = window.isSecureContext ? 'This browser cannot use a camera or microphone.' : 'Camera and microphone only work on a secure (https://) address.';
  } else {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: cam ? VIDEO : false, audio: mic ? AUDIO : false });
      s.getTracks().forEach((t) => out.stream.addTrack(t));
      out.hasCam = s.getVideoTracks().length > 0;
      out.hasMic = s.getAudioTracks().length > 0;
    } catch (e) {
      // Try audio only, then nothing.
      if (cam && mic) {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: AUDIO });
          s.getTracks().forEach((t) => out.stream.addTrack(t));
          out.hasMic = true;
        } catch {
          /* no devices */
        }
      }
      out.error = e.name === 'NotAllowedError' ? 'Camera/microphone permission was denied. You can still join and watch, or allow access in your browser settings.' : e.name === 'NotFoundError' ? 'No camera or microphone was found.' : `Could not start camera/microphone (${e.name || e.message}).`;
    }
  }
  if (!out.stream.getAudioTracks().length) out.stream.addTrack(silentAudioTrack());
  if (!out.stream.getVideoTracks().length) out.stream.addTrack(blackVideoTrack());
  return out;
}

/**
 * @param {object} o
 * @param {string} o.code      room code
 * @param {boolean} o.isHost   true for the teacher
 * @param {object} o.me        { name, role, personType, personId }
 * @param {MediaStream} o.stream  local stream from openMedia()
 * @param {object} o.initial   { mic, cam } chosen in the lobby
 * @param {object} o.settings  live settings (max participants, student rules, TURN)
 * @param {function} o.onAttendance  host only: (event, participant) for join/leave
 */
export function useLiveRoom({ code, isHost, me, stream, initial, settings, onAttendance }) {
  const [status, setStatus] = useState('connecting'); // connecting | waiting | live | ended | removed | full | error
  const [error, setError] = useState(null);
  const [myId, setMyId] = useState(null);
  const [roster, setRoster] = useState([]); // [{ id, name, role, mic, cam, hand, screen }]
  const [streams, setStreams] = useState({}); // peerId -> MediaStream
  const [chat, setChat] = useState([]);
  const [rules, setRules] = useState({ studentsCanUnmute: settings.studentsCanUnmute, studentsCanUseCamera: settings.studentsCanUseCamera });
  const [mic, setMic] = useState(initial.mic);
  const [cam, setCam] = useState(initial.cam);
  const [hand, setHand] = useState(false);
  const [screen, setScreen] = useState(false);
  const [bw, setBwState] = useState(initial.bw || 'normal'); // normal | low | audio

  const r = useRef({}).current; // mutable engine state
  r.me = me;
  r.onAttendance = onAttendance;

  const hostId = hostPeerId(code);

  // ---------- helpers ----------
  const send = (conn, msg) => conn?.open && conn.send(msg);
  const self = () => ({ id: r.peer?.id, name: me.name, role: me.role, personId: me.personId, mic: r.mic, cam: r.cam, hand: r.hand, screen: r.screen, bw: r.bw, host: isHost });

  const broadcastRoster = () => {
    const list = [self(), ...Object.values(r.members).map((m) => m.info)];
    r.roster = list;
    setRoster(list);
    Object.values(r.members).forEach((m) => send(m.conn, { t: 'roster', list, rules: r.rules }));
    // The host is part of the mesh too: dial the participants it is responsible for.
    meshConnect(list.filter((p) => p.id && (p.id === r.peer?.id || r.members[p.id]?.info)));
    applyBandwidth();
  };

  const addCall = (call) => {
    r.calls[call.peer] = call;
    call.on('stream', (s) => {
      setStreams((x) => ({ ...x, [call.peer]: s }));
      setTimeout(applyBandwidth, 500);
    });
    const drop = () => {
      delete r.calls[call.peer];
      setStreams((x) => {
        const n = { ...x };
        delete n[call.peer];
        return n;
      });
    };
    call.on('close', drop);
    call.on('error', drop);
  };

  // Calls everyone in the roster we aren't connected to; the larger id dials to avoid double calls.
  const meshConnect = (list) => {
    const mine = r.peer?.id;
    list.forEach((p) => {
      if (!p.id || p.id === mine || r.calls[p.id]) return;
      if (mine > p.id) addCall(r.peer.call(p.id, r.stream));
    });
    // Hang up on anyone who left.
    Object.keys(r.calls).forEach((id) => {
      if (!list.some((p) => p.id === id)) r.calls[id].close();
    });
  };

  const replaceVideo = (track) => {
    const old = r.stream.getVideoTracks()[0];
    if (old) r.stream.removeTrack(old);
    r.stream.addTrack(track);
    Object.values(r.calls).forEach((c) => {
      const pc = c.peerConnection;
      if (!pc) return;
      const tr = pc.getTransceivers().find((t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video');
      tr?.sender.replaceTrack(track).catch(() => {});
    });
    if (old && old !== track) old.stop();
  };

  // Data saver: limit (or stop) the video each connection carries, per sender and receiver.
  const applyBandwidth = () => {
    Object.entries(r.calls || {}).forEach(([peerId, c]) => {
      const pc = c.peerConnection;
      if (!pc) return;
      const tr = pc.getTransceivers().find((t) => t.sender.track?.kind === 'video');
      if (!tr) return;
      const them = (r.roster || []).find((p) => p.id === peerId)?.bw || 'normal';
      const params = tr.sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      const e = params.encodings[0];
      const audioOnly = them === 'audio' || r.bw === 'audio';
      const low = them === 'low' || r.bw === 'low';
      e.active = !audioOnly;
      e.maxBitrate = low ? 150_000 : 700_000;
      e.scaleResolutionDownBy = low ? 2 : 1;
      e.maxFramerate = low ? 15 : 24;
      tr.sender.setParameters(params).catch(() => {});
    });
  };

  const pushState = () => {
    if (isHost) broadcastRoster();
    else send(r.hostConn, { t: 'state', mic: r.mic, cam: r.cam, hand: r.hand, screen: r.screen, bw: r.bw });
    applyBandwidth();
  };

  // ---------- message handling ----------
  const onHostData = (peerId, msg) => {
    const m = r.members[peerId];
    if (!m) return;
    if (msg.t === 'hello') {
      if (Object.keys(r.members).length >= settings.maxParticipants && settings.maxParticipants > 0) {
        send(m.conn, { t: 'full' });
        setTimeout(() => m.conn.close(), 300);
        return;
      }
      m.info = { id: peerId, name: msg.name, role: msg.role, personId: msg.personId, personType: msg.personType, mic: msg.mic, cam: msg.cam, bw: msg.bw || 'normal', hand: false, screen: false };
      broadcastRoster();
      send(m.conn, { t: 'chat-history', list: r.chat });
      r.onAttendance?.('join', m.info);
    } else if (msg.t === 'state' && m.info) {
      m.info = { ...m.info, mic: msg.mic, cam: msg.cam, hand: msg.hand, screen: msg.screen, bw: msg.bw || 'normal' };
      broadcastRoster();
    } else if (msg.t === 'chat' && m.info) {
      const item = { id: `${Date.now()}${Math.random()}`, from: m.info.name, role: m.info.role, text: String(msg.text).slice(0, 1000), at: new Date().toISOString() };
      r.chat = [...r.chat, item];
      setChat(r.chat);
      Object.values(r.members).forEach((x) => send(x.conn, { t: 'chat', item }));
    }
  };

  const onGuestData = (msg) => {
    if (msg.t === 'roster') {
      r.roster = msg.list;
      setRoster(msg.list);
      r.rules = msg.rules;
      setRules(msg.rules);
      setStatus('live');
      meshConnect(msg.list);
      applyBandwidth();
      // Enforce classroom rules on this device.
      if (!msg.rules.studentsCanUnmute && r.me.role === 'student' && r.mic) toggleMicRef.current(false);
      if (!msg.rules.studentsCanUseCamera && r.me.role === 'student' && r.cam) toggleCamRef.current(false);
    } else if (msg.t === 'chat') {
      r.chat = [...r.chat, msg.item];
      setChat(r.chat);
    } else if (msg.t === 'chat-history') {
      r.chat = msg.list;
      setChat(msg.list);
    } else if (msg.t === 'mute') {
      toggleMicRef.current(false);
    } else if (msg.t === 'camoff') {
      toggleCamRef.current(false);
    } else if (msg.t === 'lowerhand') {
      r.hand = false;
      setHand(false);
      pushState();
    } else if (msg.t === 'remove') {
      leaveRef.current('removed');
    } else if (msg.t === 'end') {
      leaveRef.current('ended');
    } else if (msg.t === 'full') {
      leaveRef.current('full');
    }
  };

  // ---------- connect ----------
  useEffect(() => {
    if (!stream) return undefined;
    Object.assign(r, { stream, calls: {}, members: {}, chat: [], roster: [], mic: initial.mic, cam: initial.cam, hand: false, screen: false, bw: initial.bw || 'normal', rules: { studentsCanUnmute: settings.studentsCanUnmute, studentsCanUseCamera: settings.studentsCanUseCamera }, closed: false });
    stream.getAudioTracks().forEach((t) => (t.enabled = initial.mic));
    let retry;
    const config = { config: { iceServers: iceServers(settings) }, debug: 0 };

    const start = () => {
      const peer = new Peer(isHost ? hostId : guestPeerId(code), config);
      r.peer = peer;
      peer.on('open', (id) => {
        setMyId(id);
        if (isHost) {
          setStatus('live');
          broadcastRoster();
        } else connectToHost();
      });
      peer.on('call', (call) => {
        call.answer(r.stream);
        addCall(call);
      });
      if (isHost) {
        peer.on('connection', (conn) => {
          r.members[conn.peer] = { conn, info: null };
          conn.on('data', (msg) => onHostData(conn.peer, msg));
          conn.on('close', () => {
            const m = r.members[conn.peer];
            delete r.members[conn.peer];
            if (m?.info) r.onAttendance?.('leave', m.info);
            r.calls[conn.peer]?.close();
            broadcastRoster();
          });
        });
      }
      peer.on('error', (e) => {
        if (r.closed) return;
        if (e.type === 'peer-unavailable' && !isHost) {
          setStatus('waiting');
          clearTimeout(retry);
          retry = setTimeout(connectToHost, 4000);
        } else if (e.type === 'unavailable-id' && isHost) {
          // The service may still be holding the id from a moment ago; retry a few times.
          r.idRetries = (r.idRetries || 0) + 1;
          if (r.idRetries <= 4) {
            setStatus('connecting');
            peer.destroy();
            retry = setTimeout(start, 3000);
          } else {
            setError('This class is already open on another device or tab. Close it there, then try again.');
            setStatus('error');
          }
        } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
          setError('Lost connection to the live-class service. Check your internet connection.');
          setStatus('error');
        } else if (e.type === 'browser-incompatible') {
          setError('This browser does not support live video. Use an up-to-date Chrome, Safari, Edge or Firefox.');
          setStatus('error');
        }
      });
      peer.on('disconnected', () => !r.closed && !peer.destroyed && peer.reconnect());
    };

    const connectToHost = () => {
      if (r.closed) return;
      r.hostConn?.close();
      const conn = r.peer.connect(hostId, { reliable: true });
      r.hostConn = conn;
      conn.on('open', () => send(conn, { t: 'hello', name: r.me.name, role: r.me.role, personId: r.me.personId, personType: r.me.personType, mic: r.mic, cam: r.cam, bw: r.bw }));
      conn.on('data', onGuestData);
      conn.on('close', () => {
        if (r.closed) return;
        setStatus('waiting');
        Object.values(r.calls).forEach((c) => c.close());
        clearTimeout(retry);
        retry = setTimeout(connectToHost, 4000);
      });
    };

    start();
    return () => {
      r.closed = true;
      clearTimeout(retry);
      if (isHost) Object.values(r.members).forEach((m) => send(m.conn, { t: 'end' }));
      setTimeout(() => r.peer?.destroy(), isHost ? 2000 : 0);
    };
  }, [stream, code, isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- local controls ----------
  const toggleMic = useCallback((on) => {
    const next = typeof on === 'boolean' ? on : !r.mic;
    if (next && !isHost && r.me.role === 'student' && r.rules && !r.rules.studentsCanUnmute) return false;
    const track = r.stream.getAudioTracks()[0];
    if (next && track?._placeholder) return 'no-device';
    if (track) track.enabled = next;
    r.mic = next;
    setMic(next);
    pushState();
    return true;
  }, [isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCam = useCallback(async (on) => {
    const next = typeof on === 'boolean' ? on : !r.cam;
    if (next && !isHost && r.me.role === 'student' && r.rules && !r.rules.studentsCanUseCamera) return false;
    if (r.screen) return false;
    if (next) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: VIDEO });
        replaceVideo(s.getVideoTracks()[0]);
      } catch {
        return 'no-device';
      }
    } else {
      // Release the camera (its light goes off) and send black frames instead.
      replaceVideo(blackVideoTrack());
    }
    r.cam = next;
    setCam(next);
    pushState();
    return true;
  }, [isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleScreen = useCallback(async () => {
    if (r.screen) {
      r.screen = false;
      setScreen(false);
      replaceVideo(r.cam ? (await navigator.mediaDevices.getUserMedia({ video: VIDEO }).then((s) => s.getVideoTracks()[0]).catch(() => blackVideoTrack())) : blackVideoTrack());
      pushState();
      return true;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) return 'unsupported';
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      const track = s.getVideoTracks()[0];
      track.addEventListener('ended', () => r.screen && toggleScreenRef.current());
      replaceVideo(track);
      r.screen = true;
      setScreen(true);
      pushState();
      return true;
    } catch {
      return false;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setBw = useCallback(async (mode) => {
    r.bw = mode;
    setBwState(mode);
    if (mode === 'audio' && r.cam) await toggleCamRef.current(false);
    pushState();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleHand = useCallback(() => {
    r.hand = !r.hand;
    setHand(r.hand);
    pushState();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendChat = useCallback((text) => {
    const t = text.trim();
    if (!t) return;
    if (isHost) {
      const item = { id: `${Date.now()}${Math.random()}`, from: r.me.name, role: r.me.role, text: t.slice(0, 1000), at: new Date().toISOString() };
      r.chat = [...r.chat, item];
      setChat(r.chat);
      Object.values(r.members).forEach((x) => send(x.conn, { t: 'chat', item }));
    } else send(r.hostConn, { t: 'chat', text: t });
  }, [isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- host controls ----------
  const command = useCallback((peerId, t) => send(r.members[peerId]?.conn, { t }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const muteAll = useCallback(() => Object.values(r.members).forEach((m) => send(m.conn, { t: 'mute' })), []); // eslint-disable-line react-hooks/exhaustive-deps
  const setRule = useCallback((patch) => {
    r.rules = { ...r.rules, ...patch };
    setRules(r.rules);
    broadcastRoster();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leave = useCallback((why = 'left') => {
    if (r.closed) return;
    r.closed = true;
    if (isHost) Object.values(r.members).forEach((m) => send(m.conn, { t: 'end' }));
    r.stream?.getTracks().forEach((t) => t.stop());
    setStatus(why);
    // Give the "class ended" message time to arrive before closing the connections.
    setTimeout(() => {
      Object.values(r.calls || {}).forEach((c) => c.close());
      r.peer?.destroy();
    }, isHost ? 2000 : 0);
  }, [isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMicRef = useRef(toggleMic);
  toggleMicRef.current = toggleMic;
  const toggleCamRef = useRef(toggleCam);
  toggleCamRef.current = toggleCam;
  const toggleScreenRef = useRef(toggleScreen);
  toggleScreenRef.current = toggleScreen;
  const leaveRef = useRef(leave);
  leaveRef.current = leave;

  return { status, error, myId, roster, streams, chat, rules, mic, cam, hand, screen, bw, setBw, toggleMic, toggleCam, toggleScreen, toggleHand, sendChat, command, muteAll, setRule, leave };
}
