#!/usr/bin/env python3
"""
Instagram Post Checker for FLUXS GmbH
Checks the public Instagram profile for new posts/stories.
Returns the latest post info as JSON.
"""

import json
import os
import sys
import urllib.request
import urllib.error
import time
import re

INSTAGRAM_URL = 'https://www.instagram.com/fluxsgmbh/'
CACHE_FILE = '/tmp/fluxs_instagram_cache.json'
CACHE_TTL = 240  # 4 minutes (check interval is 5 min, so cache slightly shorter)

def _load_cache():
    try:
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r') as f:
                data = json.load(f)
                if data.get('cached_at', 0) > time.time() - CACHE_TTL:
                    return data
    except Exception:
        pass
    return None

def _save_cache(data):
    try:
        data['cached_at'] = time.time()
        with open(CACHE_FILE, 'w') as f:
            json.dump(data, f)
    except Exception:
        pass

def _check_instagram():
    """Fetch Instagram profile page and extract post info."""
    cached = _load_cache()
    if cached:
        return cached

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    }

    result = {
        'success': True,
        'has_new_post': False,
        'post_url': None,
        'post_caption': None,
        'post_type': None,  # 'post' | 'reel' | 'story'
        'checked_at': time.time(),
        'profile_url': INSTAGRAM_URL,
    }

    try:
        req = urllib.request.Request(INSTAGRAM_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='replace')

        # Try to find post data in the HTML
        # Instagram embeds JSON data in script tags
        # Look for shared_data or similar patterns

        # Method 1: Check meta tags for post content
        og_desc = re.search(r'<meta property="og:description" content="([^"]*)"', html)
        og_image = re.search(r'<meta property="og:image" content="([^"]*)"', html)

        # Method 2: Look for post count in the page source
        post_count_match = re.search(r'"edge_owner_to_timeline_media":\{"count":(\d+)', html)
        if not post_count_match:
            # Alternative pattern
            post_count_match = re.search(r'"media_count":(\d+)', html)

        # Method 3: Check page title / description for indicators
        has_posts = False
        if post_count_match:
            count = int(post_count_match.group(1))
            has_posts = count > 0
        else:
            # Fallback: check if "No Posts Yet" is NOT present
            has_posts = 'No Posts Yet' not in html and 'Noch keine Beiträge' not in html

        # Try to extract shortcode of latest post
        shortcode_match = re.search(r'"shortcode":"([^"]+)"', html)
        if shortcode_match:
            shortcode = shortcode_match.group(1)
            result['has_new_post'] = True
            result['post_url'] = f'https://www.instagram.com/p/{shortcode}/'
            result['post_type'] = 'post'

            # Try to get caption
            caption_match = re.search(r'"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"([^"]*)"', html)
            if caption_match:
                result['post_caption'] = caption_match.group(1)[:100]

        elif has_posts:
            # We know there are posts but can't extract shortcode
            result['has_new_post'] = True
            result['post_url'] = INSTAGRAM_URL
            result['post_type'] = 'post'

        # Extract description as fallback caption
        if not result.get('post_caption') and og_desc:
            desc = og_desc.group(1)
            if 'Followers' not in desc and 'Abonnenten' not in desc:
                result['post_caption'] = desc[:100]

    except urllib.error.HTTPError as e:
        result['success'] = True  # Don't fail the whole app
        result['error'] = f'HTTP {e.code}'
    except Exception as e:
        result['success'] = True
        result['error'] = str(e)

    _save_cache(result)
    return result


def main():
    # CGI response
    print("Content-Type: application/json")
    print("Access-Control-Allow-Origin: *")
    print("Access-Control-Allow-Methods: GET, POST, OPTIONS")
    print("Access-Control-Allow-Headers: Content-Type")
    print("")

    method = os.environ.get('REQUEST_METHOD', 'GET')

    if method == 'OPTIONS':
        print(json.dumps({'ok': True}))
        return

    try:
        result = _check_instagram()
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'has_new_post': False,
        }))

if __name__ == '__main__':
    main()
