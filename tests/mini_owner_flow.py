"""Isolated local fixtures; restores the exact previous policy in finally."""
import json
import base64
import secrets
import subprocess
import urllib.parse
import urllib.request

BASE = 'http://localhost:8090'
prefix = 'mini_' + secrets.token_hex(5)
users, records, sessions, uploads = [], [], [], []

def php(code):
    return subprocess.check_output(['docker','compose','exec','-T','--user','www-data','php','php','-r',
        'require "/var/www/html/inc/site.php";' + code], text=True).strip()

def call(action, data=None, auth=None, module=None, expected=0):
    endpoint = 'admin_api' if module else 'miniprogram_api'
    query = dict(action=action)
    if module:
        query['module'] = module
    headers = {'Cookie': 'PHPSESSID=' + auth['sid']} if auth else {}
    if data is not None:
        data = dict(data)
        if auth:
            data.setdefault('csrf_token', auth['csrf'])
    request = urllib.request.Request(BASE+'/api/'+endpoint+'.php?'+urllib.parse.urlencode(query),
        urllib.parse.urlencode(data).encode() if data is not None else None, headers)
    with urllib.request.urlopen(request, timeout=15) as response:
        result = json.load(response)
        cookies = response.headers.get_all('Set-Cookie', [])
    if auth:
        for cookie in cookies:
            if cookie.startswith('PHPSESSID='):
                auth['sid'] = cookie.split(';')[0].split('=',1)[1]
    assert result['code'] == expected, (action, result)
    return result['data']

def make_user(role, permissions=None):
    name = prefix + '_' + str(len(users))
    row = {'username':name,'nickname':name,'password_hash':php('echo password_hash("fixture-password", PASSWORD_DEFAULT);'),'role':role,'content_permissions':json.dumps(permissions) if permissions is not None else None}
    raw = json.dumps(row).encode().hex()
    uid = int(php('echo db()->insert("users", json_decode(hex2bin("'+raw+'"), true));'))
    users.append(uid)
    return uid, name

def make_session(uid=None):
    sid, csrf = secrets.token_hex(20), secrets.token_hex(32)
    setup = 'session_id("'+sid+'"); session_start(); $_SESSION["csrf_token"]="'+csrf+'"; $_SESSION["captcha_login"]="TEST";'
    if uid:
        setup += '$u=db()->fetch("SELECT * FROM users WHERE id=?", ['+str(uid)+']); $_SESSION["auth_hash"]=$u["password_hash"]; unset($u["password_hash"]); $_SESSION["admin"]=$u;'
    sid = php(setup + 'echo session_id(); session_write_close();')
    sessions.append(sid)
    return dict(sid=sid, csrf=csrf)

def upload(auth, expected=0):
    boundary = 'MiniFixture' + secrets.token_hex(8)
    image = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jbeQAAAAASUVORK5CYII=')
    body = ('--'+boundary+'\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n'+auth['csrf']+'\r\n--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n').encode() + image + ('\r\n--'+boundary+'--\r\n').encode()
    request = urllib.request.Request(BASE+'/api/miniprogram_api.php?action=upload', body,
        {'Cookie':'PHPSESSID='+auth['sid'], 'Content-Type':'multipart/form-data; boundary='+boundary})
    with urllib.request.urlopen(request, timeout=15) as response:
        result = json.load(response)
    assert result['code'] == expected, result
    if expected == 0:
        url = result['data']['url']
        assert url.startswith('/uploads/user/') and url.endswith('.png')
        uploads.append(url)
        return url

