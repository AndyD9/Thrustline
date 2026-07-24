# Contribuer à Thrustline

Thrustline suit un workflow par tickets afin de protéger la stabilité, la
sécurité et l'intégrité des données.

## Avant de contribuer

1. Lire `AGENTS.md`.
2. Lire `docs/CURRENT_STATE.md`.
3. Choisir un ticket `Ready` dans `docs/tickets/`.
4. Ne pas commencer un ticket Draft ou Backlog sans l'affiner.

## Branche

Utiliser `type/TXXXX-description`, par exemple :

```text
foundation/T0001-baseline-reproductible
security/T0012-tests-rls
fix/T0042-reconnexion-simconnect
```

## Pull request

Une PR couvre un ticket. Elle contient :

- lien/ID du ticket ;
- résumé et fichiers principaux ;
- tests et commandes exécutés ;
- étapes de vérification manuelle ;
- impact sécurité/données ;
- risques, limites et rollback ;
- follow-ups hors périmètre.

À la fin d'un ticket, Codex doit fournir les commandes Git exactes à exécuter
depuis PowerShell Windows. Elles doivent indexer explicitement les fichiers du
ticket, afficher le diff préparé, créer le commit, pousser la branche et proposer
la création de PR. `git add .` et `git add -A` sont interdits dans ce handoff.

## Qualité

Suivre `docs/QUALITY.md` et les validations du ticket. Ne pas masquer un test
échoué ni annoncer un contrôle non exécuté.

## Sécurité

Ne jamais ouvrir une issue publique contenant une faille exploitable, un secret ou
des données personnelles. Suivre `SECURITY.md`.
