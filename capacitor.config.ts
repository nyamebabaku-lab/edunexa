// Two Android apps from one project: APP=main (default) → EduNexa, APP=admin → EduNexa Admin.
import type { CapacitorConfig } from '@capacitor/cli';

const admin = process.env.APP === 'admin';
const color = admin ? '#0a1330' : '#1d43d8';

const config: CapacitorConfig = {
  appId: admin ? 'com.edunexa.admin' : 'com.edunexa.app',
  appName: admin ? 'EduNexa Admin' : 'EduNexa',
  webDir: admin ? 'build/admin' : 'build/main',
  android: {
    path: admin ? 'android-admin' : 'android',
    backgroundColor: color,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1500, launchAutoHide: true, backgroundColor: color, androidScaleType: 'CENTER_CROP', showSpinner: false },
    StatusBar: { backgroundColor: color, style: 'DARK' },
  },
};

export default config;
