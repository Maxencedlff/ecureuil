// Verrou de l'appli : sans cookie de session valide, on renvoie vers /login.
// (Vercel Routing Middleware : s'exécute avant les fichiers statiques.)
import { COOKIE, readCookie, verifyToken } from './lib/auth.js';

const PUBLIC = new Set(['/login', '/login.html', '/js/login.js', '/styles.css', '/manifest.webmanifest', '/api/login', '/favicon.ico']);

export const isPublic = (path) => PUBLIC.has(path) || path.startsWith('/icons/');

export default async function middleware(request) {
  const url = new URL(request.url);
  if (isPublic(url.pathname)) return undefined;
  const token = readCookie(request.headers.get('cookie'), COOKIE);
  if (await verifyToken(token, process.env.SESSION_SECRET)) return undefined; // on laisse passer
  const wantsPage = request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html');
  if (wantsPage) return Response.redirect(new URL('/login', url), 302);
  return new Response('Non autorisé', { status: 401, headers: { 'cache-control': 'no-store' } });
}
