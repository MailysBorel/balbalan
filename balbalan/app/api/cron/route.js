import { runCron } from '../../../lib/notify';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Appelée toutes les minutes par cron-job.org : https://<ton-site>/api/cron?key=<CRON_SECRET>
// (ou avec l'en-tête « Authorization: Bearer <CRON_SECRET> »)
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  const u = new URL(req.url), auth = req.headers.get('authorization');
  if (!secret || (u.searchParams.get('key') !== secret && auth !== `Bearer ${secret}`))
    return Response.json({ error: 'non autorisé' }, { status: 401 });
  try { return Response.json(await runCron(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
