// POST /api/logout -> efface le cookie de session.
import { clearCookie } from '../lib/auth.js';

export function POST() {
  return new Response(null, { status: 204, headers: { 'set-cookie': clearCookie(), 'cache-control': 'no-store' } });
}
