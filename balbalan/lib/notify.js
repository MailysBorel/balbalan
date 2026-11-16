// Notifications push (côté serveur).
// Toutes les minutes, /api/cron appelle runCron() : on récupère les scores des sports suivis, on compare chaque match
// des équipes / joueurs en favori avec son état de la minute précédente, et on envoie une notif par événement.
//
// Stockage (Upstash Redis) :
//   hash « subs » : id d'abonné → { sub (abonnement push du téléphone), favs [{sport, name}], prefs, ts }
//   hash « snap » : sport:compétition:id → dernier état connu du match (voir snapshot())
import { Redis } from '@upstash/redis';
import * as webpush from 'web-push'; // v4 : uniquement des exports nommés
export { webpush };
import { createHash } from 'crypto';
import { scoreboard } from './espn';

// Types de notifs par sport, tous activés par défaut (même liste côté app : lib/push-client.js)
export const TYPES = {
  foot: ['start', 'goal', 'red', 'half', 'end'],
  basket: ['start', 'quarter', 'end'],
  tennis: ['start', 'set', 'end', 'retire'],
  f1: ['start', 'pole', 'end'],
};

let _redis;
export function redis() {
  // Vercel → Storage → Upstash crée KV_REST_API_URL / KV_REST_API_TOKEN ; une base Upstash créée à la main donne UPSTASH_REDIS_REST_*
  // (préfixe libre à la connexion : KV_REST_API_URL, STORAGE_REST_API_URL… → on prend le premier *_REST_API_URL trouvé)
  const pre = Object.keys(process.env).find(k => k.endsWith('_REST_API_URL') && process.env[k.replace(/URL$/, 'TOKEN')])?.replace(/URL$/, '');
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || (pre && process.env[pre + 'URL']);
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || (pre && process.env[pre + 'TOKEN']);
  if (!url || !token) throw new Error('Base Redis non configurée (variables UPSTASH_REDIS_REST_URL / _TOKEN)');
  return (_redis ??= new Redis({ url, token }));
}

let vapidReady = false;
export function vapid() {
  if (vapidReady) return;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('Clés VAPID manquantes (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)');
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || (site ? `https://${site}` : 'mailto:admin@example.com'), pub, priv);
  vapidReady = true;
}

export const subId = endpoint => createHash('sha256').update(endpoint).digest('hex').slice(0, 32);

// ---------- Détection des événements ----------

// Ce qu'on garde d'un match d'une minute à l'autre
export function snapshot(m) {
  if (m.sport === 'f1') return { s: m.state, t: Date.now() };
  return {
    s: m.state, h: +m.home.score || 0, a: +m.away.score || 0, p: m.period ?? 0, n: m.statusName,
    c: m.sport === 'tennis' ? done(m) : 0,
    r: m.plays ? [reds(m, 'home'), reds(m, 'away')] : [0, 0],
    t: Date.now(),
  };
}
const reds = (m, side) => m.plays.filter(x => x.kind === 'red' && x.side === side).length;
const done = m => Math.max(0, m.home.lines.length - (m.state === 'live' ? 1 : 0)); // sets terminés
const score = m => `${m.home.short} ${m.home.score ?? 0} – ${m.away.score ?? 0} ${m.away.short}`;
const sets = (m, n = m.home.lines.length) => m.home.lines.slice(0, n).map((v, i) => `${v}-${m.away.lines[i] ?? ''}`).join(' ');

// Événements entre l'état précédent (prev) et le match actuel (m). Chaque événement : { type, title, body }
export function detect(prev, m) {
  const ev = [], add = (type, title, body) => ev.push({ type, title, body });
  if (!prev || m.state === 'pre') return ev;
  if (m.sport === 'f1') return detectF1(prev, m, add, ev);
  const T = `${m.home.short} – ${m.away.short}`;

  if (prev.s === 'pre' && m.state !== 'pre')
    add('start', T, m.sport === 'foot' ? 'Coup d’envoi !' : 'Le match commence !');

  if (m.sport === 'foot') {
    for (const side of ['home', 'away']) {
      const k = side === 'home' ? 'h' : 'a', now = +m[side].score || 0;
      if (now > prev[k]) { // but (si plusieurs buts depuis la dernière minute, une seule notif avec le score à jour)
        const gs = [...(m.plays || [])].reverse().filter(x => x.kind === 'goal');
        // c.s.c. : ESPN peut l'attribuer à l'équipe du joueur ou à celle qui en profite → on accepte les deux
        const p = gs.find(x => (x.own ? x.side !== side : x.side === side)) || gs.find(x => x.own);
        const who = p ? [p.who, p.clock].filter(Boolean).join(' ') + (p.own ? ' (c.s.c.)' : p.pen ? ' (pen.)' : '') : '';
        add('goal', `⚽ But pour ${m[side].short} !`, [who, score(m)].filter(Boolean).join(' · '));
      }
      const r = m.plays ? reds(m, side) : 0, pr = prev.r?.[side === 'home' ? 0 : 1] ?? 0;
      if (r > pr) {
        const p = [...m.plays].reverse().find(x => x.kind === 'red' && x.side === side);
        add('red', `🟥 Carton rouge pour ${m[side].short}`, [p && [p.who, p.clock].filter(Boolean).join(' '), score(m)].filter(Boolean).join(' · '));
      }
    }
    if (m.statusName === 'STATUS_HALFTIME' && prev.n !== 'STATUS_HALFTIME') add('half', T, `Mi-temps · ${score(m)}`);
  }

  if (m.sport === 'basket' && m.state === 'live' && m.period > prev.p && prev.p > 0)
    add('quarter', T, `${prev.p <= 4 ? `Fin du Q${prev.p}` : 'Fin de la prolongation'} · ${score(m)}`);

  if (m.sport === 'tennis' && m.state === 'live') {
    const c = done(m);
    if (c > prev.c) { // un set vient de se terminer
      const i = c - 1, a = +m.home.lines[i], b = +m.away.lines[i];
      add('set', T, `Set ${c} pour ${(a > b ? m.home : m.away).short} · ${sets(m, c)}`);
    }
  }

  if (prev.s !== 'post' && m.state === 'post') {
    if (m.sport === 'tennis') {
      const ab = /retire/i.test(m.detail), wo = /walkover/i.test(m.detail);
      const w = +m.home.score > +m.away.score ? m.home : m.away, l = w === m.home ? m.away : m.home;
      if (ab) add('retire', T, `Abandon de ${l.short} · ${w.short} qualifié(e) · ${sets(m)}`);
      else add('end', T, wo ? `Forfait de ${l.short}` : `Victoire de ${w.short} · ${sets(m)}`);
    } else add('end', T, `Terminé · ${score(m)}`);
  }
  return ev;
}

