// Notifications push (côté app). Les favoris et les réglages sont envoyés au serveur à chaque changement,
// c'est lui qui surveille les matchs et envoie les notifs (lib/notify.js).
import { toFrench } from './countries';

// Mêmes types que lib/notify.js → TYPES
export const LABELS = {
  foot: { start: 'Coup d’envoi', goal: 'Buts', red: 'Cartons rouges', half: 'Mi-temps', end: 'Fin du match' },
  basket: { start: 'Début du match', quarter: 'Fin de chaque quart-temps', end: 'Fin du match' },
  tennis: { start: 'Début du match', set: 'Fin de chaque set', end: 'Fin du match', retire: 'Abandon' },
};

const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// Réglages : tout est activé par défaut
export const getPrefs = () => {
  const p = get('notifPrefs', {});
  return Object.fromEntries(Object.entries(LABELS).map(([s, ts]) => [s, Object.fromEntries(Object.keys(ts).map(t => [t, p?.[s]?.[t] !== false]))]));
};
export const setPrefs = p => { put('notifPrefs', p); sync(); };

// 'unsupported' : navigateur sans notifications push (sur iPhone : app pas encore ajoutée à l'écran d'accueil)
// 'denied' : refusées dans les réglages du téléphone · 'off' : coupées dans l'app · 'on' · 'ask' : jamais demandé
export function status() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (get('notifOff', false)) return 'off';
  return Notification.permission === 'granted' ? 'on' : 'ask';
}

const b64 = s => { const p = '='.repeat((4 - (s.length % 4)) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
const emit = () => dispatchEvent(new Event('notif'));

async function subscription(create) {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub && create) {
    const { key } = await (await fetch('/api/push')).json();
    if (!key) throw new Error('notifications non configurées sur le serveur');
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  }
  return sub;
}

// À appeler directement dans un clic (l'iPhone n'affiche la demande d'autorisation qu'après un geste)
export async function enable() {
  if (status() === 'unsupported') return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { emit(); return perm === 'denied' ? 'denied' : 'ask'; }
  put('notifOff', false);
  try { await post(await subscription(true), true); put('notifErr', null); } // + notif de test envoyée par le serveur
  catch (e) { put('notifErr', e?.message || String(e)); emit(); throw e; }
  emit(); return 'on';
}
// Dernière erreur d'activation (affichée dans le Profil), ou null
export const lastError = () => get('notifErr', null);

async function post(sub, test = false) {
  const favs = get('favs', []).map(f => ({ sport: f.sport, name: toFrench(f.name) || f.name }));
  const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON(), favs, prefs: getPrefs(), test }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || `erreur serveur ${r.status}`);
}

export async function disable() {
  put('notifOff', true);
  try {
    const sub = await subscription(false);
    if (sub) { await fetch('/api/push', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
  } catch {}
  emit();
}

// Envoie les favoris + réglages au serveur (si les notifs sont actives)
export async function sync(sub) {
  if (status() !== 'on') return;
  try { await post(sub ?? await subscription(true)); if (lastError()) { put('notifErr', null); emit(); } }
  catch (e) { put('notifErr', e?.message || String(e)); emit(); }
}

// Ajout d'un favori : notifs activées par défaut (demande l'autorisation la 1re fois, sauf si l'utilisateur les a coupées)
export function onFavAdded() {
  const s = status();
  if (s === 'ask') enable().catch(() => {}); else if (s === 'on') sync();
}
