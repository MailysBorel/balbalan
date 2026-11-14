import { search } from '../../../lib/espn';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 50);
  if (q.length < 2) return Response.json({ results: [] });
  try { return Response.json({ results: await search(q) }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }); }
  catch (e) { return Response.json({ error: e.message, results: [] }, { status: 502 }); }
}
