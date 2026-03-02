#!/usr/bin/env python3
"""
FLUXS Zeit App — Structural QA Test Suite
Validates the micro-frontend architecture:
- All files under 500 lines
- All imports resolve
- All screens export mount/unmount
- All CSS loaded
- No broken references
- Env config works for staging + live
"""

import os
import re
import json
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(os.path.dirname(BASE), '')  # tests/ is inside app dir
if 'tests' in BASE:
    APP_DIR = os.path.dirname(BASE)
else:
    APP_DIR = BASE

# Auto-detect
if os.path.exists(os.path.join(APP_DIR, 'core', 'app.js')):
    pass
elif os.path.exists(os.path.join(os.path.dirname(APP_DIR), 'core', 'app.js')):
    APP_DIR = os.path.dirname(APP_DIR)

results = {'pass': 0, 'fail': 0, 'warn': 0, 'details': []}

def ok(test, msg):
    results['pass'] += 1
    results['details'].append({'status': 'PASS', 'test': test, 'msg': msg})

def fail(test, msg):
    results['fail'] += 1
    results['details'].append({'status': 'FAIL', 'test': test, 'msg': msg})
    print(f"  ❌ {test}: {msg}")

def warn(test, msg):
    results['warn'] += 1
    results['details'].append({'status': 'WARN', 'test': test, 'msg': msg})

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1: File size limit (max 500 lines)
# ═══════════════════════════════════════════════════════════════════════════════

print("📋 Test 1: File Size Limit (500 lines)")
for root, dirs, files in os.walk(APP_DIR):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '__pycache__', '.git', 'tests')]
    for f in files:
        if f.endswith(('.js', '.css', '.html')) and not f.endswith('.test.js'):
            path = os.path.join(root, f)
            rel = os.path.relpath(path, APP_DIR)
            lines = sum(1 for _ in open(path))
            if lines > 500:
                fail('file-size', f'{rel}: {lines} lines (max 500)')
            else:
                ok('file-size', f'{rel}: {lines} lines')

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2: Required files exist
# ═══════════════════════════════════════════════════════════════════════════════

print("\n📋 Test 2: Required Files Exist")
REQUIRED_FILES = [
    'index.html', 'manifest.json', 'sw.js',
    'core/app.js', 'core/state.js', 'core/router.js',
    'core/storage.js', 'core/api.js', 'core/auth.js',
    'core/ui.js', 'core/env.js',
    'styles/variables.css', 'styles/reset.css',
    'styles/typography.css', 'styles/layout.css', 'styles/utilities.css',
    'screens/login/login.js', 'screens/login/login.css',
    'screens/dashboard/dashboard.js', 'screens/dashboard/dashboard.css',
    'screens/dashboard/clock.js', 'screens/dashboard/timeline.js',
    'screens/absences/absences.js', 'screens/absences/absences.css',
    'screens/absences/absence-form.js',
    'screens/monthly/monthly.js', 'screens/monthly/monthly.css',
    'screens/profile/profile.js', 'screens/profile/profile.css',
    'assets/logo/fluxs-lime.svg', 'assets/logo/fluxs-dark.svg',
    'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
]

for f in REQUIRED_FILES:
    path = os.path.join(APP_DIR, f)
    if os.path.exists(path):
        ok('file-exists', f)
    else:
        fail('file-exists', f'Missing: {f}')

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 3: ES Module imports resolve
# ═══════════════════════════════════════════════════════════════════════════════

print("\n📋 Test 3: ES Module Imports Resolve")
import_pattern = re.compile(r"import\s+.*?from\s+['\"](.+?)['\"]")

for root, dirs, files in os.walk(APP_DIR):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '__pycache__', '.git', 'tests')]
    for f in files:
        if not f.endswith('.js'):
            continue
        path = os.path.join(root, f)
        rel = os.path.relpath(path, APP_DIR)
        content = open(path).read()
        for match in import_pattern.finditer(content):
            imp = match.group(1)
            if imp.startswith('.'):
                resolved = os.path.normpath(os.path.join(os.path.dirname(path), imp))
                if os.path.exists(resolved):
                    ok('import', f'{rel} → {imp}')
                else:
                    fail('import', f'{rel} → {imp} (file not found: {resolved})')

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4: Screen modules export mount/unmount
# ═══════════════════════════════════════════════════════════════════════════════

print("\n📋 Test 4: Screen Mount/Unmount Exports")
SCREENS = ['login/login.js', 'dashboard/dashboard.js', 'absences/absences.js', 'monthly/monthly.js', 'profile/profile.js']

