import { matchDetail, scoreboard } from '../../../lib/espn';
import { f1Detail } from '../../../lib/f1';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const p = new URL(req.url).searchParams, sport = p.get('sport'), league = p.get('league'), id = p.get('id'), date = p.get('date');
  try {
    let r = null;
    // pas de page « summary » ESPN pour le tennis ni la F1 : on part du tableau des scores
    if (sport !== 'tennis' && sport !== 'f1') { try { r = await matchDetail(sport, league, id); } catch {} }
    if (!r?.match) {
      const m = (await scoreboard(sport, /^\d{8}$/.test(date || '') ? date : null)).find(x => x.id === id);
      if (!m) return Response.json({ error: 'Match introuvable' }, { status: 404 });
      r = { match: sport === 'f1' ? await f1Detail(m) : m, stats: r?.stats || [], events: r?.events || [], lineups: r?.lineups || null };
    }
    // séance de F1 terminée : les résultats ne bougent plus → cache plus long
    const age = sport === 'f1' && r.match.state === 'post' ? 'public, s-maxage=300, stale-while-revalidate=600' : 'public, s-maxage=15, stale-while-revalidate=10';
    return Response.json(r, { headers: { 'Cache-Control': age } });
  } catch (e) { return Response.json({ error: e.message }, { status: 502 }); }
}
