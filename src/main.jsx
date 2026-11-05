import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { loadPhotos } from './data/photos';
import { startOfflineServices } from './data/offline';
import { toast } from './components/ui';
import { LIVE, IS_NATIVE } from './config';
import { startLive } from './data/sync';

loadPhotos();
if (LIVE) startLive();
// Android back button: go back inside the app, close it from the first screen.
if (IS_NATIVE)
  import('@capacitor/app').then(({ App: Native }) =>
    Native.addListener('backButton', ({ canGoBack }) => (canGoBack ? window.history.back() : Native.exitApp())),
  );
startOfflineServices((n) => toast.success('Back online', n ? `${n} queued text message(s) sent` : 'Everything is up to date'));
window.addEventListener('edunexa-storage-full', () => toast.error('Device storage is full', 'Free up space or download a backup in Settings → Data'));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
