"""Isolated security/message checks. Does not change admin credentials or site settings."""
import concurrent.futures
import hashlib
import http.cookiejar
import json
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = 'http://localhost:8090'
name = 'sec_' + uuid.uuid4().hex[:16]
secret = uuid.uuid4().hex
checks = 0


def php(code):
    result = subprocess.run(['docker', 'compose', 'exec', '-T', 'php', 'php'],
        input='<?php require "/var/www/html/inc/site.php"; ' + code,
        text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return result.stdout


def client():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def call(http, path, values=None, headers=None):
    data = urllib.parse.urlencode(values).encode() if values is not None else None
    try:
        response = http.open(urllib.request.Request(BASE + path, data, headers or {}), timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, json.load(response)


def check(value, label):
    global checks
    assert value, label
    checks += 1
    print('PASS', label)


user_id = None
try:
    user_id = int(php('$id=db()->insert("users",["username"=>' + json.dumps(name) + ',"password_hash"=>password_hash(' + json.dumps(secret) + ',PASSWORD_DEFAULT),"nickname"=>"Security test","role"=>"user"]); echo $id;'))
    browser = client()
    with browser.open(BASE + '/admin/login.php') as response:
        cookie = response.headers.get('Set-Cookie', '')
        check('HttpOnly' in cookie and 'SameSite=Lax' in cookie and 'Secure;' not in cookie, 'HTTP session cookie protected without breaking localhost')
    _, login = call(browser, '/api/user_api.php', {'action': 'login', 'username': name, 'password': secret})
    check(login['code'] == 0, 'normal login succeeds')
    _, info = call(browser, '/api/user_api.php?action=info', headers={'X-Forwarded-For': '8.8.8.8', 'X-Real-IP': '1.1.1.1'})
    check(info['data']['visitor_id'] not in ['8.8.8.8', '1.1.1.1'], 'untrusted forwarded IP headers ignored')
    token = info['data']['csrf_token']
    for field in ['content', 'img', 'location', 'gift_icon', 'gift_name']:
        values = {'csrf_token': token, 'content': name, field + '[]': 'bad'}
        if field == 'content':
            del values['content']
        status, result = call(browser, '/api/message_api.php', values)
        check(status == 200 and result['code'] == 1, field + ' array rejected without server error')
    _, result = call(browser, '/api/message_api.php', {'csrf_token': token, 'content': '字' * 201})
    check(result['code'] == 1, 'overlong message rejected rather than silently truncated')
    php('for($i=0;$i<25;$i++)db()->insert("messages",["user_id"=>' + str(user_id) + ',"nickname"=>"Security test","content"=>' + json.dumps(name) + ',"status"=>1]);')
    _, first = call(browser, '/api/message_api.php?limit=20')
    cursor = first['data']['list'][-1]['id']
    _, posted = call(browser, '/api/message_api.php', {'csrf_token': token, 'content': name, 'gift_icon': 'x', 'gift_name': 'test'})
    check(posted['code'] == 0 and posted['data']['total'] == first['data']['total'] + 1, 'posting returns authoritative updated total')
    _, second = call(browser, '/api/message_api.php?limit=20&before=' + str(cursor))
    a = {int(row['id']) for row in first['data']['list']}
    b = {int(row['id']) for row in second['data']['list']}
    check(not a.intersection(b) and all(value < int(cursor) for value in b), 'cursor pagination remains stable after new messages')
    check(second['data']['gift_total'] == posted['data']['gift_total'], 'gift totals consistent across post and list')
    bad = {'action': 'login', 'username': name, 'password': 'incorrect'}
    for _ in range(8):
        status, result = call(client(), '/api/user_api.php', bad)
        check(result['code'] != 0 and status != 500, 'fresh-cookie failed attempt recorded')
    status, blocked = call(client(), '/api/user_api.php', bad, {'X-Forwarded-For': '9.9.9.9'})
    check(status == 429 and blocked['code'] == 429 and blocked['data']['retry_after'] > 0, 'cookie reset and IP spoof cannot bypass login limit')
    pair_key = hashlib.sha256(('pair:' + name + ':' + info['data']['visitor_id']).encode()).hexdigest()
    php('db()->query("UPDATE auth_rate_limits SET expires_at=0 WHERE bucket=?",[' + json.dumps(pair_key) + ']);')
    status, resumed = call(client(), '/api/user_api.php', {'action': 'login', 'username': name, 'password': secret})
    check(resumed['code'] == 0, 'expired bucket allows login again')
    concurrent_ip = '198.51.100.77'
    code = 'require "/var/www/html/inc/login-throttle.php"; echo json_encode(login_attempt(' + json.dumps(name) + ',' + json.dumps(concurrent_ip) + '));'
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: json.loads(php(code)), range(12)))
    check(sum(result['allowed'] for result in results) == 8, 'parallel requests cannot exceed the account/IP budget')
    proxy = php('putenv("TRUSTED_PROXIES=10.0.0.0/24,2001:db8::/32");'
        '$_SERVER["REMOTE_ADDR"]="10.0.0.5";$_SERVER["HTTP_X_FORWARDED_FOR"]="1.1.1.1, 203.0.113.5, 10.0.0.6";'
        '$_SERVER["HTTP_X_FORWARDED_PROTO"]="https";'
        'echo json_encode([client_ip(),request_is_https(),trusted_proxy("2001:db8::3"),trusted_proxy("10.0.1.5")]);')
    check(json.loads(proxy) == ['203.0.113.5', True, True, False], 'trusted chain stops at untrusted hop and honors CIDR/HTTPS')
finally:
    if user_id:
        php('db()->query("DELETE FROM messages WHERE user_id=?",[' + str(user_id) + ']);db()->query("DELETE FROM users WHERE id=?",[' + str(user_id) + ']);')
    # No global limiter reset: preserve operator attempts and other visitors.
    keys = [hashlib.sha256(('account:' + name).encode()).hexdigest()]
    if 'info' in globals():
        keys.append(hashlib.sha256(('pair:' + name + ':' + info['data']['visitor_id']).encode()).hexdigest())
    if 'concurrent_ip' in globals():
        keys += [hashlib.sha256(('pair:' + name + ':' + concurrent_ip).encode()).hexdigest(),
                 hashlib.sha256(('ip:' + concurrent_ip).encode()).hexdigest()]
    for key in keys:
        php('db()->query("DELETE FROM auth_rate_limits WHERE bucket=?",[' + json.dumps(key) + ']);')
print('Completed', checks, 'security/message checks; fixtures removed.')
