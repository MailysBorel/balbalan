import { redis, subId, TYPES } from '../../../lib/notify';
export const dynamic = 'force-dynamic';

// GET : clé publique pour s'abonner aux notifications
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  return key ? Response.json({ key }) : Response.json({ error: 'notifications non configurées' }, { status: 503 });
}

// POST { sub, favs, prefs } : enregistre / met à jour un téléphone (appelé à chaque changement de favoris ou de réglages)
export async function POST(req) {
  try {
    const { sub, favs, prefs } = await req.json();
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return Response.json({ error: 'abonnement invalide' }, { status: 400 });
    const clean = {
      sub: { endpoint: String(sub.endpoint), keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } },
      favs: (Array.isArray(favs) ? favs : []).slice(0, 200)
        .filter(f => TYPES[f?.sport] && typeof f.name === 'string').map(f => ({ sport: f.sport, name: f.name.slice(0, 120) })),
      prefs: Object.fromEntries(Object.entries(TYPES).map(([s, ts]) => [s, Object.fromEntries(ts.map(t => [t, prefs?.[s]?.[t] !== false]))])),
      ts: Date.now(),
    };
    await redis().hset('subs', { [subId(clean.sub.endpoint)]: clean });
    return Response.json({ ok: true });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

// DELETE { endpoint } : désactive les notifications de ce téléphone
export async function DELETE(req) {
  try {
    const { endpoint } = await req.json();
    if (endpoint) await redis().hdel('subs', subId(String(endpoint)));
    return Response.json({ ok: true });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
