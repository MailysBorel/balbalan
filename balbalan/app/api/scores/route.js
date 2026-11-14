import { scoreboard } from '../../../lib/espn';
export const dynamic = 'force-dynamic';
// Le cache CDN (s-maxage) fait qu'un seul appel ESPN est fait toutes les 20 s, quel que soit le nombre d'utilisateurs.
export async function GET(req) {
  const q = new URL(req.url).searchParams, sport = q.get('sport') || 'foot', date = q.get('date');
  try {
    const matches = await scoreboard(sport, /^\d{8}$/.test(date || '') ? date : null);
    return Response.json({ updated: Date.now(), matches }, { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' } });
  } catch (e) { return Response.json({ error: e.message }, { status: 502 }); }
}