// F1 : départ (course, sprint), pole position (qualifs, qualifs sprint), podium (course, sprint). Pas de notif pour les essais.
function detectF1(prev, m, add, ev) {
  const race = m.code === 'Race' || m.code === 'SR', qual = m.code === 'Qual' || m.code === 'SS';
  const sprint = m.code === 'SR' || m.code === 'SS', r = m.results;
  if (race && prev.s === 'pre' && m.state !== 'pre') add('start', `🏁 ${m.leagueName}`, sprint ? 'Départ du sprint !' : 'Départ de la course !');
  if (prev.s !== 'post' && m.state === 'post' && r.length) {
    const podium = r.slice(0, 3).map((x, i) => `${i + 1}. ${x.short}`).join(' · ');
    if (qual) add('pole', `${m.leagueName} · ${sprint ? 'Pole du sprint' : 'Pole position'}`, `🥇 ${r[0].short} · ${podium.split(' · ').slice(1).join(' · ')}`);
    if (race) add('end', `🏆 ${r[0].short} remporte ${sprint ? 'le sprint du ' : 'le '}${m.leagueName}`, podium);
  }
  return ev;
}
// Place des pilotes suivis hors podium, ajoutée à la notif de chaque abonné (« Gasly P8 »)
const f1Mine = (e, sub) => {
  if (!e.results) return '';
  const names = (sub.favs || []).filter(f => f.sport === 'f1').map(f => f.name);
  const mine = e.results.filter(r => names.includes(r.name) && r.pos > 3).map(r => `${r.short} P${r.pos}`);
  return mine.length ? ` · ${mine.join(' · ')}` : '';
};

// ---------- Tâche planifiée ----------

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }).replace(/-/g, '');
const matchUrl = m => `/match/${m.sport}/${m.league}/${m.id}?d=${new Date(m.start).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }).replace(/-/g, '')}`;

export async function runCron() {
  const db = redis();
  const subs = Object.entries((await db.hgetall('subs')) || {});
  if (!subs.length) return { subs: 0, sent: 0 };
  vapid();

  // qui suit quoi : sport → nom → [id d'abonné]
  const follow = {};
  for (const [id, s] of subs) for (const f of s.favs || []) ((follow[f.sport] ??= {})[f.name] ??= []).push(id);

  const snaps = (await db.hgetall('snap')) || {}, next = {}, events = [];
  for (const sport of Object.keys(follow)) {
    let list; try { list = await scoreboard(sport, today()); } catch { continue; }
    for (const m of list) {
      // F1 : toute séance concerne ceux qui suivent au moins un pilote (tous les pilotes courent)
      const ids = sport === 'f1' ? [...new Set(Object.values(follow.f1).flat())]
        : [...new Set([...(follow[sport][m.home.name] || []), ...(follow[sport][m.away.name] || [])])];
      if (!ids.length) continue;
      const key = `${sport}:${m.league}:${m.id}`, prev = snaps[key], cur = snapshot(m);
      for (const e of detect(prev, m)) events.push({ ...e, sport, ids, url: matchUrl(m), tag: `${key}:${e.type}:${cur.h}-${cur.a}:${cur.c}:${cur.p}`,
        results: sport === 'f1' ? m.results : null });
      if (!prev || JSON.stringify({ ...prev, t: 0 }) !== JSON.stringify({ ...cur, t: 0 })) next[key] = cur;
    }
  }

  // envoi (en parallèle), en respectant les réglages de chaque abonné ; abonnements expirés supprimés
  const byId = Object.fromEntries(subs), dead = new Set();
  let sent = 0;
  await Promise.all(events.flatMap(e => e.ids.filter(id => byId[id].prefs?.[e.sport]?.[e.type] !== false).map(id =>
    webpush.sendNotification(byId[id].sub, JSON.stringify({ title: e.title, body: e.body + f1Mine(e, byId[id]), url: e.url, tag: e.tag }), { TTL: 600, urgency: 'high' })
      .then(() => sent++)
      .catch(err => { if (err.statusCode === 404 || err.statusCode === 410) dead.add(id); }))));

  // ménage : états des matchs de plus de 2 jours
  const old = Object.entries(snaps).filter(([k, v]) => !next[k] && Date.now() - (v.t || 0) > 2 * 864e5).map(([k]) => k);
  await Promise.all([
    Object.keys(next).length && db.hset('snap', next),
    old.length && db.hdel('snap', ...old),
    dead.size && db.hdel('subs', ...dead),
  ]);
  return { subs: subs.length, events: events.length, sent, removed: dead.size };
}
