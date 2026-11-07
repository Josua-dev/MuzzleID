import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { env } from './lib/env';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// PWA: register the service worker (production builds served over HTTPS / localhost).
if ('serviceWorker' in navigator && env.isProd && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => undefined); });
}
