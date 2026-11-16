// Formule 1 (ESPN, non officiel). Une « séance » (essais, qualifs, sprint, course) remplace le « match » des autres sports :
// { id, eventId, sport: 'f1', league: 'f1', kind: 'race', leagueName (GP), session, code, state, status, start, circuit,
//   laps, results: [{ id, pos, name, short, flag, winner }] }
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/racing/f1';
const CORE = 'https://sports.core.api.espn.com/v2/sports/racing/leagues/f1';
async function get(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.json();
}
const state = s => (s === 'in' ? 'live' : s === 'post' ? 'post' : 'pre');
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
const shift = (s, n) => ymd(new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8) + n)));

export const SESSIONS = { FP1: 'Essais libres 1', FP2: 'Essais libres 2', FP3: 'Essais libres 3', SS: 'Qualifs sprint', SR: 'Sprint', Qual: 'Qualifications', Race: 'Course' };
// Nom du GP en français, sans le sponsor (« MSC Cruises São Paulo Grand Prix » → « GP de São Paulo »)
const GP = [[/australian/i, 'GP d’Australie'], [/chinese/i, 'GP de Chine'], [/japanese/i, 'GP du Japon'], [/bahrain grand prix in malaysia/i, 'GP de Malaisie'],
  [/bahrain/i, 'GP de Bahreïn'], [/saudi/i, 'GP d’Arabie saoudite'], [/miami/i, 'GP de Miami'], [/canadian/i, 'GP du Canada'], [/monaco/i, 'GP de Monaco'],
  [/barcelona/i, 'GP de Barcelone'], [/austrian/i, 'GP d’Autriche'], [/british/i, 'GP de Grande-Bretagne'], [/belgian/i, 'GP de Belgique'],
  [/hungarian/i, 'GP de Hongrie'], [/dutch/i, 'GP des Pays-Bas'], [/italian/i, 'GP d’Italie'], [/emilia/i, 'GP d’Émilie-Romagne'], [/spanish/i, 'GP d’Espagne'],
  [/azerbaijan/i, 'GP d’Azerbaïdjan'], [/singapore/i, 'GP de Singapour'], [/united states/i, 'GP des États-Unis'], [/mexico/i, 'GP de Mexico'],
  [/são paulo|sao paulo|brazil/i, 'GP de São Paulo'], [/las vegas/i, 'GP de Las Vegas'], [/qatar/i, 'GP du Qatar'], [/abu dhabi/i, 'GP d’Abou Dabi'],
  [/madrid/i, 'GP de Madrid'], [/french/i, 'GP de France']];
export const gpName = n => (GP.find(([r]) => r.test(n || ''))?.[1]) || (n || 'Formule 1').replace(/ Grand Prix/, ' GP');

function toSession(ev, c) {
  const st = c.status || {}, s = state(st.type?.state), code = c.type?.abbreviation || '';
  const lap = st.period, m = (st.type?.detail || '').match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
  return {
    id: String(c.id), eventId: String(ev.id), sport: 'f1', league: 'f1', kind: 'race',
    leagueName: gpName(ev.name || ev.shortName), session: SESSIONS[code] || code, code,
    state: s, status: s === 'live' ? (m ? `Tour ${m[1]}/${m[2]}` : lap ? `Tour ${lap}` : 'En cours') : '',
    start: c.date || ev.date, circuit: ev.circuit?.fullName || '', laps: lap || null, statusName: st.type?.name || '',
    results: (c.competitors || []).slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map(x => ({
      id: String(x.id), pos: x.order ?? null, winner: !!x.winner,
      name: x.athlete?.displayName || x.athlete?.fullName || '?', short: x.athlete?.shortName || x.athlete?.displayName || '?',
      flag: x.athlete?.flag?.href || null,
    })),
  };
}

// Séances autour d'une date (J-1, J, J+1 comme les autres sports ; le tri par jour se fait côté app)
export async function f1Sessions(date) {
  const qs = date ? [-1, 0, 1].map(n => `?dates=${shift(date, n)}`) : [''];
  const res = await Promise.allSettled(qs.map(q => get(`${BASE}/scoreboard${q}`)));
  const out = [], seen = new Set();
  for (const r of res) {
    if (r.status !== 'fulfilled') continue;
    for (const ev of r.value.events || []) for (const c of ev.competitions || []) {
      if (seen.has(String(c.id))) continue; seen.add(String(c.id));
      out.push({ ...toSession(ev, c), order: 0 });
    }
  }
  return out;
}

// Détail d'une séance : écurie (+ couleur), grille de départ, temps / écart, points. Une requête par pilote pour les temps.
export async function f1Detail(s) {
  const base = `${CORE}/events/${s.eventId}/competitions/${s.id}/competitors`;
  let items = [];
  try { items = (await get(`${base}?limit=40`)).items || []; } catch { return s; }
  const by = new Map(items.map(c => [String(c.id), c]));
  const stats = await Promise.allSettled(s.results.map(r => get(`${base}/${r.id}/statistics`)
    .then(d => Object.fromEntries((d.splits?.categories || []).flatMap(c => c.stats || []).map(x => [x.name, x.displayValue])))));
  const results = s.results.map((r, i) => {
    const c = by.get(r.id) || {}, st = stats[i].status === 'fulfilled' ? stats[i].value : {};
    const real = v => (v && v !== '0' && v !== '0.000' ? v : null);
    return {
      ...r, team: c.vehicle?.manufacturer || null, color: c.vehicle?.teamColor ? '#' + c.vehicle.teamColor : null, number: c.vehicle?.number || null,
      grid: s.code === 'Race' || s.code === 'SR' ? c.startOrder ?? null : null,
      time: r.pos === 1 ? real(st.totalTime) : real(st.behindTime) || real(st.totalTime),
      pts: +st.championshipPts > 0 ? +st.championshipPts : null, pits: real(st.pitsTaken),
      laps: real(st.lapsCompleted),
    };
  });
  // pilotes à un tour ou plus (course / sprint) : pas d'écart en secondes → « +1 tour » ;
  // très loin derrière (5 tours ou plus) ou aucun tour à l'arrivée → abandon
  const lead = +results[0]?.laps || 0;
  if (s.code === 'Race' || s.code === 'SR') for (const r of results) {
    const n = lead - (+r.laps || 0);
    if (r.time || !lead) continue;
    if (n >= 5 || (!r.laps && s.state === 'post')) r.time = 'Abandon';
    else if (n > 0) r.time = `+${n} tour${n > 1 ? 's' : ''}`;
  }
  return { ...s, results };
}

// Classements pilotes + constructeurs
export async function f1Standings() {
  const d = await get('https://site.api.espn.com/apis/v2/sports/racing/f1/standings');
  const stat = (e, n) => e.stats?.find(x => x.name === n || x.type === n);
  return (d.children || []).map(c => {
    const drivers = /driver/i.test(c.name || '');
    const rows = (c.standings?.entries || []).map((e, i) => {
      const a = e.athlete || {}, t = e.team || {};
      return {
        id: null, league: 'f1', rank: stat(e, 'rank')?.value ?? i + 1,
        name: drivers ? a.displayName || '?' : t.displayName || t.name || '?',
        logo: drivers ? (typeof a.flag === 'string' ? a.flag : a.flag?.href) || null : null,
        color: !drivers && t.color ? '#' + t.color : null,
        cols: [stat(e, 'points')?.displayValue ?? '–'],
      };
    }).sort((x, y) => x.rank - y.rank);
    return { name: drivers ? 'Pilotes' : 'Constructeurs', cols: ['Pts'], rows };
  }).filter(g => g.rows.length);
}
