# Vision produit — Thrustline Rebuild

Statut : Draft à valider avant la phase 1.

## Vision

Thrustline transforme les vols MSFS en gestion cohérente d'une compagnie
aérienne virtuelle : planifier, exploiter, suivre, analyser et développer une
compagnie sans perdre les données ni pouvoir falsifier facilement son économie.

## Principes produit

- Windows-first et MSFS-first.
- Fonctionnel même lorsque MSFS est fermé pour la partie gestion.
- Dégradation claire en cas de panne Supabase, SimBrief, météo ou SimConnect.
- Aucune perte silencieuse d'un vol ou d'une transaction.
- Les calculs importants sont explicables à l'utilisateur.
- Les mises à jour sont signées, récupérables et non destructrices.
- Vie privée par défaut ; télémétrie facultative et transparente.

## Utilisateur principal

Un passionné de simulation qui gère sa propre compagnie et effectue lui-même des
vols dans MSFS.

## Décision produit requise

Avant le schéma final, choisir explicitement :

- **Solo connecté** : une compagnie appartient à un utilisateur ;
- **VA collaborative** : plusieurs membres, rôles, invitations et pilotes.

La phase de fondation part du mode solo tant qu'une ADR n'adopte pas le mode
collaboratif. Ne pas ajouter partiellement du multi-utilisateur.

## Parcours essentiels

1. Installer, lancer et créer/se connecter à un compte.
2. Créer une compagnie sans état partiel.
3. Acheter ou louer un avion.
4. Créer un dispatch et préparer le vol avec SimBrief.
5. Connecter MSFS et suivre les phases du vol.
6. Reprendre après une déconnexion ou un crash.
7. Finaliser le vol une seule fois.
8. Voir les impacts financiers, réputation et maintenance.
9. Planifier des opérations passives sans incohérence temporelle.
10. Mettre à jour ou désinstaller sans perdre les données.

## MVP de la refonte

- Authentification et compagnie.
- Flotte, maintenance et propriété.
- Routes, dispatch et SimBrief.
- SimConnect, phases de vol, ACARS résumé et rapport.
- Grand livre financier autoritaire.
- Réputation et progression minimales.
- Sauvegarde cloud, reprise et diagnostics.
- Installateur et mises à jour signés.

## Hors MVP

- Réseau social, marketplace communautaire et mods.
- Application mobile.
- Tableau de bord web public.
- Multi-VA complexe.
- Simulation économique exhaustive.
- Anti-triche présenté comme inviolable.

## Contraintes de distribution

- Windows 10/11 à confirmer par matrice de tests.
- MSFS 2020/2024 et éditions réellement supportées à documenter.
- Aucun privilège administrateur permanent.
- Données utilisateur séparées des fichiers d'installation.
- Politique de confidentialité, support, sécurité et licence avant bêta publique.

## Mesures de réussite

- Sessions sans crash ≥ objectif défini avant bêta.
- Zéro double clôture de vol.
- Zéro variation financière sans écriture de grand livre.
- Reprise après coupure testée sur chaque parcours essentiel.
- Temps de démarrage et consommation mémoire budgétés.
- Mise à jour N-1 → N et rollback validés sur VM propre.

