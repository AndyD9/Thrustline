# Architecture cible

Statut : cible de refonte ; toute divergence durable nécessite un ADR.

## Architecture logique

```text
MSFS
  │ SimConnect (données non fiables)
  ▼
Bridge .NET 8
  │ événements de vol versionnés
  │ canal local authentifié
  ▼
Tauri v2 / Rust
  │ capacités natives minimales
  ▼
React / TypeScript
  │ lectures RLS + commandes HTTPS
  ▼
Supabase
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

La migration vers cette organisation est progressive et pilotée par tickets.
Aucun « big bang » de déplacement sans tests de caractérisation.

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
