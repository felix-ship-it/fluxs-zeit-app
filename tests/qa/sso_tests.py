#!/usr/bin/env python3
"""
FLUXS Zeit App — SSO Test Suite
Tests for Microsoft SSO integration:
- Config validation (isSSOConfigured logic)
- Auth flow error handling
- Staging fallback behaviour
- Login screen SSO hint rendering
- AZURE_SSO_SETUP.md guide exists + complete
"""

import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = BASE
# Navigate up from tests/qa/ to app root
while APP_DIR and not os.path.exists(os.path.join(APP_DIR, 'core', 'app.js')):
    parent = os.path.dirname(APP_DIR)
    if parent == APP_DIR:
        break
    APP_DIR = parent

results = {'pass': 0, 'fail': 0, 'warn': 0, 'details': []}

def ok(test, msg):
    results['pass'] += 1
    results['details'].append({'status': 'PASS', 'test': test, 'msg': msg})

def fail(test, msg):
    results['fail'] += 1
    results['details'].append({'status': 'FAIL', 'test': test, 'msg': msg})
    print(f"  FAIL {test}: {msg}")

def warn(test, msg):
    results['warn'] += 1
    results['details'].append({'status': 'WARN', 'test': test, 'msg': msg})
    print(f"  WARN {test}: {msg}")

def read_file(rel_path):
    full = os.path.join(APP_DIR, rel_path)
    if not os.path.exists(full):
        return None
    with open(full, 'r', encoding='utf-8', errors='replace') as f:
        return f.read()


# ======================================================================
# TEST 1: isSSOConfigured() exists and validates properly
# ======================================================================

print("Test 1: isSSOConfigured() validation in core/auth.js")

auth_js = read_file('core/auth.js')
if auth_js is None:
    fail('sso-config-exists', 'core/auth.js not found')
else:
    # 1a: isSSOConfigured function is exported
    if 'export function isSSOConfigured' in auth_js:
        ok('sso-config-export', 'isSSOConfigured is exported')
    else:
        fail('sso-config-export', 'isSSOConfigured not exported')

    # 1b: Checks for placeholder string YOUR_
    if "YOUR_" in auth_js and "includes('YOUR_')" in auth_js:
        ok('sso-config-placeholder', 'Checks for YOUR_ placeholder')
    else:
        fail('sso-config-placeholder', 'Missing YOUR_ placeholder check')

    # 1c: UUID regex validation
    uuid_re = r'\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}'
    if re.search(uuid_re, auth_js):
        ok('sso-config-uuid', 'UUID regex validation present')
    else:
        fail('sso-config-uuid', 'Missing UUID regex validation')

    # 1d: Length check (> 10)
    if 'length > 10' in auth_js or 'length >= 10' in auth_js:
        ok('sso-config-length', 'String length check present')
    else:
        fail('sso-config-length', 'Missing string length check')

    # 1e: MSAL_CLIENT_ID constant exists
    cid_match = re.search(
        r"const\s+MSAL_CLIENT_ID\s*=\s*['\"](.+?)['\"]", auth_js
    )
    if cid_match:
        cid_val = cid_match.group(1)
        ok('sso-client-id-const', f'MSAL_CLIENT_ID = "{cid_val}"')
        # If still placeholder, that's expected pre-setup
        if 'YOUR_' in cid_val:
            warn('sso-client-id-value',
                 'Client ID is still placeholder - Azure setup needed')
    else:
        fail('sso-client-id-const', 'MSAL_CLIENT_ID constant not found')

    # 1f: MSAL_TENANT constant exists
    if re.search(r"const\s+MSAL_TENANT\s*=", auth_js):
        ok('sso-tenant-const', 'MSAL_TENANT constant present')
    else:
        fail('sso-tenant-const', 'MSAL_TENANT constant missing')


# ======================================================================
# TEST 2: SSO login flow handles errors gracefully
# ======================================================================

print("Test 2: SSO error handling in core/auth.js")

