/**
 * FLUXS Zeit App — Main Entry Point
 * Initializes all core modules, routes to login, handles env setup.
 * Max 500 lines.
 */

'use strict';

import * as State from './state.js';
import * as Router from './router.js';
import * as Storage from './storage.js';
import * as API from './api.js';
import * as Auth from './auth.js';
import * as Env from './env.js';
import { $, showToast, updateClock } from './ui.js';

// ─── Boot ───────────────────────────────────────────────────────────────────

async function boot() {
  Env.log('Booting...', Env.getEnv());

  // Init router (event delegation)
  Router.init();

  // Show staging badge if needed
  if (Env.isStaging() && Env.config().showDebugBadge) {
    const badge = document.createElement('div');
    badge.className = 'env-badge';
    badge.textContent = 'STAGING';
    document.body.appendChild(badge);
  }

  // Start clock
  updateClock();
  setInterval(updateClock, 1000);

  // Listen for state changes to update header
  State.subscribe('currentEmployee', _updateHeader);
  State.subscribe('activeScreen', _updateShell);

  // Navigate to login (no auto-connect before login!)
  await Router.navigate('login');

  // Hide loader
  setTimeout(() => {
    const loader = $('pageLoader');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => { loader.style.display = 'none'; }, 600);
    }
  }, 800);

  // Setup offline sync listener
  window.addEventListener('online', _onOnline);

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // PWA install prompt
  _initPWA();

  Env.log('Boot complete');
}

// ─── Personio Connection ────────────────────────────────────────────────────

async function _connectPersonio() {
  Env.log('Connecting to Personio...');
  const result = await API.autoConnect();

  if (result.success) {
    Env.log(`Personio connected: ${result.count} employees`);
  } else {
    Env.warn('Personio connection failed:', result.error);
    if (Env.isLive()) {
      // Live: this is critical — login will show error
      Env.error('Live mode requires Personio');
    }
  }
}

// ─── Online/Offline Handling ────────────────────────────────────────────────

async function _onOnline() {
  Env.log('Back online — syncing offline queue...');
  const result = await API.syncOfflineQueue();
  if (result.synced > 0) {
    showToast(`${result.synced} Einträge synchronisiert`, 'success');
  }
}

// ─── Header Update ──────────────────────────────────────────────────────────

function _updateHeader(emp) {
  const avatar = $('headerAvatarSm');
  const name = $('headerEmployeeName');
  if (emp) {
    if (avatar) avatar.textContent = emp.initials || '--';
    if (name) name.textContent = emp.name || '--';
  }
}

// ─── Shell Visibility ───────────────────────────────────────────────────────

function _updateShell(screen) {
  const header = $('appHeader');
  const nav = $('bottomNav');
  const isLogin = screen === 'login';

  if (header) header.style.display = isLogin ? 'none' : 'flex';
  if (nav) nav.style.display = isLogin ? 'none' : 'flex';
}

// ─── PWA Install Prompt ─────────────────────────────────────────────────────

let _deferredPrompt = null;

function _initPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    _showPWABanner();
  });

  // iOS detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !isStandalone) {
    _showPWABanner(true);
  }
}

function _showPWABanner(isIOS = false) {
  // Don't show if already installed
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  const banner = document.createElement('div');
  banner.className = 'pwa-banner';
  banner.innerHTML = `
    <img class="pwa-banner-icon" src="./assets/icons/icon-192.png" alt="FLUXS" />
    <div class="pwa-banner-text">
      <div class="pwa-banner-title">fluxs zeit installieren</div>
      <div class="pwa-banner-sub">als app auf deinem gerät hinzufügen</div>
    </div>
    <button class="btn-primary" id="btnPwaInstall" style="padding:8px 16px;font-size:12px">installieren</button>
    <button style="color:var(--text-muted);font-size:18px;padding:4px" id="btnPwaDismiss">✕</button>
  `;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('visible'));

  $('btnPwaInstall')?.addEventListener('click', async () => {
    if (isIOS) {
      showToast('Tippe auf "Teilen" → "Zum Home-Bildschirm"', 'info', 5000);
    } else if (_deferredPrompt) {
      _deferredPrompt.prompt();
      const result = await _deferredPrompt.userChoice;
      Env.log('PWA install:', result.outcome);
      _deferredPrompt = null;
    }
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 400);
  });

  $('btnPwaDismiss')?.addEventListener('click', () => {
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 400);
  });
}

// ─── Global Error Handling ──────────────────────────────────────────────────

window.addEventListener('error', (e) => {
  Env.error('Uncaught error:', e.message, e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
  Env.error('Unhandled rejection:', e.reason);
});

// ─── Expose for debugging ───────────────────────────────────────────────────

window.__FLUXS = { State, Router, API, Auth, Storage, Env };

// ─── Start ──────────────────────────────────────────────────────────────────

boot();
