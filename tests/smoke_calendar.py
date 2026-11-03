"""Local calendar persistence regression; removes only its own fixtures."""
import http.cookiejar
import json
import os
import urllib.error
import urllib.parse
import urllib.request

base = 'http://localhost:8090'
http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
token = ''
ids = []

def call(path, values=None, expected=0):
    data = urllib.parse.urlencode(dict(values, csrf_token=token)).encode() if values is not None else None
    try:
        response = http.open(base + path, data, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        result = json.load(response)
    assert result['code'] == expected, result
    return result.get('data')

def admin(action, expected=0, **values):
    return call('/api/admin_api.php?module=countdowns&action=' + action, values, expected)

def row(key):
    return next(r for r in admin('list')['list'] if int(r['id']) == key)

try:
    call('/api/user_api.php', {'action':'login', 'username':'admin', 'password':os.environ['TEST_ADMIN_PASSWORD']})
    token = call('/api/user_api.php?action=info')['csrf_token']
    before = admin('list')['list']
    birthday = admin('create', title='Calendar test birthday', kind='birthday', target_date='2001-09-14', festival_key='')['id']
    ids.append(birthday)
    assert row(birthday)['target_date'] == '2001-09-14'
    admin('create', expected=1, title='Invalid future birthday', kind='birthday', target_date='2999-01-01')
    admin('create', expected=1, title='Invalid festival', kind='festival', target_date='2026-01-01', festival_key='unknown')
    festival = admin('create', title='Ignored preset title', kind='festival', target_date='2026-08-19', festival_key='qixi')['id']
    ids.append(festival)
    assert row(festival)['title'] == '七夕' and row(festival)['festival_key'] == 'qixi'
    admin('update', id=festival, title='七夕', kind='festival', target_date='2026-08-19')
    assert row(festival)['festival_key'] == 'qixi'
    admin('update', id=festival, title='Calendar test anniversary', kind='anniversary', target_date='2020-01-01')
    assert row(festival)['festival_key'] == ''
    assert [r for r in admin('list')['list'] if int(r['id']) not in ids] == before
    print('PASS calendar birth year persistence, future rejection, presets, legacy updates, type changes and existing-record preservation')
finally:
    for key in ids:
        admin('delete', id=key)
