# Architecture Decision Records

Les ADR conservent les décisions difficiles et leur contexte. Ils évitent que les
agents réouvrent sans cesse une question ou suivent une règle devenue obsolète.

## Convention

- `ADR-0001-solo-or-collaborative.md`
- Numéro séquentiel, titre stable.
- Une ADR acceptée n'est pas réécrite pour changer l'histoire.
- Une nouvelle ADR peut en remplacer une ancienne.
- Les détails d'implémentation ordinaires restent dans les unités
  (`docs/features/`), pas ici.
- Modèle : `poseidon/templates/ADR.md`.

## ADR acceptées

| ADR | Sujet | Statut |
| --- | --- | --- |
| ADR-0001 | Modèle produit solo | Accepted |
| ADR-0002 | Stratégie de refonte | Superseded by ADR-0005 |
| ADR-0003 | Matrice de support Windows/MSFS | Accepted |
| ADR-0004 | Stack cible et politique de versions | Accepted, à réexaminer (`KI-017`) |
| ADR-0005 | Durcissement au lieu de réécriture | Accepted |

## ADR encore à écrire

1. Canal local Tauri ↔ bridge.
2. Stockage/cache hors ligne.
3. Autorité et modèle anti-triche.
4. Stratégie de distribution et mise à jour.
5. Politique de suppression de compte et de rétention (ADR-0001).

