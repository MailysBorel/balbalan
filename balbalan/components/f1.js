'use client';
// Formule 1 : carte d'une séance (liste), bandeau « en direct » de l'accueil et page de détail d'une séance.
import Link from 'next/link';
import { useEffect, useState } from 'react';

const ymd = d => { const x = new Date(d); return x.getFullYear() + String(x.getMonth() + 1).padStart(2, '0') + String(x.getDate()).padStart(2, '0'); };
const hm = d => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const today = d => new Date(d).toDateString() === new Date().toDateString();
// heure seule si c'est aujourd'hui, sinon « jeu. 20 · 01:30 »
const when = d => today(d) ? hm(d) : `${new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })} · ${hm(d)}`;
const status = m => (m.state === 'pre' ? when(m.start) : m.state === 'post' ? 'Terminé' : m.status || 'En cours');
export const raceHref = m => `/match/f1/f1/${m.id}?d=${ymd(m.start)}`;

// Pilotes suivis (lus directement dans le stockage de l'appareil, mis à jour à chaque changement de favoris)
function useF1Favs() {
  const [names, setNames] = useState([]);
  useEffect(() => {
    const r = () => { try { setNames(JSON.parse(localStorage.getItem('favs') || '[]').filter(f => f.sport === 'f1').map(f => f.name)); } catch {} };
    r(); addEventListener('favs', r); return () => removeEventListener('favs', r);
  }, []);
  return names;
}

const Driver = ({ r, me }) => (
  <span className={'team drv' + (me ? ' me' : '')}><b className="pos">{r.pos ?? '–'}</b>{r.flag && <img src={r.flag} alt="" loading="lazy" />}{r.short}</span>);

// Carte : séance + podium (ou top 3 en direct) ; un pilote suivi hors du top 3 est ajouté en dessous
export function RaceCard({ m }) {
  const favs = useF1Favs();
  const top = m.results.slice(0, 3), mine = m.results.filter(r => favs.includes(r.name) && !top.includes(r));
  return (
    <Link href={raceHref(m)} className={'card race ' + m.state}>
      <span className="stripe" />
      <div className="mid"><span className="mono">{m.session}</span>
        {m.results.length ? [...top, ...mine].map(r => <Driver key={r.id} r={r} me={favs.includes(r.name)} />)
          : <span className="team tbd">{m.circuit || 'Formule 1'}</span>}
      </div>
      <div className="end"><span className="st">{status(m)}</span></div>
    </Link>
  );
}

// Jour sans F1 : on montre le Grand Prix en cours ou le prochain, avec toutes ses séances
export function NextGP() {
  const [list, setList] = useState(null);
  useEffect(() => {
    let on = true;
    fetch('/api/scores?sport=f1').then(r => r.json()).then(d => on && setList(d.matches || [])).catch(() => on && setList([]));
    return () => { on = false; };
  }, []);
  if (!list) return <div className="skel" />;
  if (!list.length) return <div className="empty">Aucune séance de F1 ce jour-là.</div>;
  const s = [...list].sort((a, b) => new Date(a.start) - new Date(b.start));
  const started = s.some(m => m.state !== 'pre');
  return (
    <section className="sec"><div className="empty f1-none">Pas de F1 ce jour-là.</div>
      <h2 className="mono">{started ? 'Grand Prix en cours' : 'Prochain Grand Prix'} · {s[0].leagueName}</h2>
      {s.map(m => <RaceCard key={m.id} m={m} />)}
    </section>);
}

// Bandeau de l'accueil quand une séance est en cours : leader en gros, P2 / P3 en dessous
export function RaceHero({ m }) {
  const [p1, p2, p3] = m.results;
  return (
    <Link href={raceHref(m)} className="hero race">
      <div className="row"><span>{m.leagueName} · {m.session}</span><span>● LIVE {m.status}</span></div>
      <div className="score">{p1 ? p1.short : m.session}</div>
      <div className="teams"><span>{p2 ? `2. ${p2.short}` : ''}</span><span>{p3 ? `3. ${p3.short}` : ''}</span></div>
    </Link>
  );
}

// Page de détail : classement complet (écurie, écart, points, places gagnées depuis la grille) + suivre un pilote
export function RaceDetail({ m, has, toggle }) {
  const date = new Date(m.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <>
      <div className="board race-board">
        {m.state === 'live' ? <span className="badge">LIVE · {m.status}</span> : <span className="mono">{m.state === 'post' ? 'Terminé' : date}</span>}
        <h1 className="gp">{m.leagueName}</h1>
        <span className="sess">{m.session}</span>
        {m.circuit && <span className="mono">{m.circuit}</span>}
        {m.state === 'pre' && <div className="score">{hm(m.start)}</div>}
      </div>
      {m.results.length ? (
        <div className="panel f1-table">
          {m.results.map(r => {
            const d = r.grid && r.pos ? r.grid - r.pos : 0, fav = has('f1', r.name);
            return (
              <div className={'f1-row' + (r.pos === 1 && m.state === 'post' ? ' win' : '') + (fav ? ' me' : '')} key={r.id}>
                <b className="pos">{r.pos ?? '–'}</b>
                <i className="team-bar" style={{ background: r.color || 'var(--line)' }} />
                <span className="who">
                  <span className="nm">{r.flag && <img src={r.flag} alt="" loading="lazy" />}{r.name}</span>
                  <span className="mono">{[r.team, r.grid && `grille ${r.grid}`].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="f1-res">
                  {r.time && <span className="time">{r.time}</span>}
                  {(d !== 0 || r.pts) && <span className="mono">{d > 0 ? <em className="up">▲{d}</em> : d < 0 ? <em className="down">▼{-d}</em> : null}{r.pts ? ` +${r.pts} pts` : ''}</span>}
                </span>
                <button className={'star' + (fav ? ' on' : '')} aria-label={fav ? `Ne plus suivre ${r.name}` : `Suivre ${r.name}`}
                  onClick={() => toggle('f1', { name: r.name, logo: r.flag })}>{fav ? '★' : '☆'}</button>
              </div>);
          })}
        </div>
      ) : <div className="empty">{m.state === 'pre' ? `Classement disponible dès le début de la séance (${hm(m.start)}).` : 'Classement pas encore disponible.'}</div>}
    </>
  );
}
