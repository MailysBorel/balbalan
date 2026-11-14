// Adaptateur ESPN (non officiel). Pour changer de fournisseur, réécris seulement ce fichier
// en gardant le même format de sortie (objet "match" ci-dessous).
import { toEnglish, toFrench, norm } from './countries';
const BASE = 'https://site.api.espn.com/apis/site/v2/sports';
export const SPORTS = {
  foot: {
    path: 'soccer',
    leagues: ['fra.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'uefa.champions',
      'uefa.nations', 'fifa.friendly', 'fifa.worldq.uefa', 'uefa.euroq', 'fifa.world', 'uefa.euro',
      'caf.nations_qual', 'caf.nations', 'fifa.worldq.caf',
      'conmebol.america', 'fifa.worldq.conmebol',
      'concacaf.nations.league', 'concacaf.gold', 'fifa.worldq.concacaf',
      'afc.cupq', 'afc.asian.cup', 'fifa.worldq.afc'],
    // compétitions avec un classement (les amicaux n'en ont pas)
    standings: ['fra.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'uefa.champions', 'uefa.nations', 'caf.nations_qual', 'concacaf.nations.league', 'afc.cupq'],
  },
  basket: { path: 'basketball', leagues: ['nba'] },
  tennis: { path: 'tennis', leagues: ['atp', 'wta'] },
};
async function get(url) {
  const r = await fetch(url, { next: { revalidate: 20 } });
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.json();
}
const state = s => (s === 'in' ? 'live' : s === 'post' ? 'post' : 'pre');
function side(c) {
  if (!c) return { name: '?', short: '?', score: null, logo: null, lines: [] };
  const t = c.team || c.athlete || {};
  return {
    name: t.displayName || t.name || '?',
    short: t.shortDisplayName || t.shortName || t.displayName || t.abbreviation || '?',
    score: c.score ?? null,
    logo: t.logo || t.logos?.[0]?.href || t.flag?.href || null,
    lines: (c.linescores || []).map(l => l.value ?? l.displayValue),
  };
}
function toMatch(ev, comp, sport, league, leagueName) {
  const cs = comp.competitors || [];
  const h = cs.find(c => c.homeAway === 'home') || cs[0];
  const a = cs.find(c => c.homeAway === 'away' && c !== h) || cs.find(c => c !== h);
  const st = comp.status || ev.status || {};
  const m = {
    id: String(comp.id || ev.id), sport, league, leagueName,
    state: state(st.type?.state), status: st.type?.shortDetail || st.type?.detail || '',
    start: comp.date || ev.date, home: side(h), away: side(a),
  };
  if (sport === 'tennis') { // score = sets gagnés
    const H = m.home.lines, A = m.away.lines; let sh = 0, sa = 0;
    H.forEach((v, i) => { if (i < A.length && !(m.state === 'live' && i === H.length - 1)) { if (+v > +A[i]) sh++; else if (+A[i] > +v) sa++; } });
    m.home.score = String(sh); m.away.score = String(sa);
  }
  return m;
}
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
const shift = (s, n) => ymd(new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8) + n)));
// date = jour local de l'utilisateur (AAAAMMJJ). On prend J-1, J et J+1 pour couvrir les décalages horaires ; le tri par jour se fait côté app.
// (ESPN refuse les plages "dates=A-B" : une requête par jour.)
export async function scoreboard(sport, date) {
  const S = SPORTS[sport]; if (!S) throw new Error('sport inconnu');
  const qs = date ? [-1, 0, 1].map(n => `?dates=${shift(date, n)}&limit=300`) : [''];
  const res = await Promise.allSettled(S.leagues.flatMap(l => qs.map(q => get(`${BASE}/${S.path}/${l}/scoreboard${q}`).then(d => ({ l, d })))));
  const out = [], seen = new Set();
  for (const r of res) {
    if (r.status !== 'fulfilled') continue;
    const { l, d } = r.value;
    const lg = d.leagues?.[0]?.abbreviation || d.leagues?.[0]?.name || l;
    for (const ev of d.events || []) {
      const comps = ev.competitions?.length ? ev.competitions : (ev.groupings || []).flatMap(g => g.competitions || []);
      for (const c of comps) {
        const k = l + ':' + (c.id || ev.id); if (seen.has(k)) continue; seen.add(k);
        const m = toMatch(ev, c, sport, l, sport === 'tennis' ? ev.shortName || ev.name || lg : NAMES[l] || lg);
        m.order = S.leagues.indexOf(l); // ordre d'affichage des compétitions
        out.push(m);
      }
    }
  }
  const rank = { live: 0, pre: 1, post: 2 };
  return out.sort((x, y) => rank[x.state] - rank[y.state] || new Date(x.start) - new Date(y.start));
}
export async function matchDetail(sport, league, id) {
  const S = SPORTS[sport];
  const d = await get(`${BASE}/${S.path}/${league}/summary?event=${id}`);
  const hc = d.header?.competitions?.[0];
  const match = hc ? toMatch({ id }, hc, sport, league, d.header?.league?.abbreviation || league) : null;
  let stats = [];
  const teams = d.boxscore?.teams || [];
  if (teams.length === 2) {
    const [t0, t1] = teams[0].homeAway === 'away' ? [teams[1], teams[0]] : teams;
    const map = new Map((t1.statistics || []).map(s => [s.name, s]));
    stats = (t0.statistics || []).filter(s => map.has(s.name) && s.displayValue != null)
      .map(s => ({ label: s.label || s.abbreviation || s.name, home: s.displayValue, away: map.get(s.name).displayValue })).slice(0, 8);
  }
  const events = (d.keyEvents || []).filter(e => e.text || e.type?.text)
    .map(e => ({ time: e.clock?.displayValue || '', text: e.text || e.type?.text })).reverse().slice(0, 12);
  return { match, stats, events };
}

