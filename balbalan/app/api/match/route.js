import { matchDetail, scoreboard } from '../../../lib/espn';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const p = new URL(req.url).searchParams, sport = p.get('sport'), league = p.get('league'), id = p.get('id'), date = p.get('date');
  try {
    let r = null;
    if (sport !== 'tennis') { try { r = await matchDetail(sport, league, id); } catch {} }
    if (!r?.match) {
      const m = (await scoreboard(sport, /^\d{8}$/.test(date || '') ? date : null)).find(x => x.id === id);
      if (!m) return Response.json({ error: 'Match introuvable' }, { status: 404 });
      r = { match: m, stats: r?.stats || [], events: r?.events || [], lineups: r?.lineups || null };
    }
    return Response.json(r, { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' } });
  } catch (e) { return Response.json({ error: e.message }, { status: 502 }); }
}
