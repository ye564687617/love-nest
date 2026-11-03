"""Local Docker regression: TEST_ADMIN_PASSWORD=... python3 tests/smoke_interactions.py."""
import concurrent.futures
import http.cookiejar
import json
import os
import re
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

BASE = os.environ.get('TEST_BASE_URL', 'http://localhost:8090').rstrip('/')
jar = http.cookiejar.CookieJar()
http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
marker = 'smoke-' + uuid.uuid4().hex
checks = 0


def request(path, data=None, expected=0):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    with http.open(BASE + path, body, timeout=20) as response:
        result = json.load(response)
    assert result['code'] == expected, (path, result)
    return result.get('data')


def check(condition, label):
    global checks
    assert condition, label
    checks += 1
    print('PASS', label)


token = request('/api/user_api.php?action=info')['csrf_token']
request('/api/moment_api.php', {'action': 'comment', 'moment_id': 4, 'content': marker, 'csrf_token': token}, 401)
request('/api/private_msg_api.php?action=history&peer_id=1', expected=401)
check(True, 'guest comment and private-history access denied')
request('/api/user_api.php', {'action': 'login', 'username': os.environ.get('TEST_ADMIN_USERNAME', 'admin'), 'password': os.environ['TEST_ADMIN_PASSWORD']})
token = request('/api/user_api.php?action=info')['csrf_token']


def admin(module, action, **values):
    return request('/api/admin_api.php?' + urllib.parse.urlencode({'module': module, 'action': action}), dict(values, csrf_token=token))


mid = message_id = chat_id = reply_chat_id = checklist_id = None
uploaded_path = None
try:
    boundary = 'smoke' + uuid.uuid4().hex
    image_bytes = Path(__file__).resolve().parents[1].joinpath('html/uploads/demo/avatar_boy.jpg').read_bytes()
    multipart = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n{token}\r\n'
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="smoke.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'
    ).encode() + image_bytes + f'\r\n--{boundary}--\r\n'.encode()
    upload = urllib.request.Request(BASE + '/api/upload_image.php', multipart, {'Content-Type': 'multipart/form-data; boundary=' + boundary})
    with http.open(upload, timeout=20) as response:
        uploaded = json.load(response)
    assert uploaded['code'] == 0, uploaded
    uploaded_path = uploaded['data']['url']
    check(uploaded_path.startswith('/uploads/user/'), 'real image upload succeeds with CSRF')
    mid = admin('moments', 'create', content=marker, location='Smoke City', images='[]')['id']
    check(mid > 0, 'admin moment creation')
    results = []
    def like(_):
        body = urllib.parse.urlencode({'action': 'like', 'moment_id': mid}).encode()
        with urllib.request.urlopen(BASE + '/api/moment_api.php', body, timeout=20) as response:
            return json.load(response)['data']
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(like, range(12)))
    check(all(row == {'likes': 1, 'liked': True} for row in results), '12 concurrent likes count only once')
    cid = request('/api/moment_api.php', {'action': 'comment', 'moment_id': mid, 'content': marker, 'csrf_token': token})['id']
    request('/api/moment_api.php', {'action': 'comment', 'moment_id': mid, 'content': 'reply', 'reply_id': cid, 'csrf_token': token})
    comments = request('/api/moment_api.php?action=comments&moment_id=' + str(mid))
    check(comments['total'] == 2 and comments['comments'][1]['reply_id'] == cid and comments['comments'][1]['reply_nickname'], 'comment reply and identity survive reload')
    request('/api/moment_api.php', {'action': 'comment', 'moment_id': mid, 'img': uploaded_path, 'csrf_token': token})
    comments = request('/api/moment_api.php?action=comments&moment_id=' + str(mid))
    check(comments['comments'][-1]['img'] == uploaded_path and comments['comments'][-1]['content'] == '', 'image-only comment persists')
    checklist_id = admin('lovelist', 'create', title=marker, done=1, moment_id=mid)['id']
    with http.open(BASE + '/list.php', timeout=20) as response:
        checklist_html = response.read().decode()
    check('data-moment-id="' + str(mid) + '"' in checklist_html, 'checklist linked to real moment')
    request('/api/admin_api.php?module=moments&action=delete&id=' + str(mid), expected=405)
    check(True, 'GET mutation blocked')
    request('/api/admin_api.php?module=moments&action=update', {'id': mid}, expected=403)
    check(True, 'CSRF-less mutation blocked')
    message_id = request('/api/message_api.php', {'content': marker, 'img': uploaded_path, 'gift_icon': 'heart', 'gift_name': 'Heart', 'csrf_token': token})['id']
    row = next(row for row in request('/api/message_api.php')['list'] if row['id'] == message_id)
    check(row['gift_icon'] == 'heart' and row['user_id'] > 0 and row['img'] == uploaded_path, 'message image, gift and author persist')
    chat_id = request('/api/chat_api.php', {'action': 'send', 'content': marker, 'image': uploaded_path, 'csrf_token': token})['id']
    reply_chat_id = request('/api/chat_api.php', {'action': 'send', 'content': marker + '-reply', 'reply_id': chat_id, 'csrf_token': token})['id']
    row = next(row for row in request('/api/chat_api.php?limit=100')['list'] if row['id'] == reply_chat_id)
    check(row['reply_id'] == chat_id and row['user_id'] > 0, 'chat reply and ownership persist')
    for page in ['/', '/loveImg.php', '/list.php', '/games.php', '/message.php', '/chat.php', '/admin/', '/admin/album.php', '/admin/moments.php', '/admin/messages.php', '/admin/config.php', '/admin/lovelist.php', '/admin/playlist.php', '/admin/countdowns.php', '/admin/articles.php', '/admin/reports.php']:
        with http.open(BASE + page, timeout=20) as response:
            content = response.read().decode()
        check(not re.search(r'(?:Fatal error|Warning:|Parse error|Uncaught PDOException)', content), page + ' renders without PHP errors')
    request('/api/user_api.php', {'action': 'logout', 'csrf_token': token})
    check(not request('/api/user_api.php?action=info')['is_admin'], 'logout clears identity')
finally:
    request('/api/user_api.php', {'action': 'login', 'username': os.environ.get('TEST_ADMIN_USERNAME', 'admin'), 'password': os.environ['TEST_ADMIN_PASSWORD']})
    token = request('/api/user_api.php?action=info')['csrf_token']
    for chat in [reply_chat_id, chat_id]:
        if chat:
            request('/api/chat_api.php', {'action': 'retract', 'msg_id': chat, 'csrf_token': token})
    if message_id:
        admin('messages', 'delete', id=message_id)
    if checklist_id:
        admin('lovelist', 'delete', id=checklist_id)
    if mid:
        admin('moments', 'delete', id=mid)
    if uploaded_path:
        target = Path(__file__).resolve().parents[1].joinpath('html', uploaded_path.lstrip('/'))
        target.unlink(missing_ok=True)
print('Completed', checks, 'checks; created records removed.')
