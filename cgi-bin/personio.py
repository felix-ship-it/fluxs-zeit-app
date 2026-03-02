#!/usr/bin/env python3
"""
Personio API Proxy
Handles all Personio API calls server-side to avoid CORS issues.
Credentials are stored here only – never exposed to the frontend.
"""

import json
import os
import sys
import urllib.request
import urllib.error
import time

# ── Hardcoded Credentials (server-side only) ─────────────────────────────────
PERSONIO_CLIENT_ID = 'papi-d33f35d4-9ca1-4649-b786-fa93fb9246bf'
PERSONIO_CLIENT_SECRET = 'papi-MmIzY2Y1Y2QtN2E4OC00OTM0LThiNzItYzBiMDE5ZDExOGI1'
PERSONIO_BASE_URL = 'https://api.personio.de/v1'

# ── In-memory token cache (module-level, shared across CGI process lifetime) ──
# Note: CGI spawns a new process per request, so token is cached in a temp file
import tempfile
import os.path

TOKEN_CACHE_FILE = '/tmp/personio_token_cache.json'


def _load_token_cache():
    """Load cached token from temp file."""
    try:
        if os.path.exists(TOKEN_CACHE_FILE):
            with open(TOKEN_CACHE_FILE, 'r') as f:
                data = json.load(f)
                # Check if token is still valid (with 60s buffer)
                if data.get('expires_at', 0) > time.time() + 60:
                    return data.get('token')
    except Exception:
        pass
    return None


def _save_token_cache(token, expires_in=86400):
    """Save token to temp file."""
    try:
        with open(TOKEN_CACHE_FILE, 'w') as f:
            json.dump({
                'token': token,
                'expires_at': time.time() + expires_in,
            }, f)
    except Exception:
        pass


