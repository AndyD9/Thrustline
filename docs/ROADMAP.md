# Roadmap de la refonte

La roadmap est ordonnée par réduction du risque. Elle décrit des résultats ; les
détails d'exécution appartiennent aux tickets.

## Phase 0 — Baseline et décisions

Objectif : rendre l'existant mesurable et décider ce que l'on reconstruit.

- Inventaire reproductible, tests/builds et matrice de dépendances.
- Décision solo connecté vs VA collaborative.
- Matrice Windows/MSFS supportée.
- Budgets stabilité/performance et politique de données.
- Choix : réécriture incrémentale ou remplacement par strangler pattern.
- Environnements dev/staging/prod documentés.

Gate : baseline verte ou écarts connus, ADR majeures acceptées, périmètre MVP gelé.

## Phase 1 — Socle reproductible

Objectif : pouvoir reconstruire et tester le produit à tout moment.

- Versions/outils supportés et bootstrap automatisé.
- Source de version unique.
- CI consolidée et actions épinglées.
- Lint/format/types/tests cohérents.
- Supabase local jetable et données de test.
- Contrats versionnés et génération des types.

Gate : clone propre → setup → tests/build sans étape secrète non documentée.

## Phase 2 — Noyau métier autoritaire

Objectif : empêcher corruption, doubles opérations et calculs client autoritaires.

- Modèle de domaine et grand livre immuable.
- Commandes transactionnelles/idempotentes.
- RLS A/B/anonyme.
- Concurrence optimiste et audit.
- Migration/reconciliation des données existantes.

Gate : aucune mutation sensible directe depuis un composant client.

## Phase 3 — Bridge et moteur de vol stables

Objectif : rendre la détection de vol déterministe et récupérable.

- Domaine indépendant de SimConnect.
- Replays de traces et projet de tests .NET.
- Reconnexion, pause, slew, go-around, touch-and-go et crash.
- Canal local durci et cycle de vie robuste.
- Rapport de vol versionné et outbox de reprise.

Gate : parcours critiques reproductibles sans lancer MSFS.

## Phase 4 — Application cliente maintenable

Objectif : reconstruire l'UX sur des fondations testables.

- Architecture par fonctionnalités.
- Couche queries/commands.
- Auth et onboarding résilients.
- Flotte, routes, dispatch, vol live, finances.
- États offline/pending/rejected explicites.
- Accessibilité et design system.

Gate : golden path E2E stable et aucun écran critique monolithique.

## Phase 5 — Opérations passives et progression

Objectif : réintroduire la profondeur de jeu côté serveur.

- Horaires/rotations atomiques.
- Jobs serveur temporels et déterministes.
- Maintenance, équipage, prêts, réputation et événements.
- Tests de simulation longue et cohérence économique.

Gate : simulation accélérée sans création/destruction inexpliquée de valeur.

## Phase 6 — Distribution sûre

Objectif : produire une bêta installable et récupérable.

- Authenticode, installateur, SBOM, checksums et provenance.
- Updater signé, canaux stable/bêta et rollback.
- Logs redigés, diagnostics consentis et crash reporting.
- Politique sécurité, confidentialité, licence et support.
- Tests VM Windows/MSFS.

Gate : installation, upgrade N-1, rollback et désinstallation validés.

## Phase 7 — Bêta fermée et stabilisation

Objectif : mesurer en conditions réelles sans ajouter de fonctionnalités.

- Cohorte limitée et procédure d'incident.
- SLO, triage et retour utilisateur.
- Tests longue durée et correction des régressions.
- Sauvegarde/restauration.

Gate : deux releases consécutives respectent les objectifs de stabilité.

## Phase 8 — Après stabilité

- Collaboration multi-rôle si décidée.
- Tableau de bord web.
- Import/export avancé.
- Administration et audit étendu.
- Modding avec permissions/signatures dédiées.

