const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const source = fs.readFileSync('deploy.sh', 'utf8');
const fn = source.slice(source.indexOf('wait_for_mysql() {'), source.indexOf('\nwait_for_mysql ||'));
assert.ok(fn.includes('--protocol=TCP -h127.0.0.1'));
for (const success of [true, false]) {
    const script = `set -Eeuo pipefail
${fn}
attempts=0
dc() {
    [[ "$*" == *'--protocol=TCP -h127.0.0.1'* ]] || exit 55
    attempts=$((attempts + 1))
    ${success ? '[[ $attempts -ge 3 ]]' : 'return 1'}
}
sleep() { :; }
if wait_for_mysql; then result=ready; else result=timeout; fi
printf '%s %s' "$result" "$attempts"
`;
    const result = spawnSync('bash', ['-c', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, success ? 'ready 3' : 'timeout 90');
}
const compose = fs.readFileSync('compose.production.yml', 'utf8');
assert.ok(compose.includes("mysql --protocol=TCP -h127.0.0.1 -uroot -Nse 'SELECT 1'"));
console.log('PASS TCP readiness retries, timeout, and authenticated production healthcheck');