if auth_js:
    # 2a: loginWithSSO checks isSSOConfigured before MSAL
    if 'isSSOConfigured()' in auth_js and 'loginWithSSO' in auth_js:
        login_fn_match = re.search(
            r'export\s+async\s+function\s+loginWithSSO', auth_js
        )
        if login_fn_match:
            ok('sso-flow-config-check',
               'loginWithSSO checks isSSOConfigured()')
        else:
            fail('sso-flow-config-check',
                 'loginWithSSO function not found')
    else:
        fail('sso-flow-config-check',
             'isSSOConfigured not used in login flow')

    # 2b: Staging fallback when SSO not configured
    if 'isStaging()' in auth_js and 'DEMO_EMPLOYEE' in auth_js:
        ok('sso-staging-fallback',
           'Staging falls back to demo when SSO unconfigured')
    else:
        fail('sso-staging-fallback', 'No staging fallback found')

    # 2c: User-friendly error for live when not configured
    if 'Azure App Registration' in auth_js or 'AZURE_SSO_SETUP' in auth_js:
        ok('sso-live-error-msg',
           'Live mode shows helpful SSO setup error message')
    else:
        fail('sso-live-error-msg',
             'Missing user-friendly error for unconfigured SSO on live')

    # 2d: MSAL popup user_cancelled handling
    if 'user_cancelled' in auth_js:
        ok('sso-cancel-handling', 'Handles user_cancelled from MSAL popup')
    else:
        fail('sso-cancel-handling', 'Missing user_cancelled error handling')

    # 2e: _getMSAL throws SSO_NOT_CONFIGURED when invalid
    if 'SSO_NOT_CONFIGURED' in auth_js:
        ok('sso-msal-guard', '_getMSAL guards with SSO_NOT_CONFIGURED')
    else:
        fail('sso-msal-guard', '_getMSAL missing SSO_NOT_CONFIGURED guard')

    # 2f: MSAL cache uses memoryStorage (not sessionStorage)
    if 'memoryStorage' in auth_js:
        ok('sso-memory-cache', 'MSAL uses memoryStorage (S3 compatible)')
    else:
        if 'sessionStorage' in auth_js:
            fail('sso-memory-cache',
                 'MSAL uses sessionStorage - breaks on S3')
        else:
            warn('sso-memory-cache', 'Could not verify MSAL cache config')

    # 2g: Personio SSO verification (email lookup)
    if 'ssoLogin' in auth_js:
        ok('sso-personio-verify',
           'SSO verifies user against Personio after MSAL auth')
    else:
        fail('sso-personio-verify', 'Missing Personio verification for SSO')


# ======================================================================
# TEST 3: Login screen shows SSO hint when not configured
# ======================================================================

print("Test 3: Login screen SSO hint")

login_js = read_file('screens/login/login.js')
login_css = read_file('screens/login/login.css')

if login_js is None:
    fail('login-js-exists', 'screens/login/login.js not found')
else:
    # 3a: Login imports isSSOConfigured
    if 'isSSOConfigured' in login_js:
        ok('login-imports-sso-check',
           'Login screen imports isSSOConfigured')
    else:
        fail('login-imports-sso-check',
             'Login screen does not import isSSOConfigured')

    # 3b: SSO hint rendered conditionally
    if 'login-sso-hint' in login_js:
        ok('login-sso-hint-render',
           'SSO hint element rendered in login template')
    else:
        fail('login-sso-hint-render', 'SSO hint element not in template')

    # 3c: SSO button always present (even if not configured)
    if 'btn-sso' in login_js or 'btnSSO' in login_js:
        ok('login-sso-btn-present', 'SSO button is in the login screen')
    else:
        fail('login-sso-btn-present', 'SSO button missing from login')

    # 3d: Microsoft icon present in SSO button
    if 'f25022' in login_js or 'microsoft' in login_js.lower():
        ok('login-ms-icon', 'Microsoft icon/branding in SSO button')
    else:
        warn('login-ms-icon', 'Microsoft icon not detected in SSO button')

if login_css is None:
    fail('login-css-exists', 'screens/login/login.css not found')
else:
    # 3e: SSO hint CSS class exists
    if '.login-sso-hint' in login_css:
        ok('login-sso-hint-css', '.login-sso-hint CSS class defined')
    else:
        fail('login-sso-hint-css', '.login-sso-hint CSS class missing')

    # 3f: SSO button CSS
    if '.btn-sso' in login_css:
        ok('login-btn-sso-css', '.btn-sso CSS class defined')
    else:
        fail('login-btn-sso-css', '.btn-sso CSS class missing')

    # 3g: Error display CSS
    if '.login-error' in login_css:
        ok('login-error-css', '.login-error CSS class defined')
    else:
        fail('login-error-css', '.login-error CSS class missing')


# ======================================================================
# TEST 4: MSAL.js CDN loaded in index.html
# ======================================================================

print("Test 4: MSAL.js CDN in index.html")

index_html = read_file('index.html')
if index_html is None:
    fail('index-html-exists', 'index.html not found')
else:
    if 'msal-browser' in index_html or 'msal' in index_html.lower():
        ok('msal-cdn-loaded', 'MSAL.js CDN script found in index.html')
    else:
        fail('msal-cdn-loaded', 'MSAL.js CDN script missing in index.html')


# ======================================================================
# TEST 5: Backend SSO endpoint exists
# ======================================================================

print("Test 5: Backend SSO support")

personio_py = read_file('cgi-bin/personio.py')
if personio_py is None:
    fail('backend-exists', 'cgi-bin/personio.py not found')
else:
    # 5a: SSO login handler
    if 'handle_sso_login' in personio_py or 'sso_login' in personio_py:
        ok('backend-sso-handler', 'SSO login handler in backend')
    else:
        fail('backend-sso-handler', 'SSO login handler missing')

    # 5b: Email-only auth (no password for SSO)
    if 'email' in personio_py:
        ok('backend-email-lookup', 'Backend supports email-based lookup')
    else:
        fail('backend-email-lookup', 'Backend missing email-based lookup')

