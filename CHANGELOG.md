# Changelog

Toutes les modifications notables de Thrustline sont documentees dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet utilise le [versionnage semantique](https://semver.org/lang/fr/).

## [0.2.0] - 2026-07-21

### Ajoute

- Nouvelle application de bureau Tauri v2 avec interface React 18 et sidecar .NET 8.
- Suivi de vol MSFS en temps reel via SimConnect, REST et SignalR.
- Authentification, stockage PostgreSQL, politiques RLS et mises a jour temps reel avec Supabase.
- Gestion complete de la compagnie, de la flotte, des equipages, des finances et des dispatches.
- Integration SimBrief, import des profils avion et affichage des OFP.
- Cartes de vol, suivi de trajectoire, reseau de la compagnie et position des avions passifs.
- Planification des rotations, operations passives accelerees et economie par passagers.
- Marche d'avions neufs et d'occasion, achat, vente, maintenance et credit-bail.
- Simulation de l'embarquement et de l'experience passager en temps reel.
- Tests frontend, builds automatises et workflows CI, Dependabot et detection de secrets.

### Modifie

- Les anciennes implementations Electron et WPF sont maintenant conservees uniquement dans `legacy/`.
- Le frontend charge les pages, cartes, graphiques et donnees aeroportuaires en blocs separes.
- Le traitement privilegie de fin de vol est execute par une Edge Function Supabase authentifiee.
- Node.js 24.18 LTS est desormais la version de reference du projet.

### Securite

- Suppression de toute cle Supabase `service_role` du frontend et du sidecar distribues.
- Validation des JWT utilisateur et appairage ephemere entre Tauri et le bridge local.
- Restriction de CORS, de la CSP Tauri et des permissions shell.
- Durcissement des fonctions et RPC Supabase contre les horloges controlees par le client et les appels anonymes.
- Ajout d'un controle automatise des invariants de securite.

### Corrige

- Stabilisation de la detection SimConnect et reinitialisation correcte de l'etat du simulateur.
- Correction des trajectoires, waypoints, orientations d'avion et couleurs de carte.
- Correction de l'ouverture de SimBrief depuis Tauri et du formatage des horaires OFP.
- Nettoyage des fichiers legacy dupliques a la racine apres la migration de l'architecture.

## [0.1.0] - 2026-04-03

### Ajoute

- Premiere version de developpement de Thrustline avec l'implementation Electron initiale.

[0.2.0]: https://github.com/AndyD9/Thrustline/compare/255a8c6...v0.2.0
[0.1.0]: https://github.com/AndyD9/Thrustline/tree/255a8c6
