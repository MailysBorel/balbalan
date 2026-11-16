'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fmtTime, statusText } from '../../../../../components/ui';
import { useFavs } from '../../../../../components/extra';

export default function Match() {
  const { sport, league, id } = useParams();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('stats');
  const [side, setSide] = useState(0); // équipe affichée dans « Compos »
  const { has, toggle } = useFavs();
  useEffect(() => {
    let on = true;
    const date = new URLSearchParams(location.search).get('d') || '';
    const load = () => fetch(`/api/match?sport=${sport}&league=${league}&id=${id}&date=${date}`).then(r => r.json())
      .then(x => on && setD(x)).catch(() => on && setD({ error: 1 }));
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 20000);
    const wake = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', wake);
    return () => { on = false; clearInterval(t); document.removeEventListener('visibilitychange', wake); };
  }, [sport, league, id]);

  const m = d?.match;
  const p = { basket: 'Q', foot: 'MT', tennis: 'S' }[sport];
  const lines = m ? m.home.lines.map((v, i) => `${p}${i + 1} ${v}-${m.away.lines[i] ?? ''}`).join(' · ') : '';

  return (
    <div className="app" data-sport={sport}>
      <Link href="/" className="back">← <span className="mono">{m?.leagueName || ''}</span></Link>
      {d?.error ? <div className="empty">Match introuvable ou données indisponibles.</div>
        : !m ? <div className="skel big" />
        : <>
          <div className="board">
            {m.state === 'live' ? <span className="badge">LIVE · {m.status}</span>
              : <span className="mono">{m.state === 'pre' ? [new Date(m.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }), m.round].filter(Boolean).join(' · ') : statusText(m)}</span>}
            <div className="score">{m.state === 'pre' ? fmtTime(m.start) : `${m.home.score ?? 0}—${m.away.score ?? 0}`}</div>
            <div className="sides">{[m.home, m.away].map((t, i) => (
              <div className="side" key={i}>
                <Avatar t={t} sport={sport} />
                <span className="nm">{t.name}</span>
                {!t.tbd && <button className={'fav ' + (has(sport, t.name) ? 'on' : '')} onClick={() => toggle(sport, t)}>{has(sport, t.name) ? '★ Suivi' : '☆ Suivre'}</button>}
              </div>))}</div>
            {lines && <span className="mono">{lines}</span>}
          </div>
          <div className="seg">{[['stats', 'Stats'], ['resume', 'Temps forts'], ...(sport === 'foot' ? [['compos', 'Compos']] : [])].map(([k, n]) =>
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}</div>
          {tab === 'compos' ? <Lineups l={d.lineups} side={side} setSide={setSide} pre={m.state === 'pre'} />
          : tab === 'stats' ? (d.stats?.length ? <div className="panel">{d.stats.map(s => {
            const a = parseFloat(s.home) || 0, b = parseFloat(s.away) || 0, r = a + b ? a / (a + b) : 0.5;
            return <div className="stat" key={s.label}><div className="r">{s.home}<span>{s.label}</span>{s.away}</div>
              <div className="bar"><i style={{ flex: r }} /><i style={{ flex: 1 - r }} /></div></div>;
          })}</div> : <div className="empty">Statistiques pas encore disponibles.</div>)
          : (d.events?.length ? <div className="panel">{d.events.map((e, i) =>
            <div className={'ev' + (e.kind === 'goal' ? ' goal' : '')} key={i}><b>{e.time}</b>{e.icon && <i aria-hidden="true">{e.icon}</i>}<span>{e.text}</span></div>)}</div>
            : <div className="empty">Aucun temps fort pour l’instant.</div>)}
        </>}
    </div>
  );
}

// Compositions : terrain (attaque en haut, gardien en bas) + remplaçants.
function Lineups({ l, side, setSide, pre }) {
  if (!l?.length) return <div className="empty">{pre ? 'Compositions pas encore annoncées (en général 1 h avant le coup d’envoi).' : 'Compositions indisponibles pour ce match.'}</div>;
  const t = l[side] || l[0];
  const P = ({ p }) => (
    <div className="pl"><span className="num">{p.n}</span>
      <span className="pn">{p.short}</span>
      {(p.marks || p.out) && <span className="pm">{p.marks}{p.out && <b title="Remplacé">↓</b>}</span>}</div>);
  return (<>
    {l.length > 1 && <div className="seg">{l.map((x, i) => <button key={i} className={i === side ? 'on' : ''} onClick={() => setSide(i)}>{x.team}</button>)}</div>}
    <div className="pitch">
      {t.formation && <span className="mono form">{t.formation}</span>}
      {[...t.lines].reverse().map((row, i) => <div className="prow" key={i}>{row.map(p => <P key={p.n + p.name} p={p} />)}</div>)}
    </div>
    {t.subs.length > 0 && <section className="sec"><h2 className="mono">Remplaçants · {t.subs.length}</h2>
      <div className="panel subs">{t.subs.map(p => (
        <div className="sub" key={p.n + p.name}><span className="num">{p.n}</span><span className="sn">{p.name}</span>
          <span className="pm">{p.marks}{p.in && <b className="in" title="Entré en jeu">↑</b>}</span></div>))}</div></section>}
  </>);
}

// Photo du joueur (tennis) avec son drapeau en pastille ; sinon drapeau(x) ou logo de l'équipe ; sinon initiales.
function Avatar({ t, sport }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [t.photo]);
  const initials = (t.name || '?').split(/[\s/]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  if (t.photo && !bad) return (
    <span className="av photo"><img src={t.photo} alt="" onError={() => setBad(true)} />
      {t.logo && <img className="flag-badge" src={t.logo} alt="" />}</span>);
  if (t.logo) return (
    <span className={'av ' + (sport === 'tennis' ? 'flag' : 'logo')}>
      <img src={t.logo} alt="" />{t.logo2 && <img src={t.logo2} alt="" />}</span>);
  return <span className="av initials">{t.tbd ? '?' : initials}</span>;
}
