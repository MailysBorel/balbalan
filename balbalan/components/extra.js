'use client';
import { useEffect, useState } from 'react';

export function useFavs() {
  const [favs, setF] = useState([]);
  useEffect(() => {
    const r = () => { try { setF(JSON.parse(localStorage.getItem('favs') || '[]')); } catch {} };
    r(); addEventListener('favs', r); return () => removeEventListener('favs', r);
  }, []);
  const save = n => { try { localStorage.setItem('favs', JSON.stringify(n)); } catch {} dispatchEvent(new Event('favs')); };
  const has = (sport, name) => favs.some(x => x.sport === sport && x.name === name);
  const toggle = (sport, t) => save(has(sport, t.name) ? favs.filter(x => !(x.sport === sport && x.name === t.name)) : [...favs, { sport, name: t.name, logo: t.logo }]);
  return { favs, has, toggle };
}

const day = n => new Date(Date.now() + n * 864e5);
export function DateStrip({ off, set }) {
  const label = n => (n === 0 ? 'Auj.' : n === -1 ? 'Hier' : n === 1 ? 'Dem.' : day(n).toLocaleDateString('fr-FR', { weekday: 'short' }));
  return (
    <div className="dates">{[-3, -2, -1, 0, 1, 2, 3].map(n => (
      <button key={n} className={n === off ? 'on' : ''} onClick={() => set(n)}><span>{label(n)}</span><b>{day(n).getDate()}</b></button>))}</div>
  );
}

export function Standings({ sport }) {
  const [g, setG] = useState(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    let on = true; setG(null); setI(0);
    fetch('/api/standings?sport=' + sport).then(r => r.json()).then(d => on && setG(d.groups || [])).catch(() => on && setG([]));
    return () => { on = false; };
  }, [sport]);
  if (!g) return <div className="skel big" />;
  if (!g.length) return <div className="empty">Classement indisponible pour le moment.</div>;
  const cur = g[i] || g[0];
  return (
    <>
      <div className="chips scroll">{g.map((x, k) => <button key={k} className={'chip ' + (k === i ? 'on' : '')} onClick={() => setI(k)}>{x.name}</button>)}</div>
      <div className="panel table" style={{ "--n": cur.cols.length }}>
        <div className="tr th"><span>#</span><span>{sport === 'tennis' ? 'Joueur' : 'Équipe'}</span>{cur.cols.map(c => <b key={c}>{c}</b>)}</div>
        {cur.rows.map(r => (
          <div className="tr" key={r.rank + r.name}><span>{r.rank}</span>
            <span className="team">{r.logo && <img src={r.logo} alt="" loading="lazy" />}{r.name}</span>
            {r.cols.map((c, k) => <b key={k}>{c ?? '–'}</b>)}</div>))}
      </div>
    </>
  );
}

export function Profile({ sports, setSport, sport }) {
  const { favs, toggle } = useFavs();
  return (
    <>
      <section className="sec"><h2 className="mono">Mes équipes · {favs.length}</h2>
        {favs.length ? favs.map(f => (
          <div className="card" key={f.sport + f.name}><span className="stripe" style={{ background: `var(--c-${f.sport})` }} />
            <span className="team" style={{ flex: 1 }}>{f.logo && <img src={f.logo} alt="" />}{f.name}</span>
            <button className="fav on" onClick={() => toggle(f.sport, f)}>★</button></div>))
          : <div className="empty">Ouvre un match et touche « ☆ Suivre » sous une équipe ou un joueur pour le retrouver ici et en haut de l’accueil.</div>}
      </section>
      <section className="sec"><h2 className="mono">Sport à l’ouverture</h2>
        <div className="chips">{sports.map(([k, n]) => <button key={k} className={'chip ' + (sport === k ? 'on' : '')} onClick={() => setSport(k)}>{n}</button>)}</div></section>
    </>
  );
}
