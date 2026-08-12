import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { APP_ICON } from './appIcon.js';

// Wire the app icon + PWA metadata into <head> at runtime.
// This makes "Add to Home Screen" use the Sunrise icon even in the single-file
// build (where we don't control the outer document head).
function installPWAHead() {
  const head = document.head;
  const add = (tag, attrs) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    head.appendChild(el);
    return el;
  };

  add('link', { rel: 'apple-touch-icon', href: APP_ICON });
  add('link', { rel: 'icon', type: 'image/png', href: APP_ICON });

  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' });
  add('meta', { name: 'apple-mobile-web-app-title', content: 'Roam' });
  add('meta', { name: 'mobile-web-app-capable', content: 'yes' });

  const manifest = {
    name: 'Roam',
    short_name: 'Roam',
    description: 'Running scored on fun, not pace.',
    start_url: '.',
    display: 'standalone',
    background_color: '#0a0e12',
    theme_color: '#f0813c',
    icons: [
      { src: APP_ICON, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: APP_ICON, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  // Only inject a blob manifest when there's no real one (i.e. the single-file
  // artifact build). On a proper deploy we keep the file-based manifest.
  if (!head.querySelector('link[rel="manifest"]')) {
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    add('link', { rel: 'manifest', href: URL.createObjectURL(blob) });
  }
}

try { installPWAHead(); } catch (e) { /* non-fatal */ }

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
