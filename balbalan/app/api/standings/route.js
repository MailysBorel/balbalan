import { standings } from '../../../lib/espn';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const sport = new URL(req.url).searchParams.get('sport') || 'foot';
  try { return Response.json({ groups: await standings(sport) }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' } }); }
  catch (e) { return Response.json({ error: e.message }, { status: 502 }); }
}