old = php('echo json_encode(db()->fetch("SELECT v FROM site_config WHERE k=?", ["mini_policy"]));')
try:
    admin_id, _ = make_user('admin')
    owner_id, owner_name = make_user('editor', ['moments','lovelist','countdowns'])
    outsider_id, _ = make_user('editor')
    restricted_id, _ = make_user('editor', ['lovelist'])
    admin, owner, outsider, restricted = map(make_session, [admin_id,owner_id,outsider_id,restricted_id])
    visitor = make_session()
    call('set', dict(owner_ids=json.dumps([owner_id,restricted_id]),public_countdown_ids='[]'), admin, 'miniprogram')
    assert call('session', auth=owner)['owner']
    assert not call('session', auth=outsider)['owner']
    # Couple chat never accepts an arbitrary recipient or returns other threads.
    call('chat', auth=visitor, expected=403)
    call('chat', auth=outsider, expected=403)
    call('chat_send', {'content':'blocked'}, outsider, expected=403)
    call('chat_send', {'content':prefix,'csrf_token':'wrong'}, owner, expected=403)
    call('chat_send', {'content':' '}, owner, expected=1)
    call('chat_send', {'content':'x'*1001}, owner, expected=1)
    call('chat_send', auth=owner, expected=405)
    raw = json.dumps({'from_id':outsider_id,'to_id':owner_id,'from_name':prefix,'content':prefix+'_outside'}).encode().hex()
    foreign_msg = int(php('echo db()->insert("private_msgs", json_decode(hex2bin("'+raw+'"), true));'))
    sent = call('chat_send', {'content':prefix+'_hello','to_id':outsider_id}, owner)['id']
    call('chat_send', {'content':prefix+'_wrong_peer','partner_id':outsider_id}, owner, expected=409)
    call('chat_read', {'through':sent,'partner_id':outsider_id}, restricted, expected=409)
    assert int(php('echo db()->fetchColumn("SELECT to_id FROM private_msgs WHERE id=?", ['+str(sent)+']);')) == restricted_id
    peer_rows = call('chat', auth=restricted)['list']
    assert any(row['id'] == sent and not row['is_me'] for row in peer_rows)
    assert not any(row['id'] == foreign_msg for row in call('chat', auth=owner)['list'])
    call('chat_read', {'through':sent,'csrf_token':'bad'}, restricted, expected=403)
    call('chat_read', {'through':sent}, restricted)
    assert int(php('echo db()->fetchColumn("SELECT is_read FROM private_msgs WHERE id=?", ['+str(sent)+']);')) == 1
    # Seed enough own fixtures to exercise both backward and catch-up pagination.
    raw = json.dumps({'from_id':owner_id,'to_id':restricted_id,'from_name':prefix,'content':prefix+'_page'}).encode().hex()
    php('for($i=0;$i<65;$i++) db()->insert("private_msgs",json_decode(hex2bin("'+raw+'"),true));')
    latest = call('chat', auth=owner)
    assert len(latest['list']) == 30 and latest['has_more']
    def chat_query(query):
        request = urllib.request.Request(BASE+'/api/miniprogram_api.php?'+urllib.parse.urlencode(dict(action='chat',**query)), headers={'Cookie':'PHPSESSID='+owner['sid']})
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.load(response)
    earlier = chat_query({'before':latest['list'][0]['id']})['data']
    assert len(earlier['list']) == 30 and earlier['has_more']
    assert earlier['list'][-1]['id'] < latest['list'][0]['id']
    forward = chat_query({'after':sent})['data']
    assert len(forward['list']) == 30 and forward['has_more']
    assert forward['list'][0]['id'] > sent
    assert [row['id'] for row in forward['list']] == sorted(row['id'] for row in forward['list'])
    assert chat_query({'after':sent,'before':sent})['code'] == 1
    assert 'list' in call('playlist')
    call('set', dict(owner_ids=json.dumps([owner_id,restricted_id,outsider_id]),public_countdown_ids='[]'), admin, 'miniprogram', 1)
    call('get', auth=owner, module='miniprogram', expected=403)
    login = make_session()
    call('login', dict(username=owner_name,password='fixture-password',captcha='TEST'), login)
    assert call('session', auth=login)['owner']
    sessions.append(login['sid'])
    call('manage', dict(module='lovelist',operation='create',title=prefix,csrf_token='wrong'), owner, expected=403)
    call('manage', dict(module='lovelist',operation='create',title=prefix), outsider, expected=403)
    def create(module, **data):
        result = call('manage', dict(module=module,operation='create',**data), owner)
        records.append((module,int(result['id'])))
        return int(result['id'])
    mid = create('moments', content=prefix,images='[]')
    assert not any(int(row['id']) == mid for row in call('moments')['list'])
    # Explicit manage scope is required to read hidden content.
    with urllib.request.urlopen(urllib.request.Request(BASE+'/api/miniprogram_api.php?action=moments&scope=manage', headers={'Cookie':'PHPSESSID='+owner['sid']})) as response:
        assert any(int(row['id']) == mid for row in json.load(response)['data']['list'])
    call('manage', dict(module='moments',operation='create',content=prefix,images='[]'), restricted, expected=403)
    upload(restricted, 403)
    image_url = upload(owner)
    call('manage', dict(module='moments',operation='update',id=mid,content=prefix,images=json.dumps([image_url]),status=0), owner)
    call('manage', dict(module='moments',operation='update',id=mid,content=prefix,images='[]',status=1), owner)
    assert any(int(row['id']) == mid for row in call('moments')['list'])
    lid = create('lovelist', title=prefix,done=0)
    call('manage', dict(module='lovelist',operation='update',id=lid,title=prefix,done=1), owner)
    assert any(int(row['id']) == lid and int(row['done']) == 1 for row in call('lovelist')['list'])
    did = create('countdowns',title=prefix,kind='birthday',target_date='2000-02-29',festival_key='')
    assert not any(int(row['id']) == did for row in call('countdowns')['list'])
    def day_row(rid):
        return next(row for row in call('list', auth=admin, module='countdowns')['list'] if int(row['id']) == rid)
    assert day_row(did)['birthday_calendar'] == 'solar'
    lunar_id = create('countdowns',title=prefix+'_lunar',kind='birthday',target_date='2001-10-30',birthday_calendar='lunar')
    assert day_row(lunar_id)['birthday_calendar'] == 'lunar'
    call('manage', dict(module='countdowns',operation='update',id=lunar_id,title=prefix+'_edited',kind='birthday',target_date='2001-10-30'), owner)
    assert day_row(lunar_id)['birthday_calendar'] == 'lunar', 'legacy clients preserve the saved calendar'
    call('manage', dict(module='countdowns',operation='update',id=lunar_id,title=prefix,kind='birthday',target_date='2001-10-30',birthday_calendar='invalid'), owner, expected=1)
    assert day_row(lunar_id)['birthday_calendar'] == 'lunar'
    call('manage', dict(module='countdowns',operation='update',id=lunar_id,title=prefix,kind='birthday',target_date='2001-10-30',birthday_calendar='solar'), restricted, expected=403)
    call('manage', dict(module='countdowns',operation='update',id=lunar_id,title=prefix,kind='birthday',target_date='2001-10-30'), visitor, expected=403)
    assert not any(int(row['id']) == lunar_id for row in call('countdowns')['list'])
    assert next(row for row in call('countdowns', auth=owner)['list'] if int(row['id']) == lunar_id)['birthday_calendar'] == 'lunar'
    call('set', dict(owner_ids=json.dumps([owner_id,restricted_id]),public_countdown_ids=json.dumps([lunar_id])), admin, 'miniprogram')
    assert next(row for row in call('countdowns')['list'] if int(row['id']) == lunar_id)['birthday_calendar'] == 'lunar'
    call('manage', dict(module='countdowns',operation='update',id=lunar_id,title=prefix,kind='anniversary',target_date='2001-10-30'), owner)
    assert day_row(lunar_id)['birthday_calendar'] == 'solar'
    call('set', dict(owner_ids=json.dumps([owner_id,restricted_id]),public_countdown_ids=json.dumps([did])), admin, 'miniprogram')
    assert any(int(row['id']) == did for row in call('countdowns')['list'])
    for table, rid in list(records):
        call('manage', dict(module=table,operation='delete',id=rid), owner)
        records.remove((table,rid))
    lid = create('lovelist',title=prefix+'_revoke',done=0)
    call('set', dict(owner_ids='[]',public_countdown_ids='[]'), admin, 'miniprogram')
    assert not call('session', auth=owner)['owner']
    call('chat', auth=owner, expected=403)
    call('chat_send', {'content':prefix+'_revoked'}, owner, expected=403)
    call('manage', dict(module='lovelist',operation='delete',id=lid), owner, expected=403)
    call('set', dict(owner_ids=json.dumps([owner_id]),public_countdown_ids='[]'), admin, 'miniprogram')
    call('chat', auth=owner, expected=409)
    print('PASS owner login, two-owner policy, CRUD/upload, CSRF, private chat pair isolation, read receipts, pagination, public playlist and revocation')
finally:
    previous = json.loads(old)
    if previous is None:
        php('db()->delete("site_config", "k=:k", ["k"=>"mini_policy"]);')
    else:
        php('site_config_set("mini_policy", hex2bin("'+previous['v'].encode().hex()+'"));')
    for table, rid in records:
        php('db()->delete("'+table+'", "id=:id", ["id"=>'+str(rid)+']);')
    for uid in users:
        php('db()->delete("private_msgs", "from_id=:uid OR to_id=:uid", ["uid"=>'+str(uid)+']);')
        php('db()->delete("users", "id=:id", ["id"=>'+str(uid)+']);')
    for url in uploads:
        php('unlink("/var/www/html" . hex2bin("'+url.encode().hex()+'"));')
    for sid in set(sessions):
        php('session_id("'+sid+'"); session_start(); session_destroy();')
