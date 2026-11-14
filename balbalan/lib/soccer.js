// Foot : temps forts rédigés en français + compositions, à partir des données structurées d'ESPN.
import { toFrench } from './countries';

const team = e => { const n = e.team?.displayName || e.team?.name; return n ? toFrench(n) || n : ''; };
const who = (e, i) => e.participants?.[i]?.athlete?.displayName || '';
// « Goal! Bulgaria 0, Iceland 2. » → « 0-2 » (ESPN met toujours l'équipe à domicile en premier)
const score = t => { const r = /(?:^|[!.] )[^,.!]+? (\d+), [^,.!]+? (\d+)\./.exec(t || ''); return r ? `${r[1]}-${r[2]}` : ''; };
// « de Andri » → « d’Andri »
const de = n => (/^[aeiouyhàâéèêëîïôöûüAEIOUYHÀÂÉÈÊËÎÏÔÖÛÜ]/.test(n) ? 'd’' : 'de ') + n;
const join = (...p) => p.filter(Boolean).join(' · ');

// Une phrase par type d'action ; null = action masquée (arrêts de jeu, etc.).
const EVENTS = {
  goal: e => ['⚽', join(`But ${de(who(e, 0))}`, team(e), who(e, 1) && `passe ${de(who(e, 1))}`, score(e.text)), 'goal'],
  'penalty---scored': e => ['⚽', join(`But sur penalty ${de(who(e, 0))}`, team(e), score(e.text)), 'goal'],
  'own-goal': e => ['⚽', join(`But contre son camp ${de(who(e, 0))}`, score(e.text)), 'goal'],
  'penalty---missed': e => ['❌', join(`Penalty manqué par ${who(e, 0)}`, team(e))],
  'penalty---saved': e => ['❌', join(`Penalty arrêté, tiré par ${who(e, 0)}`, team(e))],
  'yellow-card': e => ['🟨', join(`Carton jaune pour ${who(e, 0)}`, team(e))],
  'red-card': e => ['🟥', join(`Carton rouge pour ${who(e, 0)}`, team(e))],
  'yellow-red-card': e => ['🟥', join(`Deuxième jaune, expulsion ${de(who(e, 0))}`, team(e))],
  substitution: e => ['🔁', join(`${who(e, 0)} remplace ${who(e, 1)}`, team(e))],
  kickoff: () => ['⏱', 'Coup d’envoi'],
  halftime: () => ['⏱', 'Mi-temps'],
  'start-2nd-half': () => ['⏱', 'Début de la seconde période'],
  'end-regular-time': e => ['⏱', join('Fin du temps réglementaire', score(e.text))],
  'start-extra-time': () => ['⏱', 'Début des prolongations'],
  'end-extra-time': () => ['⏱', 'Fin des prolongations'],
  'start-shootout': () => ['⏱', 'Séance de tirs au but'],
  'full-time': () => ['⏱', 'Fin du match'],
  'start-delay': null, 'end-delay': null,
};

export function soccerEvents(keyEvents) {
  return (keyEvents || []).flatMap(e => {
    const k = e.type?.type, f = EVENTS[k];
    if (f === null) return [];
    if (f) { const [icon, text, kind] = f(e); return [{ time: e.clock?.displayValue || '', icon, text, kind }]; }
    const t = e.type?.text || e.text; // type inconnu : on garde le libellé ESPN plutôt que rien
    return t ? [{ time: e.clock?.displayValue || '', icon: '•', text: t }] : [];
  }).reverse();
}

// Postes ESPN → ligne (0 gardien … 5 attaque) et côté (-1 gauche, 1 droite) pour dessiner le terrain.
const depth = p => {
  if (p === 'G') return 0;
  if (/^(CD|LB|RB|LWB|RWB|SW|D)/.test(p)) return 1;
  if (/^DM/.test(p)) return 2;
  if (/^(CM|LM|RM|M)/.test(p)) return 3;
  if (/^(AM|LW|RW)/.test(p)) return 4;
  return 5;
};
// LB/LM/LW = tout à gauche, CD-L = gauche du centre, CD = centre…
const lateral = p => (/^L/.test(p) ? -2 : /-L$/.test(p) ? -1 : /^R/.test(p) ? 2 : /-R$/.test(p) ? 1 : 0);

export function soccerLineups(rosters, keyEvents) {
  if (!rosters?.length || !rosters.some(r => r.roster?.length)) return null;
  // buts / cartons de chaque joueur, pour les afficher à côté de son nom
  const marks = new Map();
  const add = (n, x) => n && marks.set(n, (marks.get(n) || '') + x);
  for (const e of keyEvents || []) {
    const k = e.type?.type, n = who(e, 0);
    if (k === 'goal' || k === 'penalty---scored') add(n, '⚽');
    else if (k === 'yellow-card') add(n, '🟨');
    else if (k === 'red-card' || k === 'yellow-red-card') add(n, '🟥');
  }
  const sorted = [...rosters].sort((a, b) => (a.homeAway === 'away') - (b.homeAway === 'away'));
  return sorted.map(r => {
    const ps = (r.roster || []).map(p => {
      const pos = p.position?.abbreviation || '';
      const name = p.athlete?.displayName || '?';
      return {
        n: p.jersey || '', name, short: p.athlete?.lastName || p.athlete?.shortName || name,
        pos, d: depth(pos), l: lateral(pos), starter: !!p.starter,
        out: !!p.subbedOut, in: !!p.subbedIn, marks: marks.get(name) || '',
      };
    });
    const starters = ps.filter(p => p.starter).sort((a, b) => a.d - b.d || a.l - b.l);
    // découpe en lignes selon le schéma (ex. 4-2-3-1) ; sinon selon le poste
    const counts = (r.formation || '').split('-').map(Number).filter(n => n > 0);
    let lines;
    const field = starters.filter(p => p.d > 0);
    if (counts.length && counts.reduce((a, b) => a + b, 0) === field.length) {
      let i = 0; lines = counts.map(c => field.slice(i, i += c));
    } else {
      lines = [1, 2, 3, 4, 5].map(d => field.filter(p => p.d === d)).filter(l => l.length);
    }
    lines = [starters.filter(p => p.d === 0), ...lines].map(l => [...l].sort((a, b) => a.l - b.l));
    const name = r.team?.displayName || '';
    return {
      team: toFrench(name) || name, logo: r.team?.logo || r.team?.logos?.[0]?.href || null,
      formation: r.formation || '', lines, subs: ps.filter(p => !p.starter).sort((a, b) => b.in - a.in),
    };
  });
}

const STATS = {
  possessionPct: 'Possession', totalShots: 'Tirs', shotsOnTarget: 'Tirs cadrés', wonCorners: 'Corners',
  foulsCommitted: 'Fautes', yellowCards: 'Cartons jaunes', redCards: 'Cartons rouges', offsides: 'Hors-jeu',
  saves: 'Arrêts', accuratePasses: 'Passes réussies', totalPasses: 'Passes', passPct: 'Précision des passes',
  effectiveTackles: 'Tacles réussis', totalTackles: 'Tacles', blockedShots: 'Tirs contrés',
  totalCrosses: 'Centres', accurateCrosses: 'Centres réussis', interceptions: 'Interceptions',
  totalClearance: 'Dégagements', effectiveClearance: 'Dégagements réussis', totalLongBalls: 'Longs ballons',
  accurateLongBalls: 'Longs ballons réussis', penaltyKickGoals: 'Penalties marqués', penaltyKickShots: 'Penalties tirés',
};
export const statLabel = s => STATS[s.name];
