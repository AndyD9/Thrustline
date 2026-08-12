# Règles de sécurité

Ces règles sont des critères de livraison, pas des améliorations facultatives.

## Modèle de menace minimal

Supposer qu'un attaquant peut :

- modifier le frontend et appeler Supabase directement ;
- lire les fichiers et la mémoire de son propre poste ;
- envoyer une télémétrie MSFS fabriquée ;
- rejouer ou interrompre des requêtes ;
- fournir fichiers, URLs et identifiants malformés ;
- analyser tous les binaires distribués.

## Règles obligatoires

### Secrets

- Jamais de `service_role`, mot de passe, clé privée ou certificat dans le dépôt,
  le frontend, le bridge ou les artefacts distribués.
- JWT utilisateur en mémoire seulement si possible, purgé au logout/expiration.
- Aucun secret, header Authorization ou donnée personnelle dans les logs.
- Rotation immédiate après exposition supposée.

### Autorisation et économie

- Identité déduite du JWT côté serveur.
- Vérifier rôle, ownership et transition pour chaque commande.
- Ne jamais faire confiance aux prix, gains, rangs, scores, durées ou company IDs
  envoyés comme autorité par le client.
- Argent, propriété, dette, réputation et récompenses : transaction serveur.
- Commandes idempotentes avec `operation_id`.
- Grand livre financier immuable ; correction par compensation.

### Entrées

- Schémas stricts, limites de taille et plages numériques.
- Rejeter NaN, infini, propriétés inattendues et formats ambigus.
- SQL paramétré uniquement.
- Aucun contenu non fiable vers shell ou exécution dynamique.
- Chemins normalisés et confinés ; imports contrôlés par contenu réel.

### Desktop et réseau

- Bridge loopback uniquement et authentifié par instance.
- Port/conduit non accessible aux autres utilisateurs locaux lorsque possible.
- CORS et capacités Tauri en allowlist.
- URL externe validée côté Rust : protocole et domaine autorisés.
- HTTPS et validation TLS obligatoires.
- Timeouts, limites de réponse et rate limiting.
- Aucun besoin de lancer l'application comme administrateur.

### Supabase

- RLS sur toute table exposée.
- `PUBLIC` révoqué par défaut.
- Fonctions `security definer` avec `search_path` fixe et contrôles internes.
- Tests automatisés anonyme, utilisateur A et utilisateur B.
- Migrations append-only et testées sur base jetable.
- Clé privilégiée uniquement dans une fonction serveur contrôlée.

### Vie privée

- Collecte minimale et finalité écrite.
- Discord Rich Presence et diagnostics clairement désactivables.
- Consentement avant envoi de logs ou télémétrie facultative.
- Rétention, export et suppression des données documentés.

### Supply chain et release

- Lockfiles, audits npm/NuGet/Rust, scan de secrets et licences.
- Versions directes exactes ; restauration CI en mode verrouillé.
- Scripts d'installation pnpm refusés sauf allowlist et paquets nouveaux
  différés de sept jours, hors correctif urgent revu.
- Actions CI épinglées à des SHA immuables.
- Secrets CI interdits aux PR de forks.
- EXE, installateur et manifeste de mise à jour signés.
- Checksum, SBOM et provenance publiés.
- Vulnérabilité critique/haute bloque la release sauf exception écrite et limitée.
- Dépendance critique abandonnée ou sans licence claire refusée ; toute
  exception nomme une alternative et expire sous 90 jours.
- Build, signature et publication sont trois étapes séparées ; aucun secret de
  signature n'est exposé au job de build ni aux PR externes.

## Revue sécurité d'un ticket

Tout ticket touchant auth, DB, fichiers, réseau, IPC, shell, update, télémétrie ou
économie doit documenter :

- actifs et données concernés ;
- frontière traversée ;
- abus plausibles ;
- validation et autorisation ;
- atomicité/idempotence ;
- journalisation et vie privée ;
- tests négatifs et inter-utilisateurs.

## Réponse à incident

1. Contenir et préserver les preuves.
2. Révoquer les secrets concernés.
3. Corriger la cause et ajouter un test de régression.
4. Préparer une release signée.
5. Informer les utilisateurs affectés si nécessaire.
6. Consigner l'incident et l'action préventive.