export const NAMES = { 'fra.1': 'Ligue 1', 'eng.1': 'Premier League', 'esp.1': 'LaLiga', 'ita.1': 'Serie A', 'ger.1': 'Bundesliga', 'uefa.champions': 'Ligue des champions', 'uefa.nations': 'Ligue des nations', 'fifa.friendly': 'Match amical', 'fifa.worldq.uefa': 'Qualif. Mondial · Europe', 'uefa.euroq': 'Qualif. Euro', 'fifa.world': 'Coupe du monde', 'uefa.euro': 'Euro',
  'caf.nations_qual': 'Qualif. CAN', 'caf.nations': 'CAN', 'fifa.worldq.caf': 'Qualif. Mondial · Afrique',
  'conmebol.america': 'Copa América', 'fifa.worldq.conmebol': 'Qualif. Mondial · Amérique du Sud',
  'concacaf.nations.league': 'Ligue des nations CONCACAF', 'concacaf.gold': 'Gold Cup', 'fifa.worldq.concacaf': 'Qualif. Mondial · CONCACAF',
  'afc.cupq': 'Qualif. Coupe d’Asie', 'afc.asian.cup': 'Coupe d’Asie', 'fifa.worldq.afc': 'Qualif. Mondial · Asie', nba: 'NBA', atp: 'ATP', wta: 'WTA' };
