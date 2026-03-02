/**
 * FLUXS Zeit App — Environment Configuration
 * Single source of truth for staging vs. live behavior.
 *
 * The env is determined by a global set in index.html:
 *   window.__FLUXS_ENV = 'live' | 'staging'
 *
 * Staging: Demo employees as fallback, test data generators
 * Live:    Personio-only, no demo fallback, loading/error states
 *
 * Max 500 lines.
 */

'use strict';

// ─── Read environment ───────────────────────────────────────────────────────

export function getEnv() {
  return (typeof window !== 'undefined' && window.__FLUXS_ENV) || 'staging';
}

export function isLive() {
  return getEnv() === 'live';
}

export function isStaging() {
  return getEnv() === 'staging';
}

// ─── Environment-specific config ────────────────────────────────────────────

const CONFIG = {
  live: {
    appTitle: 'FLUXS Zeiterfassung',
    demoFallback: false,
    requirePersonio: true,
    showDebugBadge: false,
    offlineQueueEnabled: true,
    logLevel: 'warn',
  },
  staging: {
    appTitle: 'FLUXS Zeiterfassung [STAGING]',
    demoFallback: true,
    requirePersonio: false,
    showDebugBadge: true,
    offlineQueueEnabled: true,
    logLevel: 'debug',
  },
};

export function config() {
  return CONFIG[getEnv()] || CONFIG.staging;
}

// ─── Logging (respects env) ─────────────────────────────────────────────────

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function _shouldLog(level) {
  const current = config().logLevel || 'debug';
  return LOG_LEVELS[level] >= LOG_LEVELS[current];
}

export function log(msg, ...args) {
  if (_shouldLog('debug')) console.log(`[FLUXS:${getEnv()}]`, msg, ...args);
}

export function info(msg, ...args) {
  if (_shouldLog('info')) console.info(`[FLUXS:${getEnv()}]`, msg, ...args);
}

export function warn(msg, ...args) {
  if (_shouldLog('warn')) console.warn(`[FLUXS:${getEnv()}]`, msg, ...args);
}

export function error(msg, ...args) {
  if (_shouldLog('error')) console.error(`[FLUXS:${getEnv()}]`, msg, ...args);
}