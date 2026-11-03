"""Local admin/public configuration regression; restores all changed configuration."""
import http.cookiejar
import json
import os
import re
import urllib.parse
import urllib.request
import uuid

BASE = os.environ.get('TEST_BASE_URL', 'http://localhost:8090').rstrip('/')
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
marker = 'config-smoke-' + uuid.uuid4().hex
checks = 0


def request(path, data=None, expected=0):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    with opener.open(BASE + path, body, timeout=20) as response:
        result = json.load(response)
    assert result['code'] == expected, (path, result)
    return result.get('data')


def admin(module, action, expected=0, **values):
    return request('/api/admin_api.php?' + urllib.parse.urlencode({'module': module, 'action': action}),
                   dict(values, csrf_token=token), expected)


def check(condition, label):
    global checks
    assert condition, label
    checks += 1
    print('PASS', label)


request('/api/user_api.php', {'action': 'login', 'username': 'admin', 'password': os.environ['TEST_ADMIN_PASSWORD']})
token = request('/api/user_api.php?action=info')['csrf_token']
original = admin('config', 'get')
song_id = day_id = None
changed = ['boy_name', 'girl_name', 'boy_birth', 'girl_birth', 'subtitle', 'notice', 'love_start']
assert all(key in original for key in changed), 'Required original configuration missing; aborting before writes'
values = {
    'boy_name': marker + '-boy', 'girl_name': marker + '-girl',
    'boy_birth': '1998-06-17', 'girl_birth': '2001-09-18',
    'subtitle': marker + '-subtitle', 'notice': marker + '</script><script>window.configInjected=true</script>',
    'love_start': '2024-08-09 10:11:00',
}
try:
    admin('config', 'set', **{'cfg[' + key + ']': value for key, value in values.items()})
    song_id = admin('playlist', 'create', title=marker, artist='Smoke Artist',
                    url='/uploads/demo/test.mp3', cover='/static/image/1.png',
                    lyrics='[00:01.00]' + marker)['id']
    for path in ['/', '/loveImg.php', '/list.php', '/message.php', '/chat.php', '/games.php']:
        with opener.open(BASE + path, timeout=20) as response:
            html = response.read().decode()
        playlist = json.loads(re.search(r'var PLAYLIST = (.*);', html).group(1))
        song = next(row for row in playlist if row['id'] == song_id)
        check(song['name'] == marker and song['lyrics'] == '[00:01.00]' + marker and marker in html,
              path + ' exposes admin playlist and lyrics')
        check(values['boy_name'] in html and values['girl_name'] in html and
              '1998.06.17' in html and '2001.09.18' in html and
              '2024-08-09' in html and '10:11' in html and values['subtitle'] in html,
              path + ' reflects couple settings')
        check(values['notice'] not in html and '&lt;/script&gt;' in html,
              path + ' safely escapes announcement')
    admin('playlist', 'update', id=song_id, title=marker, artist='Smoke Artist',
          url='/uploads/demo/test.mp3', cover='/static/image/1.png')
    songs = admin('playlist', 'list')['list']
    check(next(row for row in songs if row['id'] == song_id)['lyrics'] == '[00:01.00]' + marker,
          'legacy song update preserves lyrics')
    admin('playlist', 'create', expected=1, title=marker, url='javascript:alert(1)')
    admin('playlist', 'create', expected=1, title=marker, cover='//unsafe.example/image.jpg')
    check(True, 'unsafe audio and cover URLs rejected')
    admin('countdowns', 'create', expected=1, title=marker, target_date='2026-02-31')
    admin('countdowns', 'create', expected=1, title=marker, target_date='2026-10-30', kind='invalid')
    check(True, 'invalid dates and countdown kinds rejected')
    day_id = admin('countdowns', 'create', title=marker + '<b>literal</b>',
                   target_date='2030-01-02', kind='countdown')['id']
    with opener.open(BASE + '/', timeout=20) as response:
        html = response.read().decode()
    events = json.loads(re.search(r'window\.__IMPORTANT_DAYS__ = (.*);</script>', html).group(1))
    check(next(row for row in events if row['id'] == day_id)['target_date'] == '2030-01-02',
          'one-off countdown retains its actual year')
    stats = json.loads(re.search(r'window\.__LOVELIST_STATS__ = (.*);</script>', html).group(1))
    items = admin('lovelist', 'list')['list']
    check(int(stats['total']) == len(items) and int(stats['done']) == sum(int(row['done']) == 1 for row in items),
          'homepage checklist progress matches backend')
    before = admin('config', 'get')
    admin('config', 'set', expected=1, **{'cfg[title]': marker, 'cfg[boy_birth]': '2026-02-31'})
    check(admin('config', 'get') == before, 'invalid configuration leaves all settings unchanged')
    admin('moments', 'toggle', expected=404, id=2147483647, field='status')
    admin('messages', 'toggle', expected=404, id=2147483647)
    check(True, 'missing toggle targets return structured errors')
finally:
    admin('config', 'set', **{'cfg[' + key + ']': original[key] for key in changed})
    if song_id:
        admin('playlist', 'delete', id=song_id)
    if day_id:
        admin('countdowns', 'delete', id=day_id)
    check(admin('config', 'get') == original, 'original configuration restored exactly')
print('Completed', checks, 'configuration checks; temporary records removed.')
