'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFavs } from '../../../../../components/extra';

const RES = { V: 'Victoire', N: 'Nul', D: 'Défaite' };
const date = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const time = d => new Date(d).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const ymd = d => { const x = new Date(d); return x.getFullYear() + String(x.getMonth() + 1).padStart(2, '0') + String(x.getDate()).padStart(2, '0'); };

export default function Team() {
  const { sport, league, id } = useParams();
  const router = useRouter();
  const [d, setD] = useState(null);
  const { has, toggle } = useFavs();
  useEffect(() => {
    let on = true;
    fetch(`/api/team?sport=${sport}&league=${league}&id=${id}`).then(r => r.json()).then(x => on && setD(x)).catch(() => on && setD({ error: 1 }));
    return () => { on = false; };
  }, [sport, league, id]);
  const t = d?.team, form = (d?.past || []).slice(0, 5);
  const Row = ({ m }) => (
    <Link className="mrow" href={`/match/${sport}/${m.league}/${m.id}?d=${ymd(m.date)}`}>
      {m.result ? <span className={'res r' + m.result} title={RES[m.result]}>{m.result}</span> : <span className="res">–</span>}
      <span className="mid"><span className="team">{m.opp.logo && <img src={m.opp.logo} alt="" loading="lazy" />}{m.opp.logo2 && <img src={m.opp.logo2} alt="" loading="lazy" />}{m.opp.name}</span>
        <span className="mono">{[m.state === 'post' ? date(m.date) : time(m.date), sport === 'tennis' ? m.round : m.home ? 'Dom.' : 'Ext.', m.leagueName].filter(Boolean).join(' · ')}</span></span>
      {m.sets?.length ? <span className="tsets" title={m.score}>{m.sets.map(([a, b], i) => (
          <span className="tset" key={i}><b className={+a > +b ? 'w' : ''}>{a}</b><b className={+b > +a ? 'w' : ''}>{b}</b></span>))}
          {m.note && <span className="mono">{m.note}</span>}</span>
        : m.score && <b className="sc">{Array.isArray(m.score) ? `${m.score[0]}-${m.score[1]}` : m.score}</b>}
    </Link>);
  return (
    <div className="app" data-sport={sport}>
      <button className="back" onClick={() => (history.length > 1 ? router.back() : router.push('/'))}>← <span className="mono">Retour</span></button>
      {d?.error ? <div className="empty">{sport === 'tennis' ? 'Joueur introuvable' : 'Équipe introuvable'} ou données indisponibles.</div>
        : !t ? <><div className="skel big" /><div className="skel" /><div className="skel" /></>
        : <>
          <div className="board">
            {sport === 'tennis' ? <PlayerPhoto t={t} /> : t.logo && <span className="av logo"><img src={t.logo} alt="" /></span>}
            <h1 className="tname">{t.name}</h1>
            {t.details && <span className="mono">{t.details}</span>}
            {t.record && <span className="mono">Bilan {t.recordLeague} {sport === 'foot' ? '(V-N-D)' : '(V-D)'} · {t.record}</span>}
            <button className={'fav ' + (has(sport, t.name) ? 'on' : '')} onClick={() => toggle(sport, t)}>{has(sport, t.name) ? '★ Suivi' : '☆ Suivre'}</button>
          </div>
          {form.length > 0 && <section className="sec"><h2 className="mono">Forme · {form.length} derniers matchs</h2>
            <div className="form">{form.map(m => <span key={m.id} className={'res big r' + m.result} title={`${RES[m.result]} contre ${m.opp.name}`}>{m.result}</span>)}</div></section>}
          {d.next.length > 0 && <section className="sec"><h2 className="mono">Prochains matchs</h2>
            <div className="panel list">{d.next.map(m => <Row key={m.id} m={m} />)}</div></section>}
          <section className="sec"><h2 className="mono">Derniers matchs</h2>
            {d.past.length ? <div className="panel list">{d.past.map(m => <Row key={m.id} m={m} />)}</div>
              : <div className="empty">Aucun match joué pour l’instant.</div>}</section>
        </>}
    </div>
  );
}

// Photo du joueur (si ESPN en a une) avec son drapeau ; sinon le drapeau seul.
function PlayerPhoto({ t }) {
  const [bad, setBad] = useState(false);
  if (!bad) return <span className="av photo"><img src={t.photo} alt="" onError={() => setBad(true)} />{t.logo && <img className="flag-badge" src={t.logo} alt="" />}</span>;
  return t.logo ? <span className="av flag"><img src={t.logo} alt="" /></span> : null;
}