const stat = (e, n) => e.stats?.find(s => s.name === n || s.type === n);
export async function standings(sport) {
  const S = SPORTS[sport];
  if (sport === 'tennis') {
    const res = await Promise.allSettled(S.leagues.map(l => get(`${BASE}/tennis/${l}/rankings`).then(d => ({ l, d }))));
    return res.filter(r => r.status === 'fulfilled').map(({ value: { l, d } }) => ({
      name: NAMES[l], cols: ['Pts'],
      rows: (d.rankings?.[0]?.ranks || []).slice(0, 100).map((r, i) => {
        const a = r.athlete || {}, f = a.flag;
        return { rank: r.current ?? i + 1, name: a.displayName || a.name || '?', logo: typeof f === 'string' ? f : f?.href || null, cols: [r.points ?? '–'] };
      }),
    })).filter(g => g.rows.length);
  }
  const res = await Promise.allSettled((S.standings || S.leagues).map(l => get(`https://site.api.espn.com/apis/v2/sports/${S.path}/${l}/standings`).then(d => ({ l, d }))));
  const groups = [];
  for (const r of res) {
    if (r.status !== 'fulfilled') continue;
    const { l, d } = r.value, kids = d.children?.length ? d.children : [d];
    for (const c of kids) {
      const es = c.standings?.entries || []; if (!es.length) continue;
      let rows = es.map(e => {
        const t = e.team || {}, v = n => stat(e, n);
        const base = { name: t.shortDisplayName || t.displayName || '?', logo: t.logos?.[0]?.href || t.logo || null };
        return sport === 'basket'
          ? { ...base, k: -(v('winPercent')?.value ?? 0), cols: [v('wins')?.displayValue, v('losses')?.displayValue, v('winPercent')?.displayValue] }
          : { ...base, k: v('rank')?.value ?? 1000 - (v('points')?.value ?? 0), cols: [v('gamesPlayed')?.displayValue, v('pointDifferential')?.displayValue, v('points')?.displayValue] };
      });
      rows.sort((a, b) => a.k - b.k); rows = rows.map(({ k, ...x }, i) => ({ ...x, rank: i + 1 }));
      const name = sport === 'basket' ? (c.name || c.abbreviation || 'NBA').replace(' Conference', '') : NAMES[l] + (kids.length > 1 ? ' · ' + (c.abbreviation || c.name).replace(/Group /g, 'Groupe ').replace(/League /g, 'Ligue ') : '');
      groups.push({ name, cols: sport === 'basket' ? ['V', 'D', '%'] : ['J', '+/-', 'Pts'], rows });
    }
  }
  return groups;
}

// Recherche d'équipes et de joueurs (foot, basket, tennis), celles des compétitions suivies en premier.
const FROM = { soccer: 'foot', basketball: 'basket', tennis: 'tennis' };
export async function search(q) {
  // « maroc » → on cherche aussi « Morocco » (ESPN est en anglais) ; les traductions passent en premier.
  const tr = toEnglish(q), queries = [...tr, ...(tr.some(e => norm(e) === norm(q)) ? [] : [q])];
  const res = await Promise.allSettled(queries.map(x => get(`https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(x)}&limit=15`)));
  if (!res.some(r => r.status === 'fulfilled')) throw new Error('recherche indisponible');
  const known = new Set(Object.values(SPORTS).flatMap(x => x.leagues));
  const out = [];
  for (const r of res.flatMap(x => x.status === 'fulfilled' ? x.value.results || [] : [])) {
    if (r.type !== 'team' && r.type !== 'player') continue;
    for (const c of r.contents || []) {
      const sport = FROM[c.sport]; if (!sport || !c.displayName) continue;
      if (sport === 'basket' && c.defaultLeagueSlug !== 'nba') continue; // pas de NCAA
      const league = c.defaultLeagueSlug;
      out.push({
        type: r.type, sport, name: c.displayName, label: toFrench(c.displayName) || c.displayName,
        sub: [...new Set([c.subtitle, NAMES[league] || c.description])].filter(x => x && !/soccer team/i.test(x)).join(' · '),
        logo: c.image?.default || null, k: tr.includes(c.displayName) ? -1 : known.has(league) ? 0 : 1,
      });
    }
  }
  const seen = new Set();
  return out.sort((a, b) => a.k - b.k).filter(x => !seen.has(x.sport + x.name) && seen.add(x.sport + x.name))
    .slice(0, 12).map(({ k, ...x }) => x);
}
