"""Location, story timeline and authenticated message regression; cleans fixtures."""
import http.cookiejar
import json
import os
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = os.environ.get('TEST_BASE_URL', 'http://localhost:8090')
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
marker = 'location-story-' + uuid.uuid4().hex
checks = 0

def request(path, values=None, headers=None):
    body = urllib.parse.urlencode(values, doseq=True).encode() if values is not None else None
    try:
        response = client.open(urllib.request.Request(BASE + path, body, headers or {}), timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.read().decode()

def api(path, values=None, expected=0, headers=None):
    _, body = request(path, values, headers)
    result = json.loads(body)
    assert result['code'] == expected, result
    return result.get('data')

def check(condition, description):
    global checks
    assert condition, description
    checks += 1
    print('PASS', description)

def php(source):
    return subprocess.run(['docker', 'compose', 'exec', '-T', 'php', 'php'], input='<?php require "/var/www/html/inc/site.php"; ' + source, text=True, capture_output=True, check=True).stdout

article_id = None
try:
    check('请登录后留言~' in request('/message.php')[1], 'anonymous composer asks for login')
    result = api('/api/location_api.php', headers={'X-Forwarded-For': '8.8.8.8'})
    check(result['source'] == 'local' and result['location'] == '', 'private Docker peer cannot be replaced by spoofed forwarding header')
    api('/api/location_api.php', {}, expected=405)
    check(True, 'city endpoint rejects POST')
    api('/api/user_api.php', {'action': 'login', 'username': 'admin', 'password': os.environ['TEST_ADMIN_PASSWORD']})
    token = api('/api/user_api.php?action=info')['csrf_token']
    body = request('/message.php')[1]
    check('placeholder="写下你的祝福，分享此刻的心情~"' in body and 'static/js/location.js' in body, 'authenticated placeholder and city client rendered')
    result = api('/api/message_api.php', {'csrf_token': token, 'content': marker, 'location': '上海 浦东'})
    check(result['ip_location'] == '上海 浦东', 'message response includes selected city')
    rows = api('/api/message_api.php?limit=100')['list']
    check(any(row['content'] == marker and row['ip_location'] == '上海 浦东' for row in rows), 'selected city persists across list reload')
    api('/api/message_api.php', {'csrf_token': token, 'content': marker, 'location[]': ['invalid']}, expected=1)
    check(True, 'city arrays rejected instead of database exception')
    article_id = api('/api/admin_api.php?module=articles&action=create', {'csrf_token': token, 'title': marker, 'content': '<p>Story text</p><img src="/uploads/demo/avatar_boy.jpg">', 'status': 1})['id']
    body = request('/articles.php?q=' + marker)[1]
    check('story-timeline' in body and 'class="story-month"' in body and 'class="story-day"' in body, 'article list groups stories by month and date')
    check('class="story-entry has-cover"' in body and 'src="/uploads/demo/avatar_boy.jpg"' in body, 'first inline photo supplies missing cover')
    check('static/css/fa.min.css' in body, 'article search and reading icons load locally')
    check('没有找到相关故事' in request('/articles.php?q=missing-' + marker)[1], 'empty search preserves useful state')
    check('class="story-body"' in request('/articles.php?id=' + str(article_id))[1], 'story detail preserves rich content')
finally:
    php('db()->query("DELETE FROM messages WHERE content=?",[' + json.dumps(marker) + ']);' + ('db()->query("DELETE FROM articles WHERE id=?",[' + str(article_id) + ']);' if article_id else ''))
print('PASS', checks, 'location/story checks; fixtures removed')
