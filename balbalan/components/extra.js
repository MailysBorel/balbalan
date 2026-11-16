'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MatchCard } from './ui';
import { norm, toFrench } from '../lib/countries';
import { LABELS, getPrefs, setPrefs, status as pushStatus, enable as enablePush, disable as disablePush, sync as syncPush, onFavAdded, lastError as lastPushError } from '../lib/push-client';

// Matchs regroupés par compétition, chaque groupe se plie/déplie (mémorisé sur l'appareil).
// Tennis : circuit (ATP, WTA…) › tournoi › simple / double.
const isLive = list => list.some(m => m.state === 'live');
function groupBy(list, key, order = () => 0) {
  const gs = [];
  for (const m of list) {
    const name = key(m) || '';
    let g = gs.find(x => x.name === name);
    if (!g) gs.push(g = { name, order: order(m), list: [] });
    g.list.push(m);
  }
  return gs.sort((a, b) => isLive(b.list) - isLive(a.list) || a.order - b.order || a.name.localeCompare(b.name));
}
const CIRCUITS = ['ATP', 'WTA', 'Challenger', 'ATP 125', 'WTA 125'];
const DRAWS = ['Simple', 'Double', 'Double mixte'];

function Group({ k, name, items, level, closed, toggle, children }) {
  const open = !closed.includes(k), id = 'cg-' + k.replace(/\W/g, '-');
  return (
    <section className={'sec' + (level === 2 ? ' sub-group' : '')}>
      <button className={'comp' + (level === 1 ? ' top' : '')} aria-expanded={open} aria-controls={id} onClick={() => toggle(k)}>
        <span className="name">{name}</span>
        {isLive(items) && <span className="dot" aria-label="en direct" />}
        <span className="mono">{items.length}</span>
        <svg className="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && <div className="sec" id={id}>{children}</div>}
    </section>
  );
}

export function CompGroups({ list, sport }) {
  const [closed, setClosed] = useState([]);
  useEffect(() => { try { setClosed(JSON.parse(localStorage.getItem('closed') || '[]')); } catch {} }, []);
  const toggle = k => setClosed(c => {
    const n = c.includes(k) ? c.filter(x => x !== k) : [...c, k];
    try { localStorage.setItem('closed', JSON.stringify(n)); } catch {}
    return n;
  });
  const st = { closed, toggle };

  if (sport === 'tennis') {
    return groupBy(list, m => m.circuit || m.league.toUpperCase(), m => { const i = CIRCUITS.indexOf(m.circuit); return i < 0 ? 99 : i; }).map(c => (
      <Group key={c.name} k={'tennis:c:' + c.name} name={c.name} items={c.list} level={1} {...st}>
        {groupBy(c.list, m => m.tournament || m.leagueName).map(t => (
          <Group key={t.name} k={'tennis:t:' + t.name} name={t.name} items={t.list} level={2} {...st}>
            {groupBy(t.list, m => m.draw || 'Simple', m => DRAWS.indexOf(m.draw)).map(d => (
              <div className="sec" key={d.name}>
                <h3 className="mono draw">{d.name} · {d.list.length}</h3>
                {d.list.map(m => <MatchCard key={m.id} m={m} label={m.round || ''} />)}
              </div>))}
          </Group>))}
      </Group>));
  }
  return groupBy(list, m => m.leagueName, m => m.order ?? 99).map(g => (
    <Group key={g.name} k={sport + ':' + g.name} name={g.name} items={g.list} level={1} {...st}>
      {g.list.map(m => <MatchCard key={m.id} m={m} />)}
    </Group>));
}

