# Tickets de refonte

Créer un fichier par ticket à partir de `docs/templates/TICKET.md`.

## Convention

- Nom : `T0001-baseline-reproductible.md`
- Un ticket = un résultat et une branche.
- Les tickets détaillés ne sont créés que quelques étapes à l'avance.
- Le statut et le Completion Report restent dans le fichier du ticket.
- Un ticket terminé est conservé pour la traçabilité.

## Backlog initial

| ID | Titre | Phase | Dépend de | Statut |
| --- | --- | --- | --- | --- |
| T0001 | Baseline reproductible et inventaire | 0 | — | Done |
| T0002 | Choisir le modèle produit solo ou collaboratif | 0 | T0001 | Done |
| T0003 | Choisir la stratégie de refonte | 0 | T0001–T0002 | Done |
| T0004 | Définir la matrice de support Windows et MSFS | 0 | T0001–T0003 | Ready |
| T0005 | Budgets stabilité et performance | 0 | T0001 | Draft |
| T0006 | Consolider CI et versions d'outils | 1 | T0003 | Backlog |
| T0007 | Supabase local et tests RLS | 1 | T0003 | Backlog |
| T0008 | Source de version unique | 1 | T0003 | Backlog |

T0004 est le prochain ticket exécutable. Il fixe les plateformes et le protocole
de validation nécessaires avant la sélection finale de la stack et la création du
nouveau socle.
