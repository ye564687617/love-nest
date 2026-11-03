"""Moderation search regression; removes only its own message fixtures."""
import http.cookiejar
import json
import os
import subprocess
import urllib.parse
import urllib.request
import uuid

base = os.environ.get('TEST_BASE_URL', 'http://localhost:8090').rstrip('/')
marker = 'moderation-' + uuid.uuid4().hex[:16]
http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
checks = 0


def call(path, data=None, expected=0):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    with http.open(base + path, body, timeout=20) as response:
        result = json.load(response)
    assert result['code'] == expected, result
    return result.get('data')


def php(code):
    result = subprocess.run(['docker', 'compose', 'exec', '-T', 'php', 'php'],
        input='<?php require "/var/www/html/inc/site.php"; ' + code,
        text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return result.stdout


def check(value, label):
    global checks
    assert value, label
    checks += 1
    print('PASS', label)


call('/api/user_api.php', {'action': 'login', 'username': 'admin', 'password': os.environ['TEST_ADMIN_PASSWORD']})
token = call('/api/user_api.php?action=info')['csrf_token']


def listing(**params):
    return call('/api/admin_api.php?' + urllib.parse.urlencode(dict(module='messages', action='list', q=marker, **params)))


try:
    ids = json.loads(php('$ids=[]; for($i=0;$i<16;$i++) $ids[]=db()->insert("messages",["nickname"=>'
        + json.dumps(marker) + ',"content"=>$i===0?"oldest-needle":"fixture-".$i,"status"=>$i%2,"avatar"=>"","ip"=>"","location"=>"","img"=>"","gift_icon"=>"","gift_name"=>""]); echo json_encode($ids);'))
    first = listing()
    check(first['total'] == 16 and len(first['list']) == 15, 'filtered count and first-page size')
    second = listing(page=2)
    check(len(second['list']) == 1 and second['list'][0]['id'] == ids[0], 'oldest record remains on second page')
    result = call('/api/admin_api.php?' + urllib.parse.urlencode(dict(module='messages', action='list', q='oldest-needle')))
    check(any(row['id'] == ids[0] for row in result['list']), 'content search reaches records outside current page')
    for status in (0, 1):
        result = listing(status=status)
        check(result['total'] == 8 and all(row['status'] == status for row in result['list']), f'status {status} combines with nickname search')
    check(listing(page=999)['page'] == 2, 'out-of-range page clamps to last page')
    call('/api/admin_api.php?module=messages&action=list&status=invalid', expected=1)
    check(True, 'invalid status rejected')
    call('/api/admin_api.php?module=messages&action=toggle', dict(id=ids[0], csrf_token=token))
    check(listing(status=1)['total'] == 9, 'moderation status reflected in filtered totals')
    call('/api/admin_api.php?module=messages&action=delete', dict(id=ids[0], csrf_token=token))
    result = listing(page=2)
    check(result['page'] == 1 and len(result['list']) == 15, 'deleting last-page item returns to populated page')
    result = call('/api/admin_api.php?' + urllib.parse.urlencode(dict(module='messages', action='list', q=marker + '-missing', page=9)))
    check(result['page'] == 1 and result['total'] == 0 and result['list'] == [], 'empty search returns a consistent page')
finally:
    php('db()->query("DELETE FROM messages WHERE nickname=?",[' + json.dumps(marker) + ']);')

print(f'{checks} moderation checks passed')