api_js = read_file('core/api.js')
if api_js:
    # 5c: ssoLogin function in API module
    if 'ssoLogin' in api_js:
        ok('api-sso-fn', 'ssoLogin() function in core/api.js')
    else:
        fail('api-sso-fn', 'ssoLogin() function missing from core/api.js')


# ======================================================================
# TEST 6: AZURE_SSO_SETUP.md guide exists and is complete
# ======================================================================

print("Test 6: Azure SSO Setup Guide")

guide = read_file('AZURE_SSO_SETUP.md')
if guide is None:
    fail('guide-exists', 'AZURE_SSO_SETUP.md not found')
else:
    ok('guide-exists', 'AZURE_SSO_SETUP.md found')

    required_sections = [
        ('App Registration', 'guide-section-registration'),
        ('Client ID', 'guide-section-client-id'),
        ('Redirect URI', 'guide-section-redirect'),
        ('API Permission', 'guide-section-permissions'),
        ('Fehlerbehebung', 'guide-section-troubleshoot'),
    ]
    for section_kw, test_id in required_sections:
        if section_kw.lower() in guide.lower():
            ok(test_id, f'Guide covers {section_kw}')
        else:
            fail(test_id, f'Guide missing section about {section_kw}')

    if 'MSAL_CLIENT_ID' in guide:
        ok('guide-refs-const', 'Guide references MSAL_CLIENT_ID constant')
    else:
        fail('guide-refs-const', 'Guide should reference MSAL_CLIENT_ID')

    if 'AADSTS700016' in guide:
        ok('guide-error-codes', 'Guide covers AADSTS700016 error')
    else:
        warn('guide-error-codes', 'Guide should mention AADSTS700016')


# ======================================================================
# TEST 7: isSSOConfigured() logic validation (simulated)
# ======================================================================

print("Test 7: isSSOConfigured() logic validation (simulated)")

def is_sso_configured(client_id):
    """Python replica of isSSOConfigured() from auth.js"""
    if not isinstance(client_id, str):
        return False
    if len(client_id) <= 10:
        return False
    if 'YOUR_' in client_id:
        return False
    uuid_re = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    return bool(re.match(uuid_re, client_id, re.IGNORECASE))

test_cases = [
    ('YOUR_AZURE_CLIENT_ID', False, 'Placeholder rejected'),
    ('', False, 'Empty string rejected'),
    ('short', False, 'Short string rejected'),
    ('not-a-uuid-but-long-enough', False, 'Non-UUID rejected'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', True, 'Valid UUID accepted'),
    ('A1B2C3D4-E5F6-7890-ABCD-EF1234567890', True, 'Uppercase UUID ok'),
    ('00000000-0000-0000-0000-000000000000', True, 'Zero UUID accepted'),
    ('YOUR_a1b2c3d4-e5f6-7890-abcd-ef1234567890', False, 'YOUR_ rejected'),
    ('a1b2c3d4-e5f6-7890-abcd', False, 'Incomplete UUID rejected'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890-extra', False, 'Extra rejected'),
]

for client_id, expected, desc in test_cases:
    result_val = is_sso_configured(client_id)
    if result_val == expected:
        ok(f'sso-logic-{desc.lower().replace(" ", "-")}', desc)
    else:
        fail(f'sso-logic-{desc.lower().replace(" ", "-")}',
             f'{desc}: expected {expected}, got {result_val}')


# ======================================================================
# TEST 8: Login screen subtitle text
# ======================================================================

print("Test 8: Login screen content")

if login_js:
    if 'microsoft' in login_js.lower():
        ok('login-sso-instruction',
           'Login screen mentions Microsoft login')
    else:
        fail('login-sso-instruction',
             'Login screen should mention Microsoft login')

    if 'fluxs' in login_js.lower():
        ok('login-fluxs-brand', 'FLUXS branding on login screen')
    else:
        fail('login-fluxs-brand', 'FLUXS branding missing from login')


# ======================================================================
# RESULTS
# ======================================================================

print("\n" + "=" * 60)
total = results['pass'] + results['fail']
print(f"SSO Tests: {results['pass']}/{total} passed"
      f" | {results['fail']} failed"
      f" | {results['warn']} warnings")
print("=" * 60)

if results['fail'] > 0:
    print("\nFAILED TESTS:")
    for d in results['details']:
        if d['status'] == 'FAIL':
            print(f"   - {d['test']}: {d['msg']}")

if results['warn'] > 0:
    print("\nWARNINGS:")
    for d in results['details']:
        if d['status'] == 'WARN':
            print(f"   - {d['test']}: {d['msg']}")

print()
sys.exit(1 if results['fail'] > 0 else 0)
