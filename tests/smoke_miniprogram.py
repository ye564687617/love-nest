"""Public mini-program API checks. Creates and deletes only its own hidden fixture."""
import http.cookiejar
import json
import subprocess
import urllib.parse
import urllib.request

BASE = 'http://localhost:8090'
http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def call(action, values=None, expected=0, **query):
    url = BASE + '/api/miniprogram_api.php?' + urllib.parse.urlencode(dict(action=action, **query))
    data = urllib.parse.urlencode(values).encode() if values is not None else None
    with http.open(url, data, timeout=20) as response:
        result = json.load(response)
    assert result['code'] == expected, result
    return result['data']

def php(code):
    return subprocess.check_output(['docker', 'compose', 'exec', '-T', 'php', 'php', '-r',
        'require "/var/www/html/inc/site.php";' + code], text=True).strip()

session = call('session')
assert session['owner'] is False and session['permissions'] == []
assert session['csrf_token']
home = call('home')
assert set(home['site']) == {'title','subtitle','boy_name','girl_name','boy_avatar','girl_avatar','love_start'}
assert 'password' not in json.dumps(home) and 'boy_birth' not in home['site']
assert all(int(row['status']) == 1 for row in home['moments'])
assert isinstance(call('lovelist')['list'], list)
call('manage', {'module':'lovelist','operation':'create','title':'must not be inserted'}, expected=403)
call('upload', {}, expected=403)
call('login', {'username':'nobody','password':'wrong'}, expected=403)
call('session', {}, expected=405)
public_summary = call('moments')['summary']
hidden_id = int(php('echo db()->insert("moments", ["content"=>"mini-hidden-regression", "images"=>"[]", "status"=>0]);'))
try:
    assert hidden_id not in [int(row['id']) for row in call('home')['moments']]
    for scope in ['public','manage']:
        assert call('moments', scope=scope)['summary'] == public_summary, 'hidden content must not affect visitor statistics'
        page = 1
        while True:
            result = call('moments', scope=scope, page=page)
            assert all(int(row['status']) == 1 and int(row['id']) != hidden_id for row in result['list'])
            if not result['has_more']:
                break
            page += 1
    years = call('moments')['years']
    for year in years:
        rows = call('moments', year=year, month=1)['list']
        assert all(row['created_at'].startswith(str(year)+'-01-') for row in rows)
    call('moments', year=2026, month=13, expected=1)
    call('moments', year=0, month=1, expected=1)
    public_ids = json.loads(php('require "/var/www/html/inc/miniprogram.php"; echo json_encode(mini_config()["public_countdown_ids"]);'))
    assert all(int(row['id']) in public_ids for row in call('countdowns')['list'])
finally:
    php('db()->delete("moments", "id=:id", ["id"=>' + str(hidden_id) + ']);')
print('PASS public content, session bootstrap, owner-only write/upload, method checks, hidden-record filtering and calendar privacy')