const fr = n => toFrench(n) || n;
export function useFavs() {
  const [favs, setF] = useState([]);
  useEffect(() => {
    // noms en français (les anciens favoris étaient parfois enregistrés en anglais : « Belgium » → « Belgique »)
    const r = () => { try { setF(JSON.parse(localStorage.getItem('favs') || '[]').map(x => ({ ...x, name: fr(x.name) }))); } catch {} };
    r(); addEventListener('favs', r); return () => removeEventListener('favs', r);
  }, []);
  const save = n => { try { localStorage.setItem('favs', JSON.stringify(n)); } catch {} dispatchEvent(new Event('favs')); };
  const has = (sport, name) => favs.some(x => x.sport === sport && x.name === fr(name));
  const toggle = (sport, t) => {
    const added = !has(sport, t.name);
    save(added ? [...favs, { sport, name: fr(t.name), logo: t.logo }] : favs.filter(x => !(x.sport === sport && x.name === fr(t.name))));
    if (added) onFavAdded(); else syncPush(); // notifs activées par défaut pour un nouveau favori
  };
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

const cells = r => (<><span>{r.rank}</span>
  <span className="team">{r.logo && <img src={r.logo} alt="" loading="lazy" />}{toFrench(r.name) || r.name}</span>
  {r.cols.map((c, k) => <b key={k}>{c ?? '–'}</b>)}</>);
export function Standings({ sport }) {
  const [g, setG] = useState(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    let on = true; setG(null);
    try { setI(+sessionStorage.getItem('standings:' + sport) || 0); } catch { setI(0); } // ATP / WTA… gardé au retour
    fetch('/api/standings?sport=' + sport).then(r => r.json()).then(d => on && setG(d.groups || [])).catch(() => on && setG([]));
    return () => { on = false; };
  }, [sport]);
  if (!g) return <div className="skel big" />;
  if (!g.length) return <div className="empty">Classement indisponible pour le moment.</div>;
  const cur = g[i] || g[0];
  return (
    <>
      <div className="chips scroll">{g.map((x, k) => <button key={k} className={'chip ' + (k === i ? 'on' : '')} onClick={() => { setI(k); try { sessionStorage.setItem('standings:' + sport, k); } catch {} }}>{x.name}</button>)}</div>
      <div className="panel table" style={{ "--n": cur.cols.length }}>
        <div className="tr th"><span>#</span><span>{sport === 'tennis' ? 'Joueur' : 'Équipe'}</span>{cur.cols.map(c => <b key={c}>{c}</b>)}</div>
        {cur.rows.map(r => (
          (r.id ? <Link className="tr link" href={`/team/${sport}/${r.league}/${r.id}`} key={r.rank + r.name}>{cells(r)}</Link>
            : <div className="tr" key={r.rank + r.name}>{cells(r)}</div>)))}
      </div>
    </>
  );
}

// Réglages des notifications : interrupteur général + choix des événements par sport.
const Switch = ({ on, onClick, label, disabled }) => (
  <button className={'switch' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick}><i /></button>);
function Notifs({ sports }) {
  const [st, setSt] = useState(null), [prefs, setP] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState(null);
  useEffect(() => {
    const r = () => { setSt(pushStatus()); setP(getPrefs()); setErr(lastPushError()); };
    r(); addEventListener('notif', r); return () => removeEventListener('notif', r);
  }, []);
  if (!st) return null;
  const on = st === 'on';
  const main = async () => { setBusy(true); try { on ? await disablePush() : await enablePush(); } catch {} setBusy(false); setSt(pushStatus()); setErr(lastPushError()); };
  const flip = (s, t) => { const p = { ...prefs, [s]: { ...prefs[s], [t]: !prefs[s][t] } }; setP(p); setPrefs(p); };
  return (
    <section className="sec"><h2 className="mono">Notifications</h2>
      {st === 'unsupported' ? <div className="empty">Pour recevoir les notifs (buts, fin de match…), ajoute Balbalan à l’écran d’accueil : Safari → Partager → « Sur l’écran d’accueil », puis ouvre l’app depuis son icône.</div>
        : st === 'denied' ? <div className="empty">Notifications bloquées sur ce téléphone. Autorise-les dans Réglages → Notifications → Balbalan.</div>
        : <>
          <div className="card ntf-main"><span className="mid"><b>Notifications</b>
            <span className="mono">{on ? 'Pour tes équipes et joueurs suivis' : 'Désactivées'}</span></span>
            <Switch on={on} onClick={main} disabled={busy} label="Notifications" /></div>
          {err && <div className="empty ntf-err">Les notifications n’ont pas pu être activées : {err}</div>}
          {on && sports.map(([s, n]) => (
            <div className="panel ntf" data-sport={s} key={s}><h3>{n}</h3>
              {Object.entries(LABELS[s]).map(([t, l]) => (
                <div className="ntf-row" key={t}><span>{l}</span><Switch on={prefs[s][t]} onClick={() => flip(s, t)} label={`${n} : ${l}`} /></div>))}
            </div>))}
        </>}
    </section>
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
      <Notifs sports={sports} />
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
                {(() => {
                  const body = <><span className="team">{r.logo && <img src={r.logo} alt="" loading="lazy" />}{r.label || r.name}{r.href && <span className="go" aria-hidden="true">›</span>}</span>
                    {r.sub && <span className="mono">{r.sub}</span>}</>;
                  return r.href ? <Link href={r.href} className="mid">{body}</Link> : <span className="mid">{body}</span>;
                })()}
                <button className={'fav ' + (has(r.sport, r.name) ? 'on' : '')} onClick={() => toggle(r.sport, r)}>{has(r.sport, r.name) ? '★ Suivi' : '☆ Suivre'}</button>
              </div>))}
        </section>
      </>}
    </div>
  );
}
