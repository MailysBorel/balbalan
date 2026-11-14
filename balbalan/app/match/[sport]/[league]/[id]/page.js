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
  const { has, toggle } = useFavs();
  useEffect(() => {
    let on = true;
    const date = new URLSearchParams(location.search).get('d') || '';
    const load = () => fetch(`/api/match?sport=${sport}&league=${league}&id=${id}&date=${date}`).then(r => r.json())
      .then(x => on && setD(x)).catch(() => on && setD({ error: 1 }));
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 20000);
    return () => { on = false; clearInterval(t); };
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
            {m.state === 'live' ? <span className="badge">LIVE · {m.status}</span> : <span className="mono">{statusText(m)}</span>}
            <div className="score">{m.state === 'pre' ? fmtTime(m.start) : `${m.home.score ?? 0}—${m.away.score ?? 0}`}</div>
            <div className="teams"><span>{m.home.name}</span><span>{m.away.name}</span></div>
            <div className="teams">{[m.home, m.away].map((t, i) => <button key={i} className={'fav ' + (has(sport, t.name) ? 'on' : '')} onClick={() => toggle(sport, t)}>{has(sport, t.name) ? '★ Suivi' : '☆ Suivre'}</button>)}</div>
            {lines && <span className="mono">{lines}</span>}
          </div>
          <div className="seg">{[['stats', 'Stats'], ['resume', 'Temps forts']].map(([k, n]) =>
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}</div>
          {tab === 'stats' ? (d.stats?.length ? <div className="panel">{d.stats.map(s => {
            const a = parseFloat(s.home) || 0, b = parseFloat(s.away) || 0, r = a + b ? a / (a + b) : 0.5;
            return <div className="stat" key={s.label}><div className="r">{s.home}<span>{s.label}</span>{s.away}</div>
              <div className="bar"><i style={{ flex: r }} /><i style={{ flex: 1 - r }} /></div></div>;
          })}</div> : <div className="empty">Statistiques pas encore disponibles.</div>)
          : (d.events?.length ? <div className="panel">{d.events.map((e, i) =>
            <div className="ev" key={i}><b>{e.time}</b><span>{e.text}</span></div>)}</div>
            : <div className="empty">Aucun temps fort pour l’instant.</div>)}
        </>}
    </div>
  );
}
