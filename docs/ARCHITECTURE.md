# Architecture cible

Statut : cible de refonte ; toute divergence durable nécessite un ADR.

## Architecture logique

```text
MSFS
  │ SimConnect (données non fiables)
  ▼
Bridge .NET 10 LTS
  │ événements de vol versionnés
  │ canal local authentifié
  ▼
Tauri 2.11 / Rust stable épinglé
  │ capacités natives minimales
  ▼
React 19 / TypeScript 6
  │ lectures RLS + commandes HTTPS
  ▼
Supabase / PostgreSQL 17
  ├─ Auth
  ├─ PostgreSQL + RLS
  ├─ RPC/Edge Functions transactionnelles
  ├─ Realtime
  └─ jobs serveur contrôlés
```

## Frontières de confiance

- Le frontend, Tauri, le bridge, MSFS et tous les fichiers importés sont publics
  et modifiables par l'utilisateur.
- Supabase valide identité, appartenance, permissions et transitions.
- Le serveur recalcule argent, prix, récompenses, usure et progression.
- La télémétrie est un signal borné et analysé, pas une preuve absolue.

## Responsabilités

### React

- Présentation, formulaires, cache de vues et états UX.
- Aucun calcul client utilisé comme autorité économique.
- Pages minces ; logique dans modules de fonctionnalité testables.
- Une couche `queries` pour les lectures et `commands` pour les mutations.

### Tauri/Rust

- Cycle de vie de l'application et du bridge.
- Capacités natives en allowlist.
- Validation native des URL externes.
- Update signée, diagnostics et stockage local approprié.

### Bridge .NET

- Connexion/reconnexion SimConnect.
- Client hors processus self-contained Windows x64, limité à la session locale.
- SDK/API SimConnect officiel MSFS 2024 isolé derrière `ISimConnectAdapter` ;
  aucun type SDK dans le domaine et aucune dépendance du domaine au wrapper.
- Normalisation, validation et agrégation de la télémétrie.
- Machine à états de vol déterministe et rejouable.
- Rapport de vol versionné.
- Aucun secret privilégié ni écriture économique directe.

### Supabase

- Identité et autorisation.
- Ownership MVP limité côté serveur à un propriétaire par compagnie et au plus
  une compagnie par utilisateur.
- Identité de compagnie distincte de l'identité utilisateur, sans droit
  collaboratif implicite.
- Commandes sensibles transactionnelles et idempotentes.
- Grand livre immuable et projections.
- RLS défensive sur chaque table exposée.
- Audit des changements sensibles.
- Traitements passifs côté serveur, indépendants d'un client ouvert.
- PostgreSQL 17 fourni par la plateforme ; migrations et types générés depuis
  le schéma neuf.
- RPC SQL préférée pour les commandes purement transactionnelles ; Edge
  Functions réservées à l'orchestration réseau ou aux secrets serveur.

## Stratégie de construction

Conformément à `ADR-0002`, l'architecture cible sera construite par réécriture
totale dans un nouveau dépôt et un historique Git neuf. Le dépôt actuel reste une
référence en lecture seule pour les comportements, l'UX et la documentation
jusqu'à validation de la parité du golden path, puis il est archivé.

Il n'existe aucune coexistence en production, aucune double lecture/écriture et
aucune compatibilité avec l'ancien schéma. Le nouveau dépôt utilise des branches
courtes, une intégration fréquente et une CI obligatoire. Le premier vertical
slice critique est le moteur de vol SimConnect rejouable jusqu'au rapport
versionné.

## Organisation cible

```text
app/src/
  app/                 # composition, routes, providers
  features/
    dispatch/
      api/
      components/
      hooks/
      model/
      tests/
  shared/              # UI, contrats, utilitaires sans métier

sim-bridge/
  Api/
  Application/
  Domain/
  Infrastructure/
    SimConnect/
  Contracts/

supabase/
  functions/
  migrations/
  tests/

docs/
  decisions/
  tickets/
  templates/
```

Cette organisation appartient au nouveau dépôt. Aucun code n'y est déplacé
depuis le dépôt actuel sans ticket de caractérisation et preuve de qualité,
sécurité, provenance et licence. La réécriture reste pilotée par gates et tests
de caractérisation malgré l'absence de migration de code.

## Données

- UUID pour les identités distribuées.
- Horodatages UTC ; temps simulé explicitement distinct du temps réel.
- Grand livre financier append-only.
- Version ou jeton de concurrence sur ressources sensibles.
- `operation_id` unique pour chaque commande rejouable.
- Suppression logique pour données auditables ; rétention documentée.
- Types Supabase générés et dérive détectée en CI.

## Contrats

- Payloads REST, SignalR et RPC versionnés.
- Validation aux deux extrémités.
- Changements compatibles ou migration coordonnée.
- Événements de domaine sans types SimConnect natifs.

## Résilience

- Timeout et annulation sur toute I/O.
- Retry uniquement pour opérations idempotentes, avec backoff et jitter.
- File locale/outbox pour les commandes critiques interrompues.
- États visibles : local, pending, synchronized, rejected.
- Aucun `last write wins` pour argent, propriété ou affectations.

## Décisions encore ouvertes

- HTTP localhost renforcé ou named pipe Windows pour le bridge.
- Cache SQLite local et données autorisées hors ligne.
- Stratégie d'anti-triche proportionnée.
- Fournisseur de crash reporting et consentement.

## Décisions acceptées

- `ADR-0001` : MVP solo connecté, un propriétaire unique et au plus une
  compagnie par utilisateur ; modèle préparé pour une collaboration ultérieure,
  sans membre ni rôle collaboratif dans le MVP.
- `ADR-0002` : réécriture totale isolée dans un nouveau dépôt ; ancien dépôt
  conservé comme référence en lecture seule, nouveau schéma sans migration des
  données de développement et une seule bascule publique après parité.
- `ADR-0003` : Windows 11 x64 maintenu et MSFS 2024 stable uniquement ; Store et
  Steam sont validés séparément, sans support Windows 10, ARM64, MSFS 2020,
  Insider ou Preview. WebView2 Evergreen et bridge .NET self-contained.
- `ADR-0004` : Node 24/pnpm 11/React 19/Tauri 2.11, bridge .NET 10 LTS avec SDK
  SimConnect officiel abstrait et backend Supabase/PostgreSQL 17. Les versions
  exactes et la politique mensuelle sont dans `docs/STACK.md`.
