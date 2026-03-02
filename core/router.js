/**
 * FLUXS Zeit App — SPA Router with Lazy Loading
 * Hash-based routing for Apache/CGI hosting compatibility.
 * Max 200 lines.
 */

'use strict';

import * as Auth from './auth.js';

// ─── Route Registry ──────────────────────────────────────────────────────────

const ROUTES = {
  '/login':      { module: '../views/login.js',      public: true  },
  '/dashboard':  { module: '../views/dashboard.js',  public: false },
  '/attendance': { module: '../views/attendance.js', public: false },
  '/absences':   { module: '../views/absences.js',   public: false },
  '/team':       { module: '../views/team.js',       public: false, role: 'manager' },
  '/settings':   { module: '../views/settings.js',   public: false, role: 'admin'   },
};

// ─── State ────────────────────────────────────────────────────────────────────

let _currentRoute = null;
let _container = null;

// ─── Init ────────────────────────────────────────────────────────────────────

export function init(containerId = 'app') {
  _container = document.getElementById(containerId);
  window.addEventListener('hashchange', _onHashChange);
}

// ─── Navigate ──────────────────────────────────────────────────────────────

export function navigate(path) {
  window.location.hash = path;
  _loadRoute(path);
}

// ─── Internal ─────────────────────────────────────────────────────────────

function _onHashChange() {
  const path = window.location.hash.replace('#', '') || '/dashboard';
  _loadRoute(path);
}

async function _loadRoute(path) {
  const route = ROUTES[path];

  if (!route) {
    navigate('/dashboard');
    return;
  }

  // Auth guard
  if (!route.public && !Auth.isLoggedIn()) {
    navigate('/login');
    return;
  }

  // Role guard
  if (route.role && !Auth.hasRole(route.role)) {
    navigate('/dashboard');
    return;
  }

  // Load and render view module
  try {
    const mod = await import(route.module);
    if (mod.render && _container) {
      _currentRoute = path;
      _container.innerHTML = '';
      await mod.render(_container);
    }
  } catch (e) {
    console.error('[Router] Failed to load route:', path, e);
  }
}
