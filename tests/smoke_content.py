"""Content workbench regression. Fixtures are removed in finally."""
import http.cookiejar
import json
import os
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

BASE = os.environ.get('TEST_BASE_URL', 'http://localhost:8090').rstrip('/')
marker = 'content-' + uuid.uuid4().hex[:16]
checks = 0


def php(code):
    result = subprocess.run(['docker', 'compose', 'exec', '-T', 'php', 'php'], input='<?php require "/var/www/html/inc/site.php"; ' + code, text=True, capture_output=True, check=True)
    return result.stdout


class Client:
    def __init__(self):
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.token = ''

    def call(self, path, data=None, expected=0):
        body = urllib.parse.urlencode(data, doseq=True).encode() if data is not None else None
        try:
            response = self.http.open(BASE + path, body, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            result = json.load(response)
        assert result['code'] == expected, (path, result)
        return result.get('data')

    def login(self, username, password):
        self.call('/api/user_api.php', {'action': 'login', 'username': username, 'password': password})
        self.token = self.call('/api/user_api.php?action=info')['csrf_token']

    def admin(self, module, action, expected=0, **values):
        return self.call('/api/admin_api.php?' + urllib.parse.urlencode({'module': module, 'action': action}), dict(values, csrf_token=self.token), expected)

    def page(self, path):
        try:
            response = self.http.open(BASE + path, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, response.read().decode()


def check(value, label):
    global checks
    assert value, label
    checks += 1
    print('PASS', label)


admin, editor, normal = Client(), Client(), Client()
ids, albums, article_id, moment_id, checklist_id = [], [], None, None, None
uploaded_path = None
try:
    admin.login('admin', os.environ['TEST_ADMIN_PASSWORD'])
    for suffix, role in [('e', 'editor'), ('u', 'user')]:
        code = '$id=db()->insert("users",["username"=>' + json.dumps(marker + suffix) + ',"nickname"=>"Content test","password_hash"=>password_hash("Content-test-123",PASSWORD_DEFAULT),"role"=>' + json.dumps(role) + ']); echo $id;'
        ids.append(int(php(code)))
    editor.login(marker + 'e', 'Content-test-123')
    normal.login(marker + 'u', 'Content-test-123')
    check(editor.call('/api/user_api.php?action=info')['can_manage_content'], 'editor management capability advertised')
    for module in ['users', 'config', 'reports']:
        editor.admin(module, 'list', expected=403)
        normal.admin(module, 'list', expected=403)
    check(True, 'editor and normal user cannot access privileged APIs')
    check('后台管理' in editor.page('/admin/')[1] and '用户与权限' not in editor.page('/admin/')[1], 'editor dashboard and menus match role')
    check(editor.page('/admin/config.php')[0] == 403, 'editor cannot open settings page directly')
    normal.admin('articles', 'list', expected=403)
    check(True, 'ordinary user cannot manage content')
    admin.admin('users', 'role', id=1, role='user', expected=1)
    check(True, 'administrator self-demotion denied')
    boundary = 'ContentUpload' + uuid.uuid4().hex
    image = Path('html/uploads/demo/avatar_boy.jpg').read_bytes() + b'\x00' * (3 * 1024 * 1024)
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n{editor.token}\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="content.jpg"\r\nContent-Type: image/jpeg\r\n\r\n').encode() + image + f'\r\n--{boundary}--\r\n'.encode()
    upload = urllib.request.Request(BASE + '/api/upload_image.php', body, {'Content-Type': 'multipart/form-data; boundary=' + boundary})
    with editor.http.open(upload, timeout=30) as response:
        result = json.load(response)
    check(result['code'] == 0, 'editor image upload larger than 2MB succeeds with Docker limits')
    uploaded_path = result['data']['url']
    payload = '<h2>Heading</h2><p><strong>Story</strong><img src="/uploads/demo/avatar_boy.jpg" onerror="alert(1)"></p><script>alert(2)</script><a href="javascript:alert(3)">bad</a><iframe src="https://example.com"></iframe><svg onload="alert(4)"></svg>'
    payload += '<p><img src="' + uploaded_path + '"></p>'
    article_id = editor.admin('articles', 'create', title=marker, content=payload, excerpt='Original excerpt', status=0)['id']
    stored = editor.admin('articles', 'get', id=article_id)
    check(all(bad not in stored['content'] for bad in ['<script', 'onerror', 'javascript:', '<iframe', '<svg']) and '<strong>Story</strong>' in stored['content'], 'article HTML sanitization preserves safe rich text')
    check(normal.page('/articles.php?id=' + str(article_id))[0] == 404, 'draft not accessible publicly even by id')
    editor.admin('articles', 'update', id=article_id, title=marker, content=stored['content'])
    check(editor.admin('articles', 'get', id=article_id)['excerpt'] == 'Original excerpt', 'legacy updates preserve article metadata')
    editor.admin('articles', 'toggle', id=article_id)
    status, body = normal.page('/articles.php?id=' + str(article_id))
    check(status == 200 and '<strong>Story</strong>' in body and uploaded_path in body and '<div class="story-body">' in body, 'published article renders sanitized rich text and local uploads')
    views = editor.admin('articles', 'get', id=article_id)['views']
    normal.page('/articles.php?id=' + str(article_id))
    check(editor.admin('articles', 'get', id=article_id)['views'] == views, 'refresh does not inflate article reads within a session')
    check(marker in normal.page('/articles.php?q=' + marker)[1], 'public article search returns real content')
    for number in range(2):
        albums.append(editor.admin('albums', 'create', title=marker + str(number))['id'])
    photo_id = editor.admin('photos', 'add', album_id=albums[0], src='/uploads/demo/avatar_boy.jpg')['id']
    check(next(a for a in editor.admin('albums', 'list')['list'] if a['id'] == albums[0])['preview'] != '', 'album cover falls back to actual photo')
    editor.admin('photos', 'move', album_id=albums[1], **{'ids[]': [photo_id]})
    check(editor.admin('photos', 'list', album_id=albums[1])['list'][0]['id'] == photo_id, 'batch move keeps original photo identity')
    editor.admin('photos', 'add', album_id=albums[0], src='', expected=1)
    editor.admin('photos', 'add', album_id=0, src='/uploads/demo/avatar_boy.jpg', expected=404)
    editor.admin('photos', 'move', album_id=0, **{'ids[]': [photo_id]}, expected=404)
    check(True, 'empty photos and missing target albums rejected')
    moment_id = editor.admin('moments', 'create', content=marker, images='[]', created_at='2025-05-20T13:14', status=0, is_top=1)['id']
    moment = next(row for row in editor.admin('moments', 'list')['list'] if row['id'] == moment_id)
    check(moment['created_at'] == '2025-05-20 13:14:00' and moment['status'] == 0 and moment['is_top'] == 1, 'moment date visibility and pin persist together')
    checklist_id = editor.admin('lovelist', 'create', title=marker, done=0, moment_id=moment_id)['id']
    admin.admin('users', 'role', id=ids[0], role='editor', permissions=json.dumps(['articles', 'lovelist']))
    editor.admin('articles', 'list')
    editor.admin('lovelist', 'list')
    check(True, 'restricted editor retains assigned content modules')
    for module in ['albums', 'photos', 'moments', 'messages', 'countdowns', 'playlist']:
        editor.admin(module, 'list', expected=403)
        editor.admin(module, 'delete', id=0, expected=403)
    check(True, 'unassigned modules reject reads and mutations in existing session')
    for route in ['album', 'moments', 'messages', 'countdowns', 'playlist']:
        check(editor.page('/admin/' + route + '.php')[0] == 403, 'restricted editor direct page denied: ' + route)
    dashboard = editor.admin('dashboard', 'stats')
    check(dashboard['photos'] is None and dashboard['messages'] is None and dashboard['recent_messages'] == [] and dashboard['articles'] is not None, 'dashboard does not leak unassigned module data')
    body = editor.page('/admin/')[1]
    check('href="/admin/album.php"' not in body and 'href="/admin/articles.php"' in body and 'id="msgList"' not in body, 'dashboard shortcuts and navigation match assigned permissions')
    editor.admin('lovelist', 'create', title=marker, moment_id=moment_id, expected=403)
    check(True, 'checklist association cannot bypass moment permissions')
    editor.admin('lovelist', 'update', id=checklist_id, title=marker, done=1)
    item = next(row for row in editor.admin('lovelist', 'list')['list'] if row['id'] == checklist_id)
    check(item['done'] == 1 and item['moment_id'] == moment_id, 'restricted checklist editor preserves existing moment association')
    editor.admin('users', 'role', id=ids[0], role='admin', expected=403)
    check(True, 'restricted editor cannot grant itself administrator access')
    admin.admin('users', 'role', id=ids[0], role='editor', permissions='["config"]', expected=1)
    admin.admin('users', 'role', id=ids[0], role='editor', permissions='{"articles":true}', expected=1)
    check(editor.admin('articles', 'list') is not None, 'invalid permission payload rejected without changing access')
    admin.admin('users', 'role', id=ids[0], role='editor')
    editor.admin('moments', 'list', expected=403)
    check(True, 'legacy same-role updates preserve explicit module restrictions')
    admin.admin('users', 'role', id=ids[0], role='editor', permissions='[]')
    editor.admin('dashboard', 'stats', expected=403)
    check(not editor.call('/api/user_api.php?action=info')['can_manage_content'] and '个人中心' in editor.page('/admin/')[1], 'editor with no modules falls back to personal dashboard')
    admin.admin('users', 'role', id=ids[0], role='editor', permissions=json.dumps(['albums', 'moments', 'articles', 'messages', 'lovelist', 'countdowns', 'playlist']))
    editor.admin('moments', 'list')
    check(True, 'regranting modules takes effect without logging in again')
    admin.admin('users', 'role', id=ids[0], role='user')
    editor.admin('articles', 'list', expected=403)
    check(not editor.call('/api/user_api.php?action=info')['can_manage_content'], 'role revocation takes effect in an existing session')
    for route in ['/admin/album.php', '/admin/moments.php', '/admin/articles.php', '/admin/users.php', '/admin/lovelist.php', '/admin/countdowns.php', '/admin/playlist.php', '/admin/messages.php', '/admin/reports.php', '/admin/config.php']:
        status, body = admin.page(route)
        check(status == 200 and 'Fatal error' not in body, route + ' loads')
finally:
    if checklist_id:
        admin.admin('lovelist', 'delete', id=checklist_id)
    if article_id:
        admin.admin('articles', 'delete', id=article_id)
    if moment_id:
        admin.admin('moments', 'delete', id=moment_id)
    for album_id in albums:
        admin.admin('albums', 'delete', id=album_id)
    if ids:
        php('db()->query("DELETE FROM users WHERE id IN (' + ','.join(map(str, ids)) + ')");')
    if uploaded_path:
        Path('html' + uploaded_path).unlink(missing_ok=True)
print(f'{checks} content workbench checks passed')
