'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo, MatchCard, TabBar, InstallHint, localYmd } from '../components/ui';
import { DateStrip, Standings, Profile, CompGroups, Search, useFavs } from '../components/extra';
const SPORTS = [['foot', 'Foot'], ['basket', 'Basket'], ['tennis', 'Tennis']];

export default function Home() {
  const [sport, setSport] = useState('foot');
  const [tab, setTab] = useState('matchs');
  const [off, setOff] = useState(0);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [searching, setSearching] = useState(false);
  const { favs } = useFavs();
  const date = localYmd(Date.now() + (tab === 'live' ? 0 : off) * 864e5);

  useEffect(() => { try { const s = localStorage.getItem('sport'); if (s) setSport(s); } catch {} }, []);
  useEffect(() => {
    try { localStorage.setItem('sport', sport); } catch {}
    if (tab === 'classements' || tab === 'profil') return;
    let on = true; setData(null); setErr(false);
    const load = () => fetch(`/api/scores?sport=${sport}&date=${date}`).then(r => r.json())
      .then(d => { if (on) { setData(d.matches || []); setErr(!!d.error); } }).catch(() => on && setErr(true));
    load();
    const t = date === localYmd(Date.now()) ? setInterval(() => document.visibilityState === 'visible' && load(), 20000) : null;
    const wake = () => document.visibilityState === 'visible' && load(); // retour au premier plan : scores à jour tout de suite
    document.addEventListener('visibilitychange', wake);
    return () => { on = false; clearInterval(t); document.removeEventListener('visibilitychange', wake); };
  }, [sport, date, tab]);

  const all = (data || []).filter(m => localYmd(m.start) === date);
  const live = all.filter(m => m.state === 'live');
  const mine = all.filter(m => favs.some(f => f.sport === sport && (f.name === m.home.name || f.name === m.away.name)));
  const hero = live[0];
  const Sec = ({ t, list }) => list.length ? (
    <section className="sec"><h2 className="mono">{t} · {list.length}</h2>{list.map(m => <MatchCard key={m.id} m={m} />)}</section>) : null;
  const chips = <div className="chips">{SPORTS.map(([k, n]) => <button key={k} className={'chip ' + (sport === k ? 'on' : '')} onClick={() => setSport(k)}>{n}</button>)}</div>;

  return (
    <div className="app" data-sport={sport}>
      <header className="head"><div className="brand"><Logo />Balbalan</div>
        <div className="head-r"><span className="mono">{new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <button className="icon" aria-label="Rechercher" onClick={() => setSearching(true)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg></button></div></header>
      {searching && <Search matches={all} onClose={() => setSearching(false)} />}
      <InstallHint />
      {tab === 'profil' ? <Profile sports={SPORTS} sport={sport} setSport={setSport} />
        : tab === 'classements' ? <>{chips}<Standings sport={sport} /></>
        : <>
          {chips}
          {tab === 'matchs' && <DateStrip off={off} set={setOff} />}
          {err ? <div className="empty">Impossible de charger les scores. Nouvel essai dans 20 s.</div>
            : data === null ? <><div className="skel big" /><div className="skel" /><div className="skel" /></>
            : <>
              {hero && <Link href={`/match/${hero.sport}/${hero.league}/${hero.id}?d=${date}`} className="hero">
                <div className="row"><span>{hero.leagueName}</span><span>● LIVE {hero.status}</span></div>
                <div className="score">{hero.home.score ?? 0}—{hero.away.score ?? 0}</div>
                <div className="teams"><span>{hero.home.short}</span><span>{hero.away.short}</span></div></Link>}
              {tab === 'matchs' && <Sec t="Mes équipes" list={mine} />}
              <CompGroups list={tab === 'live' ? live : all} sport={sport} />
              {(tab === 'live' ? !live.length : !all.length) && <div className="empty">{tab === 'live' ? 'Aucun match en direct.' : 'Aucun match ce jour-là.'}</div>}
            </>}
        </>}
      <TabBar tab={tab} set={setTab} />
    </div>
  );
}
