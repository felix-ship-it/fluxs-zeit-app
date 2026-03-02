# FLUXS Zeit App — CHANGES.md

## Implementation Summary
**Date:** 2026-03-02  
**Tasks:** SSO Login, Animations, Projekt Module

---

## TASK 1: Microsoft SSO Login

### `index.html`
- Added MSAL.js CDN: `https://alcdn.msauth.net/browser/2.38.0/js/msal-browser.min.js`
- Added "projekte" nav item between "übersicht" and "profil" (5-item nav)

### `screens/login/login.js` (full rewrite)
- Removed email+password form entirely
- New primary button: "mit microsoft anmelden" (large, Floral White bg, Microsoft 4-square icon)
- On staging: secondary demo form (email+pw, pre-filled with demo@fluxs.de / demo) shown below an "oder" divider
- Calls `Auth.loginWithSSO()` on SSO button click; handles errors inline
- Calls `Auth.login()` on demo form submit

### `screens/login/login.css`
- Added `.btn-sso` — large prominent button (56px min-height, floral white background, flex layout with Microsoft SVG icon)
- Added `.login-sso-wrapper`, `.btn-sso-icon`, `.btn-sso-text`, `.btn-sso-loading`, `.login-spinner-dark`
- Added `.login-divider` (horizontal rule with "oder" label)
- Added `.login-demo-form`, `.btn-demo-login` (outlined lime button for demo login)

### `core/auth.js`
- Added `MSAL_CONFIG` constant (clientId placeholder `YOUR_AZURE_CLIENT_ID`, authority `common`, redirectUri `window.location.origin`)
- Added `SSO_SCOPES = ['user.read', 'email']`
- Added `_getMSAL()` helper (lazy singleton `PublicClientApplication`)
- Added `export async function loginWithSSO()`
- Added `activeProject`, `projectStartTime`, `projectAccMs` to `logout()` batch reset

### `core/api.js`
- Added `export async function ssoLogin(email)` — calls `_call('sso_login', { email })`

### `cgi-bin/personio.py`
- Added `handle_sso_login(params)` function
- Added `'sso_login': handle_sso_login(params)` to `main()` dispatcher

---

## TASK 2: Animated Pictograms

### `screens/dashboard/dashboard.js`
- Added `<div class="ring-picto" id="ringPicto">` with 3 SVG elements
- `_update()` now toggles `.visible` class on pictograms

### `screens/dashboard/dashboard.css`
- Added `.ring-picto` container, `.picto` base/visible states
- Added `@keyframes smokeRise`, `@keyframes zFloat`

---

## TASK 3: Projekt Module

### `screens/projects/projects.js` (new file)
### `screens/projects/projects.css` (new file)
### `core/router.js` - Added projects route
### `core/state.js` - Added activeProject, projectStartTime, projectAccMs
### `screens/dashboard/dashboard.js` - Added project selection UI
### `screens/dashboard/clock.js` - Added project timer helpers
### `index.html` - Added projekte nav item
### `styles/layout.css` - Updated bottom-nav to 5-column grid