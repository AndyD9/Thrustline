# Stratégie qualité et validation

## Principe

« Le build passe » ne signifie pas « la fonctionnalité fonctionne ». Chaque
ticket associe tests automatisés, vérification manuelle courte et preuve de
résultat.

## Pyramide de tests

### Unitaires

- Calculs d'économie, carburant, maintenance, satisfaction et réputation.
- Machine à états de vol avec horloge et SimConnect factices.
- Validation, conversion d'unités et génération d'horaires.
- Composants React purs et hooks déterministes.

### Intégration

- PostgreSQL/RPC/RLS dans Supabase local.
- Deux utilisateurs, anonyme et service serveur.
- REST/SignalR entre frontend et bridge.
- Sérialisation des contrats TypeScript/C#/SQL.
- Reconnexion, timeout et rejeu idempotent.

### End-to-end

- Installation et premier lancement.
- Auth → compagnie → avion → dispatch.
- Trace de vol rejouée → rapport → clôture unique.
- Crash/coupure puis reprise.
- Upgrade N-1 → N, rollback et désinstallation.

### Manuel MSFS

- MSFS fermé, lancement tardif et redémarrage.
- Vol normal, touch-and-go, go-around, pause, slew et accélération temporelle.
- Perte réseau pendant et après le vol.
- Plusieurs appareils/add-ons représentatifs.

## Matrice de validation par zone

| Zone | Minimum |
| --- | --- |
| React/TypeScript | tests concernés + `npm run build` |
| .NET/SimConnect | unit tests + `dotnet build` |
| Rust/Tauri | `cargo check --locked` + test de capacité |
| Supabase | migration propre + tests RLS A/B/anonyme |
| Contrat transverse | tests de contrat + builds des consommateurs |
| Sécurité | scénario d'abus et contrôle rejeté |
| Release | VM propre, signature, upgrade et rollback |

## Budgets initiaux à fixer en phase 0

- temps de démarrage sur machine cible ;
- mémoire au repos et pendant un vol long ;
- fréquence maximale de rendu de télémétrie ;
- taille d'installateur et de mise à jour ;
- latence des commandes critiques ;
- sessions sans crash ;
- temps maximum de récupération après déconnexion.

## Vérification manuelle d'un ticket

Elle doit tenir en 5–10 minutes quand le ticket est correctement découpé :

1. préparer un état connu ;
2. effectuer l'action principale ;
3. observer le résultat attendu ;
4. tester au moins une erreur ou limite ;
5. vérifier logs/console sans secret ;
6. relancer pour confirmer la persistance si pertinente.

## Preuves

Le Completion Report conserve :

- commandes exactes et codes de sortie ;
- nombre de tests réussis/échoués ;
- contrôles non exécutés et raison ;
- étapes manuelles et résultat ;
- capture ou extrait uniquement si utile et sans donnée sensible.

## Release gate

Une release publique exige :

- tests verts sur un commit propre ;
- zéro secret détecté ;
- audits sans vulnérabilité bloquante ;
- migrations et restauration validées ;
- artefacts signés et vérifiés ;
- SBOM/checksums/provenance ;
- parcours critiques sur VM propre ;
- notes de version, limitations et procédure de rollback.

