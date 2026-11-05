// Which app this build is: 'main' (school members), 'admin' (school Owner/Admin + Super Admin) or 'demo'.
export const MODE = import.meta.env.VITE_APP || 'demo';
export const LIVE = MODE !== 'demo';
export const ADMIN_APP = MODE === 'admin';
/** Namespaces browser storage so the three apps on the same website never share data. */
export const storeKey = (name) => (MODE === 'demo' ? name : `${name}-${MODE}`);
export const SITE = 'https://nyamebabaku-lab.github.io/edunexa/';
export const DEMO_SITE = `${SITE}demo/`;
export const ADMIN_SITE = `${SITE}admin/`;
/** True inside the Android app (Capacitor), false on the website. */
export const IS_NATIVE = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
const RELEASES = 'https://github.com/nyamebabaku-lab/edunexa/releases/latest/download/';
export const APK_URL = `${RELEASES}EduNexa.apk`;
export const ADMIN_APK_URL = `${RELEASES}EduNexa-Admin.apk`;
/** Phone-only accounts sign in with this stand-in email behind the scenes. */
export const PHONE_DOMAIN = 'phone.edunexa.app';
