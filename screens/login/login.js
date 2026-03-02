/**
 * FLUXS Zeit App — Login Screen
 * Employee PIN login with Personio lookup.
 * Max 500 lines.
 */

'use strict';

import * as State from '../../core/state.js';
import * as Auth from '../../core/auth.js';
import { $ } from '../../core/ui.js';

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

// ─── Template ─────────────────────────────────────────────────────────────────

function _template() {
  return `
    <div class="login-screen">
      <div class="login-logo">
        <svg viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="10" fill="#1A2B1F"/>
          <path d="M10 20 L20 10 L30 20 L20 30 Z" fill="#E7F883"/>
        </svg>
      </div>
      <h1 class="login-title">fluxs zeit</h1>
      <p class="login-subtitle">mitarbeiter-login</p>
      <form class="login-form" id="loginForm" novalidate>
        <div class="login-field">
          <label class="login-label" for="loginEmail">e-mail</label>
          <input class="login-input" type="email" id="loginEmail" autocomplete="email" placeholder="max@firma.de" required />
        </div>
        <div class="login-field">
          <label class="login-label" for="loginPin">pin</label>
          <input class="login-input" type="password" id="loginPin" autocomplete="current-password" inputmode="numeric" maxlength="6" placeholder="••••" required />
        </div>
        <div class="login-error" id="loginError"></div>
        <button class="login-btn" id="loginBtn" type="submit">einloggen</button>
      </form>
      <div class="login-demo-hint">demo: beliebige e-mail + pin 1234</div>
    </div>
  `;
}

// ─── Handle Submit ──────────────────────────────────────────────────────────────

async function _handleSubmit(e) {
  e.preventDefault();
  const email = $('loginEmail')?.value?.trim() || '';
  const pin = $('loginPin')?.value?.trim() || '';
  const errorEl = $('loginError');
  const btn = $('loginBtn');

  // Clear previous error
  if (errorEl) errorEl.textContent = '';
  $('loginEmail')?.classList.remove('error');
  $('loginPin')?.classList.remove('error');

  if (!email || !pin) {
    if (errorEl) errorEl.textContent = 'bitte e-mail und pin eingeben';
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'wird geprüft…'; }

  try {
    const ok = await Auth.login(email, pin);
    if (!ok) {
      if (errorEl) errorEl.textContent = 'falsche e-mail oder pin';
      $('loginEmail')?.classList.add('error');
      $('loginPin')?.classList.add('error');
    }
    // On success, auth module sets currentEmployee → router navigates automatically
  } catch (err) {
    if (errorEl) errorEl.textContent = 'anmeldefehler. bitte erneut versuchen.';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'einloggen'; }
  }
}

// ─── Mount / Unmount ─────────────────────────────────────────────────────────────

export async function mount(container) {
  _loadCSS();
  container.innerHTML = _template();
  const form = $('loginForm');
  if (form) form.addEventListener('submit', _handleSubmit);
}

export function unmount() {
  // nothing
}
