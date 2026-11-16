// Adaptateur ESPN (non officiel). Pour changer de fournisseur, réécris seulement ce fichier
// en gardant le même format de sortie (objet "match" ci-dessous).
import { toEnglish, toFrench, norm } from './countries';
import { soccerEvents, soccerLineups, statLabel } from './soccer';
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
// Pas de cache de données Next ici : il renvoie la copie périmée à la 1re requête après expiration (stale-while-revalidate),
// ce qui affichait des scores vieux de plusieurs heures. Le cache CDN des routes /api suffit à limiter les appels à ESPN.
async function get(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.json();
}
const state = s => (s === 'in' ? 'live' : s === 'post' ? 'post' : 'pre');
const TBD = { name: 'À déterminer', short: 'À déterminer', tbd: true, score: null, logo: null, lines: [] };
const flag = a => (typeof a?.flag === 'string' ? a.flag : a?.flag?.href) || null;
function side(c) {
  if (!c) return TBD;
  const ps = c.roster?.athletes || [];
  if (ps.length) { // double de tennis : une « équipe » de deux joueurs
    const last = a => (a.shortName || a.displayName || '?').replace(/^\S+\.\s+/, ''); // « N. Mektic » → « Mektic »
    const flags = [...new Set(ps.map(flag).filter(Boolean))];
    return {
      name: c.roster.displayName || ps.map(a => a.displayName).join(' / '),
      short: ps.map(last).join(' / '),
      score: c.score ?? null, logo: flags[0] || null, logo2: flags[1] || null,
      lines: (c.linescores || []).map(l => l.value ?? l.displayValue),
    };
  }
  const t = c.team || c.athlete;
  if (!t || !(t.displayName || t.name)) return { ...TBD, lines: (c.linescores || []).map(l => l.value ?? l.displayValue) };
  const fr = toFrench(t.displayName || t.name); // sélections nationales en français (« Belgium » → « Belgique »)
  return {
    name: fr || t.displayName || t.name || '?',
    short: fr || t.shortDisplayName || t.shortName || t.displayName || t.abbreviation || '?',
    score: c.score ?? null,
    logo: t.logo || t.logos?.[0]?.href || t.flag?.href || null,
    photo: c.athlete && /^\d+$/.test(c.id || '') ? `https://a.espncdn.com/combiner/i?img=/i/headshots/tennis/players/full/${c.id}.png&w=192&h=140` : null,
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
    // pour les notifications : période en cours, statut exact (mi-temps, abandon…)
    period: st.period ?? null, statusName: st.type?.name || '', detail: st.type?.detail || '',
  };
  if (sport === 'foot') { // buts et cartons rouges (buteur, minute), du plus ancien au plus récent
    const hid = h?.team?.id;
    m.plays = (comp.details || []).filter(x => x.scoringPlay || x.redCard).map(x => ({
      kind: x.scoringPlay ? 'goal' : 'red', side: x.team?.id === hid ? 'home' : 'away',
      clock: x.clock?.displayValue || '', who: x.athletesInvolved?.[0]?.shortName || x.athletesInvolved?.[0]?.displayName || '',
      own: !!x.ownGoal, pen: !!x.penaltyKick,
    }));
  }
  if (sport === 'tennis') { // score = sets gagnés
    const H = m.home.lines, A = m.away.lines; let sh = 0, sa = 0;
    H.forEach((v, i) => { if (i < A.length && !(m.state === 'live' && i === H.length - 1)) { if (+v > +A[i]) sh++; else if (+A[i] > +v) sa++; } });
    m.home.score = String(sh); m.away.score = String(sa);
  }
  return m;
}
// Tennis. ESPN ne connaît que les circuits ATP et WTA ; les tournois « 125 » / « Challenger » sont repérés à leur nom.
const circuit = (l, name) => /challenger/i.test(name) ? 'Challenger' : /\b125\b/.test(name) ? l.toUpperCase() + ' 125' : l.toUpperCase();
const draw = s => (/mixed/i.test(s) ? 'Double mixte' : /doubles/i.test(s) ? 'Double' : 'Simple');
const ROUNDS = { 'Round 1': '1er tour', 'Round 2': '2e tour', 'Round 3': '3e tour', 'Round 4': '4e tour', 'Round of 128': '1/64 de finale',
  'Round of 64': '1/32 de finale', 'Round of 32': '1/16 de finale', 'Round of 16': '1/8 de finale', Quarterfinal: 'Quart de finale',
  Quarterfinals: 'Quart de finale', Semifinal: 'Demi-finale', Semifinals: 'Demi-finale', Final: 'Finale', 'Group Stage': 'Phase de groupes',
  'Qualifying 1st Round': 'Qualifs · 1er tour', 'Qualifying 2nd Round': 'Qualifs · 2e tour', 'Qualifying 3rd Round': 'Qualifs · 3e tour',
  'Qualifying Final': 'Qualifs · dernier tour' };
