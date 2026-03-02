/**
 * FLUXS Zeit App — Login Screen
 * Email + password form, authenticated against Personio.
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
  const demoHint = Env.isStaging()
    ? `<p class="login-demo-hint">demo-login: demo@fluxs.de / demo</p>`
    : '';

  return `
    <div class="login-screen">
      <div class="login-logo">
        <img src="./assets/logo/fluxs-lime.svg" alt="FLUXS"
             style="height:36px;width:auto" />
      </div>
      <h2 class="login-title">fluxs arbeitszeiterfassung</h2>
      <p class="login-subtitle">logge dich mit deinen personio daten ein</p>

      <form class="login-form" id="loginForm" autocomplete="on">
        <div class="form-field">
          <label for="loginEmail" class="form-label">e-mail</label>
          <input
            type="email"
            id="loginEmail"
            name="email"
            class="form-input"
            placeholder="name@fluxs.de"
            autocomplete="email"
            inputmode="email"
            required
          />
        </div>

        <div class="form-field">
          <label for="loginPassword" class="form-label">passwort</label>
          <input
            type="password"
            id="loginPassword"
            name="password"
            class="form-input"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
        </div>

        <button type="submit" class="btn-login" id="btnLogin">
          <span class="btn-login-text">anmelden</span>
          <span class="btn-login-loading" style="display:none">
            <span class="login-spinner"></span>
          </span>
        </button>

        <div class="login-error" id="loginError" style="display:none"></div>
      </form>

      ${demoHint}
    </div>
  `;
}

// ─── Form Submit Handler ───────────────────────────────────────────────────

async function _handleSubmit(e) {
  e.preventDefault();

  const emailInput = document.getElementById('loginEmail');
  const pwInput = document.getElementById('loginPassword');
  const btn = document.getElementById('btnLogin');
  const errDiv = document.getElementById('loginError');

  const email = (emailInput?.value || '').trim();
  const password = (pwInput?.value || '').trim();

  if (!email || !password) {
    _showError('bitte e-mail und passwort eingeben');
    return;
  }

  // Show loading
  _setLoading(true);
  errDiv.style.display = 'none';

  const result = await Auth.login(email, password);

  if (!result.success) {
    _setLoading(false);
    // Error toast is already shown by Auth.login
  }
}

function _setLoading(loading) {
  const btn = document.getElementById('btnLogin');
  const textEl = btn?.querySelector('.btn-login-text');
  const loadEl = btn?.querySelector('.btn-login-loading');
  const form = document.getElementById('loginForm');

  if (btn) btn.disabled = loading;
  if (textEl) textEl.style.display = loading ? 'none' : 'inline';
  if (loadEl) loadEl.style.display = loading ? 'inline-flex' : 'none';

  // Disable inputs during login
  const inputs = form?.querySelectorAll('input');
  inputs?.forEach(i => { i.disabled = loading; });
}

function _showError(msg) {
  const errDiv = document.getElementById('loginError');
  if (errDiv) {
    errDiv.textContent = msg;
    errDiv.style.display = 'block';
  }
}

// ─── Pre-fill last email ───────────────────────────────────────────────────

async function _prefillEmail() {
  const lastEmail = await Auth.getLastEmail();
  if (lastEmail) {
    const input = document.getElementById('loginEmail');
    if (input) {
      input.value = lastEmail;
      // Focus password instead
      document.getElementById('loginPassword')?.focus();
    }
  }
}

// ─── Mount / Unmount ────────────────────────────────────────────────────────

export async function mount(container) {
  _loadCSS();
  container.innerHTML = _template();

  // Bind form submit
  const form = document.getElementById('loginForm');
  form?.addEventListener('submit', _handleSubmit);

  // Pre-fill email from last session
  await _prefillEmail();

  // Focus email if not pre-filled
  const emailInput = document.getElementById('loginEmail');
  if (emailInput && !emailInput.value) {
    setTimeout(() => emailInput.focus(), 200);
  }
}

export function unmount() {
  // Nothing to clean up
}
