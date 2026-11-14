'use client';
import { useEffect, useState } from 'react';
import { MatchCard } from './ui';
import { norm, toFrench } from '../lib/countries';

// Matchs regroupés par compétition, chaque groupe se plie/déplie (mémorisé sur l'appareil).
export function CompGroups({ list, sport }) {
  const [closed, setClosed] = useState([]);
  useEffect(() => { try { setClosed(JSON.parse(localStorage.getItem('closed') || '[]')); } catch {} }, []);
  const toggle = k => setClosed(c => {
    const n = c.includes(k) ? c.filter(x => x !== k) : [...c, k];
    try { localStorage.setItem('closed', JSON.stringify(n)); } catch {}
    return n;
  });
  const groups = [];
  for (const m of list) {
    let g = groups.find(x => x.name === m.leagueName);
    if (!g) groups.push(g = { name: m.leagueName, order: m.order ?? 99, list: [] });
    g.list.push(m);
  }
  const live = g => g.list.some(m => m.state === 'live');
  groups.sort((a, b) => live(b) - live(a) || a.order - b.order || a.name.localeCompare(b.name));
  return groups.map(g => {
    const k = sport + ':' + g.name, open = !closed.includes(k), id = 'cg-' + k.replace(/\W/g, '-');
    return (
      <section className="sec" key={k}>
        <button className="comp" aria-expanded={open} aria-controls={id} onClick={() => toggle(k)}>
          <span className="name">{g.name}</span>
          {live(g) && <span className="dot" aria-label="en direct" />}
          <span className="mono">{g.list.length}</span>
          <svg className="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {open && <div className="sec" id={id}>{g.list.map(m => <MatchCard key={m.id} m={m} />)}</div>}
      </section>
    );
  });
}

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
            <span className="team">{r.logo && <img src={r.logo} alt="" loading="lazy" />}{toFrench(r.name) || r.name}</span>
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

// Écran de recherche : matchs du jour (filtre local) + équipes/joueurs ESPN qu'on peut suivre.
export function Search({ matches, onClose }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null); // null = en cours
  const [err, setErr] = useState(false);
  const { has, toggle } = useFavs();
  useEffect(() => {
    const k = e => e.key === 'Escape' && onClose();
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [onClose]);
  useEffect(() => {
    setRes(null); setErr(false);
    if (q.trim().length < 2) return;
    let on = true;
    const t = setTimeout(() => fetch('/api/search?q=' + encodeURIComponent(q.trim())).then(r => r.json())
      .then(d => { if (on) { setRes(d.results || []); setErr(!!d.error); } })
      .catch(() => { if (on) { setRes([]); setErr(true); } }), 300);
    return () => { on = false; clearTimeout(t); };
  }, [q]);
  const n = norm(q.trim());
  const hit = t => [t.name, t.short, toFrench(t.name)].some(x => norm(x).includes(n)); // « maroc » trouve Morocco
  const found = n.length >= 2 ? (matches || []).filter(m => hit(m.home) || hit(m.away) || norm(m.leagueName).includes(n)) : [];
  return (
    <div className="search" role="dialog" aria-modal="true" aria-label="Recherche">
      <div className="sbar">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        <input autoFocus type="search" enterKeyHint="search" placeholder="Équipe, joueur, compétition…" value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher" />
        <button className="cancel" onClick={onClose}>Annuler</button>
      </div>
      {n.length < 2 ? <div className="empty">Tape au moins 2 lettres. Ex. : PSG, Sinner, Lakers…</div> : <>
        {found.length > 0 && <section className="sec"><h2 className="mono">Matchs du jour · {found.length}</h2>{found.map(m => <MatchCard key={m.id} m={m} />)}</section>}
        <section className="sec"><h2 className="mono">Équipes & joueurs</h2>
          {res === null ? <><div className="skel" /><div className="skel" /></>
            : err ? <div className="empty">Recherche indisponible pour le moment.</div>
            : !res.length ? <div className="empty">Aucun résultat pour « {q.trim()} ».</div>
            : res.map(r => (
              <div className="card" key={r.sport + r.name}><span className="stripe" style={{ background: `var(--c-${r.sport})` }} />
                <span className="mid"><span className="team">{r.logo && <img src={r.logo} alt="" loading="lazy" />}{r.label || r.name}</span>
                  {r.sub && <span className="mono">{r.sub}</span>}</span>
                <button className={'fav ' + (has(r.sport, r.name) ? 'on' : '')} onClick={() => toggle(r.sport, r)}>{has(r.sport, r.name) ? '★ Suivi' : '☆ Suivre'}</button>
              </div>))}
        </section>
      </>}
    </div>
  );
}
