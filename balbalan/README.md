# Balbalan — PWA scores en direct (foot, basket, tennis)

## Lancer en local
npm install
npm run dev        → http://localhost:3000

## Mettre en ligne (gratuit)
1. Pousse le dossier sur GitHub.
2. Sur vercel.com : « Add New Project » → choisis le repo → Deploy.
3. Partage le lien. Sur iPhone : Safari → Partager → « Sur l’écran d’accueil ».

## Où modifier quoi
- lib/espn.js : la source de données (ESPN, non officielle). Pour changer de fournisseur, réécris uniquement ce fichier en gardant le même format.
- SPORTS dans lib/espn.js : les compétitions suivies (fra.1 = Ligue 1, eng.1 = Premier League, uefa.champions…).
- app/globals.css : les couleurs de la charte (variables en haut du fichier).

Les scores sont rafraîchis toutes les 20 s ; le cache Vercel fait qu’ESPN ne reçoit qu’un appel toutes les 20 s, quel que soit le nombre d’utilisateurs.
