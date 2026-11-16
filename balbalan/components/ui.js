'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RaceCard } from './f1';

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
// Tennis : un chiffre par manche, surligné pour le joueur qui l'a gagnée (sauf la manche en cours).
const Sets = ({ m, me, op }) => me.lines.map((v, i) => {
  const done = !(m.state === 'live' && i === me.lines.length - 1), won = done && +v > +(op.lines[i] ?? -1);
  return <span key={i} className={'set' + (won ? ' w' : '')}>{v}</span>;
});
const Team = ({ t }) => <span className={'team' + (t.tbd ? ' tbd' : '')}>{t.logo && <img src={t.logo} alt="" loading="lazy" />}{t.logo2 && <img src={t.logo2} alt="" loading="lazy" />}{t.short}</span>;

export function MatchCard({ m, label }) {
  if (m.sport === 'f1') return <RaceCard m={m} />;
  const pre = m.state === 'pre', l = lead(m);
  const tennis = m.sport === 'tennis' && m.home.lines.length > 0;
  const [a, b] = tennis ? [<Sets m={m} me={m.home} op={m.away} />, <Sets m={m} me={m.away} op={m.home} />] : [m.home.score, m.away.score];
  return (
    <Link href={`/match/${m.sport}/${m.league}/${m.id}?d=${localYmd(m.start)}`} className={'card ' + m.state}>
      <span className="stripe" />
      <div className="mid">{(label ?? m.leagueName) && <span className="mono">{label ?? m.leagueName}</span>}<Team t={m.home} /><Team t={m.away} /></div>
      <div className="end"><span className="st">{statusText(m)}</span>
        <span className={'sc ' + (tennis ? 'sets' : l === 0 ? 'w' : '')}>{pre ? '–' : a || '0'}</span>
        <span className={'sc ' + (tennis ? 'sets' : l === 1 ? 'w' : '')}>{pre ? '–' : b || '0'}</span></div>
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

// Pop-up « installer l'app » : s'affiche 3 s après l'arrivée, sur mobile uniquement,
// jamais si l'app est déjà installée ou si l'utilisateur l'a fermée.
export function InstallHint() {
  const [os, setOs] = useState(null); // 'ios' | 'android' | null
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    const android = /android/i.test(ua);
    const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    let off = false; try { off = !!localStorage.getItem('install-hint-off'); } catch {}
    const onPrompt = e => { e.preventDefault(); setPrompt(e); };
    addEventListener('beforeinstallprompt', onPrompt);
    const t = (ios || android) && !standalone && !off ? setTimeout(() => setOs(ios ? 'ios' : 'android'), 3000) : null;
    return () => { clearTimeout(t); removeEventListener('beforeinstallprompt', onPrompt); };
  }, []);
  if (!os) return null;
  const close = () => { setOs(null); try { localStorage.setItem('install-hint-off', '1'); } catch {} };
  const install = async () => { prompt.prompt(); try { await prompt.userChoice; } catch {} close(); };
  const share = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>;
  const plus = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></svg>;
  return (
    <div className="sheet-bg" onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="ih-t" onClick={e => e.stopPropagation()}>
        <button className="x" aria-label="Fermer" onClick={close}>✕</button>
        <img src="/icon-192.png" alt="" width="56" height="56" />
        <h3 id="ih-t">Ajoute Balbalan à ton écran d’accueil</h3>
        <p>Retrouve tes scores en un geste, comme une vraie app.</p>
        {os === 'android' && prompt ? <button className="cta" onClick={install}>Installer l’app</button> : (
          <ol>
            {os === 'ios'
              ? <><li><span className="ic">{share}</span>Touche <b>Partager</b> en bas de l’écran</li>
                  <li><span className="ic">{plus}</span>Puis <b>Sur l’écran d’accueil</b></li></>
              : <><li><span className="ic">⋮</span>Ouvre le <b>menu</b> du navigateur</li>
                  <li><span className="ic">{plus}</span>Puis <b>Ajouter à l’écran d’accueil</b></li></>}
          </ol>)}
        <button className="later" onClick={close}>Plus tard</button>
      </div>
    </div>
  );
}
export function SW() {
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}); }, []);
  return null;
}
