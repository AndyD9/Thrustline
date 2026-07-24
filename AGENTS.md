# AGENTS.md — Loi du dépôt Thrustline

Ce fichier s'applique à tout le dépôt. Toute instruction plus locale doit être
compatible avec ces règles.

## Mission

Thrustline est une application Windows distribuable de gestion de compagnie
aérienne virtuelle pour Microsoft Flight Simulator. La refonte vise en priorité :

1. stabilité et récupération après erreur ;
2. sécurité d'un client distribué et modifiable ;
3. intégrité de l'économie et des données ;
4. compatibilité MSFS/SimConnect ;
5. maintenabilité, testabilité et mises à jour sûres.

## Sources de vérité

Lire avant tout travail :

1. `docs/CURRENT_STATE.md` — ce qui existe réellement ;
2. `docs/ROADMAP.md` — ordre des phases ;
3. le ticket concerné dans `docs/tickets/` ;
4. les documents spécialisés indiqués par le ticket.

Références permanentes :

- `docs/PRODUCT.md` — périmètre et règles produit ;
- `docs/ARCHITECTURE.md` — architecture cible et frontières ;
- `docs/SECURITY.md` — règles de sécurité ;
- `docs/QUALITY.md` — stratégie de tests et critères de qualité ;
- `docs/WORKFLOW.md` — cycle complet d'un ticket.

Le code et les migrations appliquées priment sur une documentation périmée.
Signaler et corriger les divergences dans le même ticket si elles sont directement
liées au changement.

## Règles de travail

- Implémenter un seul ticket à la fois.
- Ne pas anticiper les tickets futurs.
- Ne pas refactorer un système sans rapport.
- Respecter strictement `Allowed areas` et `Do not touch`.
- Préserver les modifications utilisateur non liées.
- Ne pas changer l'architecture sans ADR accepté.
- Éviter toute dépendance nouvelle si une solution simple existe déjà.
- Arrêter et demander une décision si une ambiguïté change le produit, la
  sécurité, les données ou l'architecture.
- Un problème découvert hors périmètre devient un follow-up dans
  `docs/KNOWN_ISSUES.md`, pas une modification opportuniste.

## Frontières techniques

- `app/` : Tauri v2, React, TypeScript, Vite, UI et orchestration cliente.
- `sim-bridge/` : .NET 8, SimConnect, télémétrie locale, REST/SignalR.
- `supabase/` : Auth, PostgreSQL, RLS, Realtime, RPC et Edge Functions.
- `legacy/` : lecture seule jusqu'à son archivage explicite.

Le desktop, le sidecar et MSFS sont des clients non fiables. Le serveur est
autoritaire pour l'argent, la propriété, la réputation, la progression et les
transitions sensibles. Aucun secret backend ne doit être livré au client.

## Qualité d'implémentation

- TypeScript strict, C# nullable et Rust sans avertissement introduit.
- Pages React minces ; règles métier et accès données hors des composants.
- Mutations sensibles via commande serveur transactionnelle et idempotente.
- Migrations Supabase append-only.
- Contrats partagés versionnés et consommateurs mis à jour ensemble.
- Erreurs actionnables pour l'utilisateur, détails techniques dans des logs
  redigés.
- Aucun secret, JWT, donnée personnelle ou header d'authentification dans Git ou
  les logs.

## Validation

Exécuter les contrôles proportionnés au ticket, puis consigner les résultats :

```powershell
# Frontend
Set-Location app
npm test
npm run build

# Sidecar
Set-Location ..\sim-bridge
dotnet build --configuration Release
dotnet test --configuration Release

# Tauri
Set-Location ..\app\src-tauri
cargo check --locked

# Invariants du dépôt
Set-Location ..\..
.\scripts\security-check.ps1
```

Les changements SQL exigent des tests locaux/staging d'isolation entre deux
utilisateurs. Les changements SimConnect exigent un replay de trace ou un test
manuel MSFS documenté. Ne jamais annoncer comme réussi un contrôle non exécuté.

## Fin de ticket

Un ticket n'est `Done` que si :

- ses critères d'acceptation sont satisfaits ;
- les tests automatisés pertinents passent ;
- sa vérification manuelle a été effectuée ou clairement déléguée ;
- les risques et limites sont consignés ;
- `docs/CURRENT_STATE.md` est mis à jour si l'état réel change ;
- le ticket contient son Completion Report ;
- aucun changement hors périmètre n'est inclus.

Le rapport final doit donner : résumé, fichiers modifiés, commandes exécutées,
résultats, vérification manuelle, risques, follow-ups et documentation mise à jour.

## Handoff Git obligatoire

À la fin de chaque ticket, fournir à Andy un bloc de commandes PowerShell prêt à
copier pour publier le travail. Ce handoff est obligatoire même si aucun push
n'est effectué par l'agent.

Avant de construire les commandes :

1. relever la branche courante avec `git branch --show-current` ;
2. relever la branche distante par défaut ;
3. distinguer les fichiers du ticket des modifications préexistantes ;
4. proposer un message de commit Conventional Commits adapté ;
5. vérifier si la branche possède déjà un upstream.

Le bloc doit inclure, dans cet ordre :

1. `git status --short` ;
2. un `git add -- <liste explicite>` contenant uniquement les fichiers du ticket ;
3. `git diff --cached --check` ;
4. `git diff --cached --stat` ;
5. une vérification qu'aucun fichier hors ticket n'est indexé ;
6. `git commit -m "<message>"` ;
7. `git push` ou `git push -u origin <branche>` selon l'upstream ;
8. la commande `gh pr create` appropriée si une PR est attendue.

Règles :

- ne jamais recommander `git add .` ou `git add -A` ;
- ne jamais inclure silencieusement une modification utilisateur préexistante ;
- ne jamais inventer le nom de la branche ou la cible de PR : les relever ;
- utiliser Git pour Windows/PowerShell pour ce dépôt, pas Git WSL sur `/mnt/c` ;
- ne jamais demander le mot de passe GitHub ; recommander `gh auth login` si
  l'authentification manque ;
- ne pas exécuter commit, push, création de PR ou merge sans demande explicite ;
- si le ticket n'est pas prêt à publier, expliquer le blocage au lieu de fournir
  des commandes prétendant qu'il est terminé.
