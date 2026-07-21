# Thrustline

Thrustline est une application de gestion de compagnie aerienne virtuelle pour Microsoft Flight Simulator. Elle combine gestion de flotte, planification des vols, operations passives, economie et suivi en temps reel du simulateur dans une application de bureau Windows.

> Le projet est en developpement actif. Il n'existe pas encore de version publique stable.

## Fonctionnalites

- Creation et gestion d'une compagnie aerienne
- Tableau de bord avec indicateurs, historique et carte du reseau
- Achat, vente, location et maintenance des avions
- Marche d'avions neufs et d'occasion
- Creation de dispatches et integration SimBrief
- Suivi de vol en temps reel via SimConnect
- Planification de rotations et operations passives accelerees
- Gestion des equipages, finances, emprunts et transactions
- Simulation de l'experience passager et bilan d'atterrissage
- Synchronisation des donnees et authentification avec Supabase

## Architecture

```text
Microsoft Flight Simulator
          |
          v
sim-bridge (.NET 8 / SimConnect)
          |
     REST + SignalR
          |
          v
app (Tauri v2 / React / TypeScript)
          |
          v
Supabase (Auth / PostgreSQL / Realtime)
```

Le depot contient les composants suivants :

| Dossier | Description |
| --- | --- |
| `app/` | Application de bureau Tauri v2 et interface React |
| `sim-bridge/` | Sidecar ASP.NET Core reliant l'application a MSFS via SimConnect |
| `supabase/` | Configuration et migrations PostgreSQL |
| `scripts/` | Scripts PowerShell de build et d'integration |
| `legacy/` | Anciennes implementations Electron et WPF, conservees comme reference |

## Prerequis

- Windows 10 ou 11
- Microsoft Flight Simulator avec SimConnect
- [Node.js 24.18 LTS](https://nodejs.org/) et npm
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Rust](https://www.rust-lang.org/tools/install)
- Les [prerequis Tauri v2 pour Windows](https://v2.tauri.app/start/prerequisites/)
- Un projet [Supabase](https://supabase.com/)

## Installation

### 1. Cloner le depot

```powershell
git clone https://github.com/AndyD9/Thrustline.git
Set-Location Thrustline
```

### 2. Configurer le frontend

```powershell
Set-Location app
Copy-Item .env.example .env
npm install
```

Renseignez ensuite les variables suivantes dans `app/.env` :

```dotenv
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon
```

La cle anonyme est utilisee uniquement avec les politiques RLS de Supabase. Ne placez jamais la cle `service_role` dans le frontend.

### 3. Configurer le sim-bridge

Depuis la racine du depot :

```powershell
Set-Location sim-bridge
dotnet user-secrets set "Supabase:Url" "https://votre-projet.supabase.co"
dotnet user-secrets set "Supabase:ServiceRoleKey" "votre-cle-service-role"
```

La cle `service_role` doit rester dans les secrets .NET et ne doit jamais etre commitee.

### 4. Initialiser la base de donnees

Appliquez dans l'ordre les migrations du dossier `supabase/migrations/` a votre projet Supabase. Elles definissent le schema, les contraintes, les fonctions, les politiques RLS et les donnees necessaires a l'application.

### 5. Construire le sidecar Windows

Depuis la racine du depot :

```powershell
.\scripts\build-sidecar.ps1
```

Le script publie le sim-bridge puis copie les fichiers requis dans le dossier des binaires externes de Tauri.

## Developpement

### Interface web uniquement

```powershell
Set-Location app
npm run dev
```

### Application de bureau complete

```powershell
Set-Location app
npm run tauri:dev
```

### Sim-bridge seul

```powershell
Set-Location sim-bridge
dotnet run
```

Le bridge ecoute par defaut sur `http://127.0.0.1:5055` et expose des endpoints REST locaux ainsi qu'un hub SignalR.

## Validation

```powershell
# Tests et build du frontend
Set-Location app
npm test
npm run build

# Build du sim-bridge
Set-Location ..\sim-bridge
dotnet build
```

Un build Tauri complet peut etre lance avec :

```powershell
Set-Location app
npm run tauri:build
```

## Documentation du projet

- [`PLAN.md`](PLAN.md) : feuille de route et comportement cible
- [`PROGRESS.md`](PROGRESS.md) : etat d'avancement et fonctionnalites livrees
- [`codex.md`](codex.md) : architecture detaillee et conventions de contribution
- [`supabase/README.md`](supabase/README.md) : notes relatives a Supabase

## Securite

- Ne commitez jamais de fichier `.env`, de cle `service_role` ou de secret utilisateur.
- Le frontend utilise uniquement la cle anonyme Supabase avec RLS.
- Le sim-bridge reste lie a l'interface locale et conserve les acces privilegies cote serveur.
- Les binaires generes, dependances et sorties de build ne doivent pas etre ajoutes au depot.

## Licence

Aucune licence open source n'est actuellement declaree. Tous droits reserves.
