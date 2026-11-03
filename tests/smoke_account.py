"""Local user-center regression, with isolated users and automatic fixture cleanup."""
import http.cookiejar
import json
import os
import subprocess
import urllib.parse
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get('TEST_BASE_URL', 'http://localhost:8090').rstrip('/')
marker = 'acct_' + uuid.uuid4().hex[:16]
password = uuid.uuid4().hex
checks = 0
ids = []


def php(code):
    result = subprocess.run(['docker', 'compose', 'exec', '-T', 'php', 'php'],
                            input='<?php require "/var/www/html/inc/site.php";\n' + code,
                            text=True, capture_output=True, check=True)
    return result.stdout


class Client:
    def __init__(self):
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.token = ''

    def api(self, endpoint, action='', values=None, expected=0):
        body = dict(values, csrf_token=self.token) if values is not None else None
        data = urllib.parse.urlencode(body).encode() if body is not None else None
        with self.http.open(BASE + '/api/' + endpoint + '_api.php?action=' + action, data, timeout=20) as response:
            result = json.load(response)
        assert result['code'] == expected, (endpoint, action, result)
        return result.get('data')

    def login(self, username, secret):
        self.api('user', 'login', {'username': username, 'password': secret})
        self.token = self.api('user', 'info')['csrf_token']


def check(condition, label):
    global checks
    assert condition, label
    checks += 1
    print('PASS', label)


try:
    for suffix in ['a', 'b', 'c']:
        name = marker + suffix
        ids.append(int(php('$id=db()->insert("users",["username"=>' + json.dumps(name) +
            ',"nickname"=>' + json.dumps(name) + ',"role"=>"user","password_hash"=>password_hash(' +
            json.dumps(password) + ',PASSWORD_DEFAULT)]); echo $id;')))
    a, b, c = Client(), Client(), Client()
    a.login(marker + 'a', password)
    b.login(marker + 'b', password)
    c.login(marker + 'c', password)
    check(not a.api('user', 'info')['is_admin'], 'normal user remains non-admin')
    online = a.api('chat', 'heartbeat')
    check(online['onlineUsers'] >= 1 and online['online'] == online['onlineUsers'] + online['onlineGuests'],
          'heartbeat classifies authenticated users correctly')
    for path in ['/admin/', '/admin/account.php', '/admin/my_messages.php', '/admin/private_messages.php']:
        with a.http.open(BASE + path, timeout=20) as response:
            html = response.read().decode()
            check('/admin/login.php' not in response.url and 'Fatal error' not in html and '个人中心' in html,
                  path + ' accessible to normal user')
    a.api('admin', 'stats&module=dashboard', expected=403)
    check(True, 'admin API stays protected')
    try:
        response = a.http.open(BASE + '/admin/album.php', timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        check(response.status == 403, 'normal user cannot access album administration')
    values = {'nickname': 'Account Smoke', 'birthday': '2000-02-29', 'bio': '<b>literal bio</b>', 'avatar': '/uploads/demo/avatar_boy.jpg'}
    a.api('account', 'save', values)
    profile = a.api('account', 'profile')
    check(all(profile[key] == value for key, value in values.items()), 'profile persists nickname, birthday, bio and avatar')
    check(a.api('user', 'info')['nickname'] == values['nickname'], 'frontend identity refreshes after profile save')
    card = a.api('user_card', 'get_card&user_id=' + str(ids[0]))
    check(card['bio'] == values['bio'] and card['birthday'] == values['birthday'], 'public user card reflects profile')
    a.api('account', 'save', dict(values, birthday='2026-02-31'), expected=1)
    a.api('account', 'save', dict(values, avatar='javascript:alert(1)'), expected=1)
    check(a.api('account', 'profile')['birthday'] == values['birthday'], 'invalid profile rejected without mutation')
    own = a.api('message', '', {'content': marker + '-own'})['id']
    other = b.api('message', '', {'content': marker + '-other'})['id']
    check([row['id'] for row in a.api('account', 'messages')['list']] == [own], 'my messages excludes other users')
    a.api('account', 'delete_message', {'id': other}, expected=404)
    a.api('account', 'delete_message', {'id': own})
    check(a.api('account', 'messages')['total'] == 0, 'only owned messages can be deleted')
    sent = a.api('private_msg', 'send', {'to_id': ids[1], 'content': marker})['id']
    check(b.api('private_msg', 'unread')['unread'] == 1, 'normal users receive unread counts')
    conv = b.api('private_msg', 'conversations')['list']
    check(len(conv) == 1 and conv[0]['peer_id'] == ids[0] and conv[0]['unread'] == 1, 'conversation list shows only own counterpart')
    history = b.api('private_msg', 'history&peer_id=' + str(ids[0]))['list']
    check(len(history) == 1 and history[0]['id'] == sent and not history[0]['is_me'], 'private history retains sender ownership')
    check(c.api('private_msg', 'conversations')['list'] == [] and c.api('private_msg', 'history&peer_id=' + str(ids[0]))['list'] == [], 'third user cannot read another conversation')
    b.api('private_msg', 'read', {'peer_id': ids[0]})
    check(b.api('private_msg', 'unread')['unread'] == 0, 'reading conversation clears only recipient unread count')
    request = urllib.request.Request(BASE + '/api/account_api.php?action=save', urllib.parse.urlencode(values).encode())
    with a.http.open(request) as response:
        check(json.load(response)['code'] == 403, 'profile mutations require CSRF')
    second = Client()
    second.login(marker + 'a', password)
    new_password = ' ' + uuid.uuid4().hex + ' '
    a.api('account', 'password', {'old': password, 'new': new_password, 'confirm': new_password})
    check(not a.api('user', 'info')['logged_in'] and not second.api('user', 'info')['logged_in'], 'password change invalidates both active sessions')
    a.login(marker + 'a', new_password)
    check(a.api('user', 'info')['logged_in'], 'password whitespace survives login without trimming')
    php('db()->delete("users","id=:id",["id"=>' + str(ids[2]) + ']);')
    check(not c.api('user', 'info')['logged_in'], 'deleted user session is rejected')
finally:
    if ids:
        joined = ','.join(map(str, ids))
        php('db()->query("DELETE FROM private_msgs WHERE from_id IN (' + joined + ') OR to_id IN (' + joined + ')");'
            'db()->query("DELETE FROM messages WHERE user_id IN (' + joined + ')");'
            'db()->query("DELETE FROM users WHERE id IN (' + joined + ')");')
print('Completed', checks, 'account checks; isolated fixtures removed.')
