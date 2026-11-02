import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createToken, verifyToken, safeEqual, readCookie, COOKIE } from '../lib/auth.js';
import middleware, { isPublic } from '../middleware.js';
import { POST as login } from '../api/login.js';

// Valeurs de test uniquement (le vrai code est dans les variables Vercel).
const SECRET = 'secret-de-test-pas-le-vrai';
process.env.SESSION_SECRET = SECRET;
process.env.ACCESS_CODE = 'code-bidon';

test('jeton : valide, falsifié, expiré, autre secret', async () => {
  const t = await createToken(SECRET);
  assert.equal(await verifyToken(t, SECRET), true);
  assert.equal(await verifyToken(t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), SECRET), false);
  assert.equal(await verifyToken(t, 'autre'), false);
  assert.equal(await verifyToken(t, SECRET, Date.now() + 400 * 86400 * 1000), false);
  assert.equal(await verifyToken('v1.9999999999.x', SECRET), false);
  assert.equal(await verifyToken(null, SECRET), false);
});

test('safeEqual et readCookie', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(readCookie(`a=1; ${COOKIE}=v1.2.x=; b=2`, COOKIE), 'v1.2.x=');
  assert.equal(readCookie('', COOKIE), null);
});

const req = (path, { cookie, accept = 'text/html' } = {}) =>
  new Request(`https://exemple.test${path}`, { headers: { accept, ...(cookie ? { cookie } : {}) } });

test('middleware : sans session, page -> /login, fichier -> 401', async () => {
  const page = await middleware(req('/'));
  assert.equal(page.status, 302);
  assert.equal(new URL(page.headers.get('location')).pathname, '/login');
  assert.equal((await middleware(req('/js/app.js', { accept: '*/*' }))).status, 401);
});

test('middleware : pages publiques et session valide passent', async () => {
  assert.equal(await middleware(req('/login')), undefined);
  assert.equal(isPublic('/icons/icon-192.png'), true);
  assert.equal(isPublic('/js/app.js'), false);
  const cookie = `${COOKIE}=${await createToken(SECRET)}`;
  assert.equal(await middleware(req('/', { cookie })), undefined);
});

const post = (body) => new Request('https://exemple.test/api/login', { method: 'POST', body, headers: { 'content-type': 'application/json' } });

test('login : bon code (casse et espaces tolérés) -> cookie ; mauvais -> 401', async () => {
  const ok = await login(post(JSON.stringify({ code: '  Code-Bidon ' })));
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(await verifyToken(readCookie(cookie.split(';')[0], COOKIE), SECRET), true);
  assert.equal((await login(post(JSON.stringify({ code: 'faux' })))).status, 401);
  assert.equal((await login(post('pas du json'))).status, 400);
});
