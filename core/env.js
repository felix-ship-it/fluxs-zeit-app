/**
 * FLUXS Zeit App — Environment Configuration
 * Single source of truth for all environment-specific settings.
 * Max 100 lines.
 */

'use strict';

// ─── Environment Detection ─────────────────────────────────────────────────────

const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const isProd = !['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname);

// ─── Config ────────────────────────────────────────────────────────────────────

export const ENV = {
  VERSION: '1.0.0',
  IS_PROD: isProd,
  IS_DEV: !isProd,

  // App identity
  APP_NAME: 'FLUXS Zeit',
  APP_LOGO: './assets/fluxs-logo.svg',

  // Personio CGI proxy
  PERSONIO_PROXY: './cgi-bin/personio.py',
  ATTENDANCE_API: './cgi-bin/attendance.py',
  ABSENCES_API: './cgi-bin/absences.py',
  INSTAGRAM_API: './cgi-bin/instagram.py',

  // Feature flags
  FEATURES: {
    OFFLINE_QUEUE: true,
    INSTAGRAM_CHECKER: true,
    EXPORT_CSV: true,
    DARK_MODE: false,
  },

  // Timeouts (ms)
  TIMEOUTS: {
    API_REQUEST: 15_000,
    SESSION: 8 * 60 * 60 * 1000,  // 8h
    SYNC_INTERVAL: 60_000,
    INSTAGRAM_CHECK: 300_000,
  },

  // Pagination
  PAGE_SIZE: 50,
};

// ─── Debug helper ────────────────────────────────────────────────────────────────

if (ENV.IS_DEV) {
  console.log('[ENV]', ENV);
}
