# Supabase — source de vérité Thrustline

Ce dossier contient le schéma Postgres (source de vérité unique) + les policies RLS
qui protègent le multi-tenant par `auth.uid()`.

## Tables

| Table           | Rôle                                                    |
|-----------------|---------------------------------------------------------|
| `companies`     | Une compagnie aérienne par utilisateur (unique)         |
| `aircraft`      | Flotte (leased / owned, healthPct, cycles…)             |
| `routes`        | Routes actives d'une compagnie                          |
| `reputations`   | Score 0..100 par couple (origin, dest)                  |
| `crew_members`  | Pilotes (captain / first_officer) assignés aux avions   |
| `dispatches`    | Briefing d'un vol avant décollage (+ OFP SimBrief JSON) |
| `flights`       | Journal des vols terminés (revenue, fuel cost…)         |
| `loans`         | Prêts en cours                                          |
| `game_events`   | Événements dynamiques (fuel spike, strike, weather…)    |
| `transactions`  | Mouvements de trésorerie                                |

Chaque ligne porte `user_id uuid references auth.users(id)` et est protégée par
une policy RLS `user_id = auth.uid()`.

## Qui écrit quoi

- **React (Supabase JS SDK)** : CRUD complet sur ses propres lignes via la clé anon
  + session JWT utilisateur. RLS garantit l'isolation.
- **sim-bridge C# (service_role key, local uniquement)** : écrit les `flights` et
  `transactions` à chaque atterrissage, met à jour `companies.capital`. Contourne RLS.

## Appliquer la migration

### En dev local (Supabase CLI)

```bash
# depuis la racine du repo
supabase start                 # lance la stack locale (postgres + studio + auth…)
supabase db reset              # applique toutes les migrations du dossier migrations/
```

Studio local : http://localhost:54323

### Sur un projet Supabase hébergé

Option A — via la CLI :
```bash
supabase link --project-ref <ref>
supabase db push
```

Option B — via l'UI : copier-coller `migrations/20260405120000_init.sql` dans le
SQL Editor du dashboard Supabase et exécuter.

## Ajouter une nouvelle migration

```bash
supabase migration new <nom_descriptif>
```

La CLI crée `migrations/<timestamp>_<nom>.sql`. **Ne jamais modifier une migration
déjà appliquée en prod** — toujours en ajouter une nouvelle.
