import { teamSchedule, playerSchedule } from '../../../lib/espn';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const p = new URL(req.url).searchParams, sport = p.get('sport'), league = p.get('league'), id = p.get('id');
  if (!['foot', 'basket', 'tennis'].includes(sport) || !/^[\w.]+$/.test(league || '') || !/^\d+$/.test(id || '')) return Response.json({ error: 'paramètres invalides' }, { status: 400 });
  try { return Response.json(await (sport === 'tennis' ? playerSchedule(league, id) : teamSchedule(sport, league, id)), { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }); }
  catch (e) { return Response.json({ error: e.message }, { status: 502 }); }
}
