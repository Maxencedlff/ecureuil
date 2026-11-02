// Session signée (HMAC-SHA256) partagée par le middleware et l'API de connexion.
// Le code d'entrée et le secret de signature vivent dans les variables d'environnement Vercel,
// jamais dans le dépôt.
export const COOKIE = 'ecureuil_session';
export const SESSION_DAYS = 365;

const enc = new TextEncoder();

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Comparaison en temps constant (ne révèle pas, par sa durée, où les chaînes diffèrent). */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Jeton "v1.<expiration en secondes>.<signature>". */
export async function createToken(secret, now = Date.now()) {
  const exp = Math.floor(now / 1000) + SESSION_DAYS * 86400;
  return `v1.${exp}.${await hmac(secret, `v1.${exp}`)}`;
}

export async function verifyToken(token, secret, now = Date.now()) {
  if (!token || !secret) return false;
  const [v, exp, sig] = token.split('.');
  if (v !== 'v1' || !/^\d+$/.test(exp ?? '') || Number(exp) * 1000 < now) return false;
  return safeEqual(sig, await hmac(secret, `v1.${exp}`));
}

export function readCookie(header, name) {
  for (const part of (header || '').split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

export const sessionCookie = (token) =>
  `${COOKIE}=${token}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
export const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
