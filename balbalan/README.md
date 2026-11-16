# Balbalan — PWA scores en direct (foot, basket, tennis)

## Lancer en local
npm install
npm run dev        → http://localhost:3000

## Mettre en ligne (gratuit)
1. Pousse le dossier sur GitHub.
2. Sur vercel.com : « Add New Project » → choisis le repo → Deploy.
3. Partage le lien. Sur iPhone : Safari → Partager → « Sur l’écran d’accueil ».

## Notifications (buts, cartons rouges, fin de match, sets…)
Elles marchent sur iPhone (iOS 16.4+) quand l'app est ajoutée à l'écran d'accueil, et sur Android / ordinateur.
Mise en place, une seule fois :
1. **Clés** : `.env.local` (non versionné) contient `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `CRON_SECRET`.
   Recopie-les dans Vercel → ton projet → Settings → Environment Variables. Ne change plus les clés VAPID ensuite
   (sinon tous les abonnements deviennent invalides).
2. **Base de données** : Vercel → ton projet → Storage → Create → Upstash (Redis), offre gratuite → Connect.
   Vercel ajoute tout seul `KV_REST_API_URL` et `KV_REST_API_TOKEN`. Redéploie le projet.
3. **Surveillance des matchs** : sur cron-job.org (gratuit), crée une tâche qui appelle toutes les minutes
   `https://<ton-site>.vercel.app/api/cron?key=<CRON_SECRET>`.

Fonctionnement : quand on suit une équipe / un joueur, l'app demande l'autorisation puis envoie ses favoris et réglages
à `/api/push`. Chaque minute, `/api/cron` compare les matchs suivis à leur état de la minute précédente et envoie
une notif par événement (lib/notify.js). Réglages par sport dans l'onglet Profil.

## Où modifier quoi
- lib/espn.js : la source de données (ESPN, non officielle). Pour changer de fournisseur, réécris uniquement ce fichier en gardant le même format.
- SPORTS dans lib/espn.js : les compétitions suivies (fra.1 = Ligue 1, eng.1 = Premier League, uefa.champions…).
- app/globals.css : les couleurs de la charte (variables en haut du fichier).

Les scores sont rafraîchis toutes les 20 s ; le cache Vercel fait qu’ESPN ne reçoit qu’un appel toutes les 20 s, quel que soit le nombre d’utilisateurs.
