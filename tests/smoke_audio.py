"""Local Docker fixtures only; never uploads audio or changes accounts on production."""
import json
import re
import secrets
import subprocess
import urllib.error
import urllib.parse
import urllib.request

BASE = 'http://localhost:8090'
users, sessions, uploads, records = [], [], [], []


def php(code):
    return subprocess.check_output(
        ['docker', 'compose', 'exec', '-T', '--user', 'www-data', 'php', 'php', '-r',
         'require "/var/www/html/inc/site.php";' + code], text=True).strip()


def session(role, permissions):
    name = 'audio_' + secrets.token_hex(8)
    row = dict(username=name, nickname=name, role=role,
               password_hash=php('echo password_hash("audio-fixture", PASSWORD_DEFAULT);'),
               content_permissions=json.dumps(permissions))
    uid = int(php('echo db()->insert("users",json_decode(hex2bin("' + json.dumps(row).encode().hex() + '"),true));'))
    users.append(uid)
    sid, csrf = secrets.token_hex(20), secrets.token_hex(24)
    sid = php('session_id("' + sid + '");session_start();$_SESSION["csrf_token"]="' + csrf + '";'
        '$u=db()->fetch("SELECT * FROM users WHERE id=?",[' + str(uid) + ']);'
        '$_SESSION["auth_hash"]=$u["password_hash"];unset($u["password_hash"]);$_SESSION["admin"]=$u;echo session_id();session_write_close();')
    sessions.append(sid)
    return dict(sid=sid, csrf=csrf)


def request(path, data=None, headers=None):
    try:
        response = urllib.request.urlopen(urllib.request.Request(BASE + path, data, headers or {}), timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read()


def upload(auth, payload, name='sample.mp3', token=None):
    boundary = 'Audio' + secrets.token_hex(12)
    body = ('--' + boundary + '\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n' +
            (token if token is not None else auth.get('csrf', '')) +
            '\r\n--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="' + name +
            '"\r\nContent-Type: audio/mpeg\r\n\r\n').encode() + payload + ('\r\n--' + boundary + '--\r\n').encode()
    status, _, raw = request('/api/upload_audio.php', body, {
        'Cookie': 'PHPSESSID=' + auth.get('sid', ''),
        'Content-Type': 'multipart/form-data; boundary=' + boundary})
    result = json.loads(raw)
    if result['code'] == 0:
        uploads.append(result['data']['url'])
    return status, result


try:
    admin = session('admin', [])
    editor = session('editor', ['playlist'])
    restricted = session('editor', ['moments'])
    visitor = session('user', [])
    audio = subprocess.check_output(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i',
                                    'sine=frequency=440:duration=2', '-f', 'mp3', 'pipe:1'])
    assert json.loads(request('/api/upload_audio.php')[2])['code'] == 405
    for auth in [{}, visitor, restricted]:
        assert upload(auth, audio)[1]['code'] in [401, 403]
    assert upload(admin, audio, token='wrong')[1]['code'] == 403
    for payload in [b'', b'<?php echo "fake mp3"; ?>', b'ID3not really audio']:
        assert upload(admin, payload)[1]['code'] == 1
    assert upload(admin, b'x' * (15 * 1024 * 1024 + 1))[1]['code'] == 1
    assert upload(admin, audio)[1]['code'] == 0
    assert upload(editor, audio, name='untrusted.php')[1]['code'] == 0
    # Exercise the actual PHP upload limit, above the former 5MB ceiling.
    assert upload(admin, audio * (6 * 1024 * 1024 // len(audio) + 1))[1]['code'] == 0
    url = uploads[0]
    assert re.fullmatch(r'/uploads/music/\d{8}/[a-f0-9]{32}\.mp3', url)
    status, headers, body = request(url)
    assert status == 200 and body == audio and headers.get_content_type() == 'audio/mpeg'
    status, headers, body = request(url, headers={'Range': 'bytes=100-199'})
    assert status == 206 and body == audio[100:200] and headers['Content-Range'].startswith('bytes 100-199/')
    values = dict(csrf_token=admin['csrf'], title='Audio upload fixture', url=url, lyrics='')
    _, _, raw = request('/api/admin_api.php?module=playlist&action=create',
                        urllib.parse.urlencode(values).encode(), {'Cookie': 'PHPSESSID=' + admin['sid']})
    result = json.loads(raw)
    assert result['code'] == 0, result
    rid = int(result['data']['id'])
    records.append(rid)
    songs = json.loads(request('/api/miniprogram_api.php?action=playlist')[2])['data']['list']
    assert any(int(song['id']) == rid and song['src'] == url for song in songs)
    page = request('/')[2].decode()
    web_songs = json.loads(re.search(r'var PLAYLIST = (\[.*?\]);', page).group(1))
    assert any(int(song['id']) == rid and song['src'] == url for song in web_songs)
    print('PASS audio upload permissions, CSRF, MIME spoofing, size limits, randomized paths, '
          '6MB upload, MIME/byte-range playback and shared website/mini playlist')
finally:
    for rid in records:
        php('db()->query("DELETE FROM playlist WHERE id=?",[' + str(rid) + ']);')
    for url in uploads:
        php('unlink("/var/www/html' + url + '");')
    for sid in sessions:
        php('session_id("' + sid + '");session_start();session_destroy();')
    for uid in users:
        php('db()->query("DELETE FROM users WHERE id=?",[' + str(uid) + ']);')