def _personio_request(method, path, data=None, token=None):
    """Make a request to the Personio API."""
    url = f'{PERSONIO_BASE_URL}{path}'
    headers = {
        'Content-Type': 'application/json',
        'accept': 'application/json',
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'

    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        try:
            return json.loads(error_body)
        except Exception:
            return {'success': False, 'error': {'message': f'HTTP {e.code}: {error_body[:200]}'}}
    except Exception as e:
        return {'success': False, 'error': {'message': str(e)}}


def _get_token():
    """Get a valid token, refreshing if needed."""
    # Try cache first
    cached = _load_token_cache()
    if cached:
        return cached, None

    # Authenticate
    result = _personio_request('POST', '/auth', {
        'client_id': PERSONIO_CLIENT_ID,
        'client_secret': PERSONIO_CLIENT_SECRET,
    })

    if result.get('success') and result.get('data', {}).get('token'):
        token = result['data']['token']
        expires_in = result['data'].get('expires_in', 86400)
        _save_token_cache(token, expires_in)
        return token, None
    else:
        msg = result.get('error', {})
        if isinstance(msg, dict):
            msg = msg.get('message', 'Auth failed')
        return None, str(msg)


def handle_auth():
    """Authenticate with Personio and return token status."""
    token, err = _get_token()
    if token:
        return {'success': True, 'message': 'Authenticated'}
    else:
        return {'success': False, 'error': err}


def _fetch_employees_with_retry():
    """Fetch employees, retry once on auth failure."""
    token, err = _get_token()
    if not token:
        return None, err

    result = _personio_request('GET', '/company/employees', token=token)

    if not result.get('success'):
        try:
            os.remove(TOKEN_CACHE_FILE)
        except Exception:
            pass
        token, err = _get_token()
        if not token:
            return None, err
        result = _personio_request('GET', '/company/employees', token=token)

    if result.get('success') and result.get('data'):
        return result['data'], None
    return None, result.get('error', {}).get('message', 'Unknown')


def handle_employees():
    """Fetch all employees from Personio."""
    data, err = _fetch_employees_with_retry()
    if data is None:
        return {'success': False, 'error': err}
    return {'success': True, 'data': data}


def handle_login(params):
    """Authenticate employee by email + company PIN."""
    email = (params.get('email') or '').strip().lower()
    pin = (params.get('password') or '').strip()

    if not email:
        return {'success': False, 'error': 'E-Mail ist erforderlich'}
    if not pin:
        return {'success': False, 'error': 'Passwort ist erforderlich'}

    # Company PIN — shared secret for all employees
    # Change this to your desired PIN
    COMPANY_PIN = 'fluxs2026'

    if pin != COMPANY_PIN:
        return {'success': False, 'error': 'Falsches Passwort'}

    # Fetch employees and match by email
    employees, err = _fetch_employees_with_retry()
    if employees is None:
        return {
            'success': False,
            'error': f'Personio nicht erreichbar: {err}',
        }

    # Find matching employee
    matched = None
    for emp in employees:
        attrs = emp.get('attributes', {})
        emp_email = attrs.get('email', {}).get('value', '')
        if emp_email and emp_email.strip().lower() == email:
            matched = emp
            break

    if not matched:
        return {
            'success': False,
            'error': 'Kein Mitarbeiter mit dieser E-Mail gefunden',
        }

    # Return matched employee data
    attrs = matched.get('attributes', {})
    first = attrs.get('first_name', {}).get('value', '')
    last = attrs.get('last_name', {}).get('value', '')
    dept = ''
    dept_val = attrs.get('department', {}).get('value', {})
    if isinstance(dept_val, dict):
        dept = dept_val.get('attributes', {}).get(
            'name', ''
        )
    role = attrs.get('position', {}).get('value', '')
    emp_id = attrs.get('id', {}).get('value', matched.get('id'))
    sup_val = attrs.get('supervisor', {}).get('value', {})
    sup_id = None
    if isinstance(sup_val, dict):
        sup_id = sup_val.get('attributes', {}).get(
            'id', {}
        ).get('value')

    return {
        'success': True,
        'employee': {
            'id': emp_id,
            'email': email,
            'firstName': first,
            'lastName': last,
            'name': f'{first} {last}'.strip(),
            'initials': f'{first[:1]}{last[:1]}'.upper(),
            'role': role,
            'dept': dept,
            'supervisorId': sup_id,
        },
    }


def handle_attendances(params):
    """Fetch attendance records for a date range."""
    token, err = _get_token()
    if not token:
        return {'success': False, 'error': err}

    start_date = params.get('start_date', '')
    end_date = params.get('end_date', '')
    employee_id = params.get('employee_id')

    query = f'?start_date={start_date}&end_date={end_date}'
    if employee_id:
        query += f'&employees[]={employee_id}'

    result = _personio_request('GET', f'/company/attendances{query}', token=token)
    return result


def handle_create_attendance(params):
    """Create a new attendance record."""
    token, err = _get_token()
    if not token:
        return {'success': False, 'error': err}

    attendance = {
        'employee': params.get('employee'),
        'date': params.get('date'),
        'start_time': params.get('start_time'),
        'end_time': params.get('end_time'),
        'break': params.get('break', 0),
        'comment': params.get('comment', 'Logged via FLUXS Zeit'),
    }

    result = _personio_request('POST', '/company/attendances',
                               data={'attendances': [attendance]},
                               token=token)
    return result


def handle_absences(params):
    """Fetch time-off records for a date range."""
    token, err = _get_token()
    if not token:
        return {'success': False, 'error': err}

    start_date = params.get('start_date', '')
    end_date = params.get('end_date', '')
    employee_id = params.get('employee_id')

    query = f'?start_date={start_date}&end_date={end_date}'
    if employee_id:
        query += f'&employees[]={employee_id}'

    result = _personio_request('GET', f'/company/time-offs{query}', token=token)
    return result


def main():
    method = os.environ.get('REQUEST_METHOD', 'GET')

    # Output CGI headers
    print('Content-Type: application/json')
    print('Access-Control-Allow-Origin: *')
    print('Access-Control-Allow-Methods: POST, GET, OPTIONS')
    print('Access-Control-Allow-Headers: Content-Type')
    print()

    # Handle preflight
    if method == 'OPTIONS':
        print('{}')
        return

    if method != 'POST':
        print(json.dumps({'success': False, 'error': 'Only POST supported'}))
        return

    # Read request body
    try:
        content_length = int(os.environ.get('CONTENT_LENGTH', 0))
        body = sys.stdin.read(content_length) if content_length > 0 else sys.stdin.read()
        params = json.loads(body) if body.strip() else {}
    except Exception as e:
        print(json.dumps({'success': False, 'error': f'Invalid JSON: {e}'}))
        return

    action = params.get('action', '')

    try:
        if action == 'auth':
            result = handle_auth()
        elif action == 'login':
            result = handle_login(params)
        elif action == 'employees':
            result = handle_employees()
        elif action == 'attendances':
            result = handle_attendances(params)
        elif action == 'create_attendance':
            result = handle_create_attendance(params)
        elif action == 'absences':
            result = handle_absences(params)
        else:
            result = {'success': False, 'error': f'Unknown action: {action}'}
    except Exception as e:
        result = {'success': False, 'error': str(e)}

    print(json.dumps(result))


if __name__ == '__main__':
    main()
