# Problèmes connus et follow-ups

Ce registre contient uniquement les découvertes réelles hors périmètre d'un
ticket. La roadmap contient le travail planifié.

## Format

| ID | Sévérité | Zone | Résumé | Preuve | Ticket cible | Statut |
| --- | --- | --- | --- | --- | --- | --- |

Sévérité : `Critical`, `High`, `Medium`, `Low`.  
Statut : `Open`, `Accepted`, `Scheduled`, `Resolved`, `Invalid`.

## Entrées initiales

| ID | Sévérité | Zone | Résumé | Preuve | Ticket cible | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| KI-001 | High | Data | Certaines mutations métier sont encore effectuées directement par le client. | Audit initial | Phase 2 | Open |
| KI-002 | High | Quality | Absence de suite automatisée RLS A/B/anonyme. | Audit initial | Phase 1–2 | Open |
| KI-003 | High | Release | Pas de pipeline complet d'artefacts/updater signés. | Audit initial | Phase 6 | Open |
| KI-004 | Medium | Bridge | Pas de projet de tests .NET/replay SimConnect constaté. | Audit initial | Phase 3 | Open |
| KI-005 | Medium | Frontend | Plusieurs pages mélangent UI, règles et accès aux données. | Audit initial | Phase 4 | Open |
| KI-006 | Medium | Docs | Documentation historique partiellement désynchronisée. | Audit initial | T0001 | Open |
| KI-007 | Medium | Product | Mode solo ou VA collaborative non tranché. | Audit initial | T0002 | Open |

## Règles

- Ajouter une preuve reproductible.
- Lier à un ticket lorsqu'il devient planifié.
- Ne pas résoudre discrètement un problème hors scope.
- Retirer une entrée uniquement si son historique reste traçable dans un ticket.

