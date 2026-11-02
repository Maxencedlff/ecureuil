// POST /api/login { code } -> pose le cookie de session si le code est bon.
import { createToken, safeEqual, sessionCookie } from '../lib/auth.js';

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

export async function POST(request) {
  const { ACCESS_CODE, SESSION_SECRET } = process.env;
  if (!ACCESS_CODE || !SESSION_SECRET) return json(500, { error: 'Serveur mal configuré' });
  let code = '';
  try {
    ({ code = '' } = await request.json());
  } catch {
    return json(400, { error: 'Requête invalide' });
  }
  // Insensible à la casse et aux espaces autour : plus simple à taper sur téléphone.
  if (!safeEqual(String(code).trim().toLowerCase(), ACCESS_CODE.trim().toLowerCase())) {
    await new Promise((r) => setTimeout(r, 600)); // ralentit les essais en série
    return json(401, { error: 'Code incorrect' });
  }
  return json(200, { ok: true }, { 'set-cookie': sessionCookie(await createToken(SESSION_SECRET)) });
}