const round = r => (r ? ROUNDS[r] || r.replace(/^Qualifying /, 'Qualifs · ') : '');
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
      // tennis : les matchs sont rangés par tableau (simple messieurs, double dames…)
      const comps = ev.competitions?.length ? ev.competitions
        : (ev.groupings || []).flatMap(g => (g.competitions || []).map(c => ({ ...c, _draw: g.grouping?.slug || g.grouping?.displayName || '' })));
      for (const c of comps) {
        const k = l + ':' + (c.id || ev.id); if (seen.has(k)) continue; seen.add(k);
        const tour = ev.shortName || ev.name || lg;
        const m = toMatch(ev, c, sport, l, sport === 'tennis' ? tour + (/doubles/i.test(c._draw) ? ' · Double' : '') : NAMES[l] || lg);
        m.order = S.leagues.indexOf(l); // ordre d'affichage des compétitions
        if (sport === 'tennis') Object.assign(m, { circuit: circuit(l, tour), tournament: tour, draw: draw(c._draw), round: round(c.round?.displayName) });
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
    let list = (t0.statistics || []).filter(s => map.has(s.name) && s.displayValue != null);
    if (sport === 'foot') { // stats choisies, dans cet ordre, libellés en français
      const pick = ['possessionPct', 'totalShots', 'shotsOnTarget', 'wonCorners', 'foulsCommitted', 'yellowCards', 'redCards', 'offsides', 'saves', 'accuratePasses'];
      list = pick.map(n => list.find(s => s.name === n)).filter(Boolean);
    }
    stats = list.map(s => ({
      label: (sport === 'foot' && statLabel(s)) || s.label || s.abbreviation || s.name,
      home: s.displayValue + (s.name === 'possessionPct' ? '%' : ''),
      away: map.get(s.name).displayValue + (s.name === 'possessionPct' ? '%' : ''),
    })).slice(0, 8);
  }
  const events = sport === 'foot' ? soccerEvents(d.keyEvents)
    : (d.keyEvents || []).filter(e => e.text || e.type?.text)
      .map(e => ({ time: e.clock?.displayValue || '', text: e.text || e.type?.text })).reverse().slice(0, 12);
  const lineups = sport === 'foot' ? soccerLineups(d.rosters, d.keyEvents) : null;
  return { match, stats, events, lineups };
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
        return { id: a.id || null, league: l, rank: r.current ?? i + 1, name: a.displayName || a.name || '?', logo: typeof f === 'string' ? f : f?.href || null, cols: [r.points ?? '–'] };
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
        const base = { id: t.id || null, league: l, name: t.shortDisplayName || t.displayName || '?', logo: t.logos?.[0]?.href || t.logo || null };
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
      // lien vers la page profil : équipes (tous sports) et joueurs de tennis. Les joueurs de foot / basket n'ont pas de page.
      const tid = c.uid?.match(/~t:(\d+)/)?.[1], aid = c.uid?.match(/~a:(\d+)/)?.[1];
      const href = r.type === 'team' && tid && league ? `/team/${sport}/${league}/${tid}`
        : r.type === 'player' && sport === 'tennis' && aid && (league === 'atp' || league === 'wta') ? `/team/tennis/${league}/${aid}` : null;
      out.push({ href,
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

// Page équipe : derniers résultats + prochains matchs. ESPN donne le calendrier compétition par compétition,
// on interroge donc le championnat + la Ligue des champions (club) ou toutes les compétitions de sélections.
const DOMESTIC = ['fra.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1'];
export async function teamSchedule(sport, league, id) {
  const S = SPORTS[sport];
  const leagues = sport !== 'foot' ? [league]
    : DOMESTIC.includes(league) || league === 'uefa.champions' ? [...new Set([league, 'uefa.champions'])]
    : !S.leagues.includes(league) ? [league] // club d'un championnat non suivi (trouvé par la recherche : Liga MX…)
    : S.leagues.filter(l => !DOMESTIC.includes(l) && l !== 'uefa.champions');
  const urls = leagues.flatMap(l => {
    const u = `${BASE}/${S.path}/${l}/teams/${id}/schedule`;
    return sport === 'foot' ? [[l, u], [l, u + '?fixture=true']] : [[l, u]]; // foot : les matchs à venir sont à part
  });
  const res = await Promise.allSettled(urls.map(([l, u]) => get(u).then(d => ({ l, d }))));
  let team = null; const seen = new Set(), past = [], next = [];
  for (const r of res) {
    if (r.status !== 'fulfilled') continue;
    const { l, d } = r.value;
    if (!team && d.team) team = { name: d.team.displayName, logo: d.team.logo || d.team.logos?.[0]?.href || null, record: d.team.recordSummary || '', recordLeague: NAMES[l] || l };
    for (const ev of d.events || []) {
      const c = ev.competitions?.[0]; if (!c || seen.has(ev.id)) continue; seen.add(ev.id);
      const cs = c.competitors || [];
      const me = cs.find(x => String(x.team?.id ?? x.id) === String(id)), op = cs.find(x => x !== me);
      if (!me || !op) continue;
      const st = state(c.status?.type?.state), sc = x => x.score?.displayValue ?? x.score?.value ?? x.score ?? null;
      const a = Number(sc(me)), b = Number(sc(op));
      const row = {
        id: String(ev.id), league: l, leagueName: NAMES[l] || ev.league?.abbreviation || l, date: ev.date, state: st,
        home: me.homeAway === 'home',
        opp: { name: toFrench(op.team?.displayName) || op.team?.shortDisplayName || op.team?.displayName || '?', logo: op.team?.logos?.[0]?.href || op.team?.logo || null },
        score: st === 'post' && sc(me) != null ? [sc(me), sc(op)] : null,
        result: st !== 'post' ? null : me.winner ? 'V' : op.winner ? 'D' : a > b ? 'V' : a < b ? 'D' : 'N',
      };
      (st === 'pre' ? next : st === 'post' ? past : next).push(row);
    }
  }
  if (!team) throw new Error('équipe introuvable');
  team.name = toFrench(team.name) || team.name;
  past.sort((x, y) => new Date(y.date) - new Date(x.date));
  next.sort((x, y) => new Date(x.date) - new Date(y.date));
  return { team, past: past.slice(0, 15), next: next.slice(0, 5) };
}

// Page joueur (tennis). ESPN donne la liste des matchs de la saison (sans les scores) ; les scores, drapeaux et noms
// de tournois viennent du tableau complet de chaque tournoi récent (une requête par tournoi).
const CORE = 'https://sports.core.api.espn.com/v2/sports/tennis/leagues';
const https = u => u.replace(/^http:/, 'https:');
export async function playerSchedule(league, id) {
  const [log, info, ranks] = await Promise.all([
    get(`${CORE}/${league}/athletes/${id}/eventlog?limit=60`),
    get(`https://site.web.api.espn.com/apis/common/v3/sports/tennis/${league}/athletes/${id}`).catch(() => null),
    get(`${BASE}/tennis/${league}/rankings`).catch(() => null),
  ]);
  // les matchs sont rangés par tournoi, du plus récent au plus ancien : les ~30 premiers suffisent
  const items = (log.events?.items || []).slice(0, 30);
  const comps = (await Promise.allSettled(items.map(it => get(https(it.competition.$ref)).then(c => ({ c, it })))))
    .filter(r => r.status === 'fulfilled').map(r => r.value);
  const rows = [];
  for (const { c, it } of comps) {
    const meId = (it.competitor?.$ref || '').match(/competitors\/([^?/]+)/)?.[1];
    const cs = c.competitors || [], me = cs.find(x => String(x.id) === meId) || cs.find(x => String(x.id).split('-').includes(String(id)));
    const op = cs.find(x => x !== me);
    if (!me || !op || op.id === '0' || /^bye$/i.test(op.name || '')) continue; // exempté
    const eventId = (it.event?.$ref || '').match(/events\/([^?/]+)/)?.[1];
    const st = it.played ? 'post' : 'pre';
    rows.push({
      id: String(c.id), eventId, league, date: c.date, state: st, double: c.type?.type === 'doubles',
      round: round(c.round?.description), opp: { name: op.name || '?', logo: null },
      result: st === 'post' ? (me.winner ? 'V' : op.winner ? 'D' : null) : null, meId: String(me.id), opId: String(op.id),
    });
  }
  // tableaux des 6 tournois les plus récents → état réel, scores, drapeaux, nom du tournoi
  rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  const events = new Map();
  for (const r of rows) if (!events.has(r.eventId)) events.set(r.eventId, r.date); // date du dernier match du tournoi
  const boards = await Promise.allSettled([...events].slice(0, 6).map(([eid, date]) =>
    get(`${BASE}/tennis/${league}/scoreboard?dates=${ymd(new Date(date))}`).then(d => ({ eid, d }))));
  const found = new Map();
  for (const b of boards) {
    if (b.status !== 'fulfilled') continue;
    const ev = (b.value.d.events || []).find(e => e.id === b.value.eid); if (!ev) continue;
    for (const g of ev.groupings || []) for (const c of g.competitions || []) found.set(String(c.id), { ev, c });
  }
  for (const r of rows) {
    const f = found.get(r.id);
    if (!f) { r.leagueName = r.double ? 'Double' : ''; continue; }
    const tour = f.ev.shortName || f.ev.name || '';
    r.leagueName = tour + (r.double ? ' · Double' : '');
    // l'état du tableau fait foi (ESPN marque parfois « joué » un match du jour pas encore commencé)
    r.state = state(f.c.status?.type?.state);
    const me = f.c.competitors.find(x => String(x.id) === r.meId), op = f.c.competitors.find(x => String(x.id) === r.opId);
    if (op) { const o = side(op); r.opp = { name: o.name, logo: o.logo, logo2: o.logo2 }; }
    if (r.state !== 'post') { r.result = null; continue; }
    if (me && op) {
      r.result = me.winner ? 'V' : op.winner ? 'D' : r.result;
      const a = side(me).lines, b = side(op).lines, detail = f.c.status?.type?.detail || '';
      if (/walkover/i.test(detail)) r.score = 'w.o.';
      else if (a.length) {
        r.score = a.map((v, i) => `${v}-${b[i] ?? ''}`).join(' ') + (/retire/i.test(detail) ? ' ab.' : '');
        r.sets = a.map((v, i) => [v, b[i] ?? '']); // jeux par set [joueur, adversaire], pour l'affichage en colonnes
        if (/retire/i.test(detail)) r.note = 'ab.';
      }
    }
  }
  const past = rows.filter(r => r.state === 'post' && r.result).slice(0, 15);
  const next = rows.filter(r => r.state !== 'post').reverse().slice(0, 5); // en cours / à venir, du plus proche au plus lointain
  const a = info?.athlete || {};
  const rk = (ranks?.rankings?.[0]?.ranks || []).find(x => String(x.athlete?.id) === String(id));
  const fl = rk?.athlete?.flag;
  const name = a.displayName || rk?.athlete?.displayName || '?';
  const clean = r => { const { eventId, meId, opId, double, ...x } = r; return x; };
  return {
    team: {
      name, logo: (typeof fl === 'string' ? fl : fl?.href) || null,
      photo: `https://a.espncdn.com/combiner/i?img=/i/headshots/tennis/players/full/${id}.png&w=192&h=140`,
      details: [rk && `${rk.current}e mondial · ${rk.points} pts`, a.age && `${a.age} ans`, a.hand?.abbreviation && (a.hand.abbreviation === 'L' ? 'gaucher' : 'droitier')].filter(Boolean).join(' · '),
    },
    past: past.map(clean), next: next.map(clean),
  };
}
