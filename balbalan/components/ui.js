'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export const Logo = ({ s = 32 }) => (
  <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="#F4F1E8" />
    <g fill="none" stroke="#0B0D2B" strokeWidth="3.5" strokeLinecap="round"><path d="M8 18C17 23 31 23 40 18" /><path d="M8 30C17 25 31 25 40 30" /><path d="M24 4.5C19 14 19 34 24 43.5" /></g></svg>
);
export const localYmd = d => { const x = new Date(d); return x.getFullYear() + String(x.getMonth() + 1).padStart(2, '0') + String(x.getDate()).padStart(2, '0'); };
export const fmtTime = d => {
  const x = new Date(d), h = x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return x.toDateString() === new Date().toDateString() ? h : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + h;
};
export const statusText = m => (m.state === 'pre' ? fmtTime(m.start) : m.state === 'post' ? 'Terminé' : m.status || 'Live');
const lead = m => { const a = +m.home.score, b = +m.away.score; return a > b ? 0 : b > a ? 1 : -1; };
const Team = ({ t }) => <span className="team">{t.logo && <img src={t.logo} alt="" loading="lazy" />}{t.short}</span>;

export function MatchCard({ m }) {
  const pre = m.state === 'pre', l = lead(m);
  const [a, b] = m.sport === 'tennis' ? [m.home.lines.join(' '), m.away.lines.join(' ')] : [m.home.score, m.away.score];
  return (
    <Link href={`/match/${m.sport}/${m.league}/${m.id}?d=${localYmd(m.start)}`} className={'card ' + m.state}>
      <span className="stripe" />
      <div className="mid"><span className="mono">{m.leagueName}</span><Team t={m.home} /><Team t={m.away} /></div>
      <div className="end"><span className="st">{statusText(m)}</span>
        <span className={'sc ' + (l === 0 ? 'w' : '')}>{pre ? '–' : a || '0'}</span>
        <span className={'sc ' + (l === 1 ? 'w' : '')}>{pre ? '–' : b || '0'}</span></div>
    </Link>
  );
}

const I = {
  matchs: <path d="M3 10h18M8 2.5v4M16 2.5v4M6 4.5h12a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3Z" />,
  live: <><circle cx="12" cy="12" r="2.5" fill="currentColor" /><path d="M8 8a5.7 5.7 0 0 0 0 8M16 8a5.7 5.7 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" /></>,
  classements: <path d="M3 21h18M5 21v-6h4v6M10 21V9h4v12M15 21v-8h4v8" />,
  profil: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
};
export function TabBar({ tab, set }) {
  return (
    <nav className="tabbar">{Object.keys(I).map(k => (
      <button key={k} className={'tab ' + (tab === k ? 'on' : '')} onClick={() => set(k)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{I[k]}</svg>{k.toUpperCase()}
      </button>))}</nav>
  );
}

export function InstallHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    let off = false; try { off = !!localStorage.getItem('hint-off'); } catch {}
    setShow(ios && !standalone && !off);
  }, []);
  if (!show) return null;
  return (
    <div className="hint"><span>Installe Balbalan : touche <b>Partager</b> puis <b>Sur l’écran d’accueil</b>.</span>
      <button aria-label="Fermer" onClick={() => { setShow(false); try { localStorage.setItem('hint-off', '1'); } catch {} }}>✕</button></div>
  );
}
export function SW() {
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}); }, []);
  return null;
}