for screen in SCREENS:
    path = os.path.join(APP_DIR, 'screens', screen)
    if not os.path.exists(path):
        fail('screen-exports', f'{screen}: file missing')
        continue
    content = open(path).read()
    has_mount = 'export async function mount' in content or 'export function mount' in content
    has_unmount = 'export function unmount' in content
    if has_mount:
        ok('screen-exports', f'{screen}: has mount()')
    else:
        fail('screen-exports', f'{screen}: missing mount() export')
    if has_unmount:
        ok('screen-exports', f'{screen}: has unmount()')
    else:
        fail('screen-exports', f'{screen}: missing unmount() export')

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 5: Router references all screens
# ═══════════════════════════════════════════════════════════════════════════════

print("\n📋 Test 5: Router References")
router_path = os.path.join(APP_DIR, 'core', 'router.js')
if os.path.exists(router_path):
    router = open(router_path).read()
    for screen in ['login', 'dashboard', 'absences', 'monthly', 'profile']:
        if screen in router:
            ok('router', f'Route: {screen}')
        else:
            fail('router', f'Missing route: {screen}')

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 6: CSS variables defined
# ═══════════════════════════════════════════════════════════════════════════════

print("\n📋 Test 6: CSS Variables")
vars_path = os.path.join(APP_DIR, 'styles', 'variables.css')
if os.path.exists(vars_path):
    css = open(vars_path).read()
    required_vars = [
        '--fluxs-green', '--fluxs-lime', '--fluxs-orange',
        '--bg-primary', '--bg-card', '--text-primary', '--text-accent',
        '--radius-md', '--radius-lg', '--space-4', '--ease-out',
    ]
    for v in required_vars:
        if v in css:
            ok('css-var', v)
        else:
            fail('css-var', f'Missing: {v}')

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 7: Env config
# ═══════════════════════════════════════════════════════════════════════════════

print("\n📋 Test 7: Environment Config")
env_path = os.path.join(APP_DIR, 'core', 'env.js')
if os.path.exists(env_path):
    env = open(env_path).read()
    for check in ['isLive', 'isStaging', 'demoFallback', '__FLUXS_ENV']:
        if check in env:
            ok('env', check)
        else:
            fail('env', f'Missing: {check}')

# index.html has env variable
html_path = os.path.join(APP_DIR, 'index.html')
if os.path.exists(html_path):
    html = open(html_path).read()
    if '__FLUXS_ENV' in html:
        ok('env', 'index.html sets __FLUXS_ENV')
    else:
        fail('env', 'index.html missing __FLUXS_ENV')

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 8: Manifest + SW
# ═══════════════════════════════════════════════════════════════════════════════

print("\n📋 Test 8: PWA Manifest & Service Worker")
mf_path = os.path.join(APP_DIR, 'manifest.json')
if os.path.exists(mf_path):
    mf = json.load(open(mf_path))
    for key in ['name', 'short_name', 'start_url', 'display', 'icons']:
        if key in mf:
            ok('manifest', key)
        else:
            fail('manifest', f'Missing: {key}')

sw_path = os.path.join(APP_DIR, 'sw.js')
if os.path.exists(sw_path):
    sw = open(sw_path).read()
    for check in ['install', 'activate', 'fetch', 'caches']:
        if check in sw:
            ok('sw', check)
        else:
            fail('sw', f'Missing: {check}')

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 9: No forbidden patterns
# ═══════════════════════════════════════════════════════════════════════════════

print("\n📋 Test 9: No Forbidden Patterns")
for root, dirs, files in os.walk(APP_DIR):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '__pycache__', '.git', 'tests')]
    for f in files:
        if not f.endswith('.js'):
            continue
        path = os.path.join(root, f)
        rel = os.path.relpath(path, APP_DIR)
        content = open(path).read()
        # No localStorage (use IndexedDB via storage.js)
        if 'localStorage' in content and 'storage.js' not in rel:
            fail('forbidden', f'{rel}: uses localStorage (use core/storage.js)')
        # No sessionStorage
        if 'sessionStorage' in content:
            fail('forbidden', f'{rel}: uses sessionStorage')

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

print("\n" + "=" * 70)
print("RESULTS SUMMARY")
print("=" * 70)
print(f"\n  ✅ PASS: {results['pass']}")
print(f"  ❌ FAIL: {results['fail']}")
print(f"  ⚠️  WARN: {results['warn']}")
total = results['pass'] + results['fail'] + results['warn']
print(f"\n  TOTAL: {total}")
if total > 0:
    rate = results['pass'] / total * 100
    print(f"  PASS RATE: {rate:.1f}%")

# Save report
report_path = os.path.join(APP_DIR, 'tests', 'qa', 'qa_report.json')
os.makedirs(os.path.dirname(report_path), exist_ok=True)
with open(report_path, 'w') as f:
    json.dump(results, f, indent=2)
print(f"\nFull report saved: {report_path}")

sys.exit(1 if results['fail'] > 0 else 0)
