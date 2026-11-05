// Phone push notifications (Android apps). The build only turns this on when Firebase is configured
// (VITE_PUSH=1, set by CI when google-services.json is present) — without Firebase, registering would crash the app.
import { IS_NATIVE, ADMIN_APP } from '../config';
import { supabase } from './supabase';
import { toast } from '../components/ui';

export const PUSH_READY = IS_NATIVE && import.meta.env.VITE_PUSH === '1';
let started = false;
let myToken = null;

/** Asks for permission (Android 13+ shows the system prompt) and registers this phone for the signed-in account. */
export async function startPush(navigate) {
  if (!PUSH_READY || started) return;
  started = true;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.createChannel({ id: 'school', name: 'School updates', description: 'Messages, approvals, attendance, fees and results', importance: 5, visibility: 1, vibration: true }).catch(() => {});
  PushNotifications.addListener('registration', async ({ value }) => {
    myToken = value;
    await supabase.rpc('save_push_token', { token: value, app: ADMIN_APP ? 'admin' : 'main', platform: 'android' });
  });
  PushNotifications.addListener('registrationError', (e) => console.warn('push registration', e));
  // App open: show it inside the app (Android doesn't put it in the tray while the app is in front).
  PushNotifications.addListener('pushNotificationReceived', (n) => toast.info(n.title || 'EduNexa', n.body || ''));
  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const link = notification?.data?.link;
    if (link) navigate ? navigate(link) : (window.location.hash = `#${link}`);
  });
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') {
    toast.info('Notifications are off', 'Turn them on in your phone Settings → Apps → EduNexa → Notifications');
    return;
  }
  await PushNotifications.register();
}

/** On sign-out: this phone stops getting the previous account's notifications. */
export async function stopPush() {
  if (!PUSH_READY) return;
  if (myToken) await supabase.rpc('drop_push_token', { token: myToken }).catch(() => {});
  started = false;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.removeAllListeners().catch(() => {});
}
