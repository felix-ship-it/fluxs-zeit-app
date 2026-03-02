/**
 * FLUXS Zeit App — Login Screen
 * Microsoft SSO login via MSAL popup. Demo login on staging.
 * Max 500 lines.
 */

'use strict';

import * as Auth from '../../core/auth.js';
import * as Env from '../../core/env.js';
import { showToast } from '../../core/ui.js';

// ─── Load CSS ───────────────────────────────────────────────────────────────

function _loadCSS() {
  if (!document.getElementById('css-login')) {
    const link = document.createElement('link');
    link.id = 'css-login';
    link.rel = 'stylesheet';
    link.href = './screens/login/login.css';
    document.head.appendChild(link);
  }
}

// ─── Template ───────────────────────────────────────────────────────────────

function _template() {
  const demoSection = Env.isStaging() ? `
    <div class="login-divider"><span>oder</span></div>
    <form class="login-demo-form" id="demoForm" autocomplete="on">
      <div class="form-field">
        <label for="demoEmail" class="form-label">e-mail</label>
        <input
          type="email"
          id="demoEmail"
          name="email"
          class="form-input"
          placeholder="demo@fluxs.de"
          autocomplete="email"
          inputmode="email"
          value="demo@fluxs.de"
        />
      </div>
      <div class="form-field">
        <label for="demoPassword" class="form-label">passwort</label>
        <input
          type="password"
          id="demoPassword"
          name="password"
          class="form-input"
          placeholder="••••••••"
          autocomplete="current-password"
          value="demo"
        />
      </div>
      <button type="submit" class="btn-demo-login" id="btnDemoLogin">
        <span class="btn-login-text">demo anmelden</span>
        <span class="btn-login-loading" style="display:none">
          <span class="login-spinner"></span>
        </span>
      </button>
    </form>
  ` : '';

  return `
    <div class="login-screen">
      <div class="login-logo">
        <img src="./assets/logo/fluxs-lime.svg" alt="FLUXS"
             style="height:36px;width:auto" />
      </div>
      <h2 class="login-title">fluxs arbeitszeiterfassung</h2>
      <p class="login-subtitle">logge dich mit deinen microsoft daten ein</p>

      <div class="login-sso-wrapper">
        <button class="btn-sso" id="btnSSO">
          <svg class="btn-sso-icon" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          <span class="btn-sso-text">mit microsoft anmelden</span>
          <span class="btn-sso-loading" style="display:none">
            <span class="login-spinner login-spinner-dark"></span>
          </span>
        </button>
        ${!Auth.isSSOConfigured() ? '<p class="login-sso-hint">\u26a0 Azure App Registration noch nicht eingerichtet</p>' : ''}
        <div class="login-error" id="loginError" style="display:none"></div>
      </div>

      ${demoSection}
    </div>
  `;
}

// ─── SSO Handler ────────────────────────────────────────────────────────────

async function _handleSSO() {
  const btn = document.getElementById('btnSSO');
  const errDiv = document.getElementById('loginError');

  _setSSOLoading(true);
  if (errDiv) errDiv.style.display = 'none';

  const result = await Auth.loginWithSSO();

  if (!result.success) {
    _setSSOLoading(false);
    _showError(result.error || 'SSO-Anmeldung fehlgeschlagen');
  }
  // On success, Auth navigates to dashboard — no further action needed
}

function _setSSOLoading(loading) {
  const btn = document.getElementById('btnSSO');
  const textEl = btn?.querySelector('.btn-sso-text');
  const loadEl = btn?.querySelector('.btn-sso-loading');
  if (btn) btn.disabled = loading;
  if (textEl) textEl.style.display = loading ? 'none' : 'inline';
  if (loadEl) loadEl.style.display = loading ? 'inline-flex' : 'none';
}

// ─── Demo Form Handler ───────────────────────────────────────────────────────

async function _handleDemoSubmit(e) {
  e.preventDefault();
  const email = (document.getElementById('demoEmail')?.value || '').trim();
  const password = (document.getElementById('demoPassword')?.value || '').trim();

  if (!email || !password) {
    _showError('bitte e-mail und passwort eingeben');
    return;
  }

  const btn = document.getElementById('btnDemoLogin');
  if (btn) btn.disabled = true;
  const textEl = btn?.querySelector('.btn-login-text');
  const loadEl = btn?.querySelector('.btn-login-loading');
  if (textEl) textEl.style.display = 'none';
  if (loadEl) loadEl.style.display = 'inline-flex';

  const result = await Auth.login(email, password);

  if (!result.success) {
    if (btn) btn.disabled = false;
    if (textEl) textEl.style.display = 'inline';
    if (loadEl) loadEl.style.display = 'none';
  }
}

function _showError(msg) {
  const errDiv = document.getElementById('loginError');
  if (errDiv) {
    errDiv.textContent = msg;
    errDiv.style.display = 'block';
  }
}

// ─── Mount / Unmount ────────────────────────────────────────────────────────

export async function mount(container) {
  _loadCSS();
  container.innerHTML = _template();

  // Bind SSO button
  document.getElementById('btnSSO')?.addEventListener('click', _handleSSO);

  // Bind demo form (staging only)
  document.getElementById('demoForm')?.addEventListener('submit', _handleDemoSubmit);
}

export function unmount() {
  // Nothing to clean up
}
