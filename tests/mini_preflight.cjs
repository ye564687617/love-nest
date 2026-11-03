// Read-only checks. No credentials, writes, uploads or private records are used.
const {URL} = require('node:url');
const config = require('../miniprogram/config');
const release = process.argv.includes('--release');
const args = process.argv.slice(2).filter(value => value !== '--release');
if (args.length > 1) throw new Error('Usage: node tests/mini_preflight.cjs [base-url] [--release]');
let failures = 0;
function report(ok, message) {
  console.log((ok ? 'PASS ' : 'BLOCK ') + message);
  if (!ok) failures++;
}
async function read(base, action) {
  const response = await fetch(base + '/api/miniprogram_api.php?action=' + action, {signal:AbortSignal.timeout(15000), redirect:'error'});
  if (!response.ok) throw new Error(action + ': HTTP ' + response.status);
  const body = await response.json();
  if (body.code !== 0) throw new Error(action + ': API code ' + body.code);
  return body.data;
}
(async () => {
  let base;
  try { base = args[0] || (release ? config.resolveBaseUrl('release') : config.resolveBaseUrl('develop')); }
  catch (error) { report(false, error.message); process.exitCode = 1; return; }
  const url = new URL(base);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['','/'].includes(url.pathname)) throw new Error('Base URL must be an HTTP(S) origin without credentials');
  base = url.origin;
  const publicHost = !/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/i.test(url.hostname);
  if (release) report(url.protocol === 'https:' && publicHost, 'Release requires a public HTTPS origin');
  console.log('Checking ' + base + ' (read-only visitor requests)');
  const session = await read(base, 'session');
  report(session.owner === false && Array.isArray(session.permissions) && session.permissions.length === 0, 'Anonymous session has no owner privileges');
  const home = await read(base,'home');
  report(Boolean(home.site && home.site.title), 'Home API responds');
  const playlist = await read(base,'playlist');
  report(Array.isArray(playlist.list), 'Playlist API responds');
  const sources = [home.site.boy_avatar,home.site.girl_avatar];
  for (const row of home.moments || []) sources.push(...row.images);
  for (const track of playlist.list || []) sources.push(track.src,track.cover);
  const hosts = new Set([url.host]);
  let insecure = 0;
  for (const source of sources.filter(Boolean)) {
    const media = new URL(source, base + '/');
    hosts.add(media.host);
    if (media.protocol !== 'https:') insecure++;
  }
  if (release) report(insecure === 0, insecure + ' non-HTTPS public media URLs');
  else console.log('INFO ' + insecure + ' HTTP media URLs; check HTTPS and final redirects before release');
  console.log('Domain inventory (not proof of WeChat console configuration): ' + [...hosts].sort().join(', '));
  console.log('INFO Owner selection, platform privacy settings, IDE and real-device playback still require verification');
  if (failures) process.exitCode = 1;
})().catch(error => {console.error('BLOCK ' + error.message); process.exitCode = 1;});
