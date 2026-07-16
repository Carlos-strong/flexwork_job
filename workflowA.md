## Workflow de navigation complet — avec la gestion des litiges intégrée

> **Mise à jour (2026-07-15)** : ce document décrivait initialement des pages HTML prototypes
> (`prestataire_jalons.html`, `client_jalons.html`, `chatbox_meet_call.html`, etc.). Ces prototypes
> ont depuis été implémentés en React/Next.js et remplacés par des routes réelles. Le tableau
> ci-dessous fait correspondre chaque étape théorique à son implémentation actuelle, avec son statut.

Le litige n'est pas une page isolée : c'est une **bifurcation** qui se déclenche depuis la boucle
jalons prestataire ⇄ jalons client (intégrée au hub `/dashboard/pilotage/[contractId]`), traverse
plusieurs étapes dédiées (implémentées comme sous-phases de ce même hub), puis rejoint la clôture
normale — avec un montant potentiellement différent de celui prévu initialement.

```
A. Publier une mission (Client)
        │
        ▼
B. Fil des missions (Prestataire)
        │
        ▼
C. Détail mission + Proposition (Prestataire)
        │
        ▼
D. Propositions reçues → Sélection unique (Client)
        │
        ▼
Messagerie + appels audio/vidéo (chat/meet/call)
        │
        ▼
Offre formelle → Contrat → financement → signature
        │
        ▼
Hub de pilotage du contrat (jalons + clôture + litige)
        │
        ▼
Boucle jalons prestataire ⇄ jalons client
   (soumettre → vérifier → valider/rejeter → réviser)
        │
   ┌────┴─────────────────────────────────┐
   │                                       │
Tous les jalons VALIDÉ             Seuil de rejets dépassé
(chemin normal)                    sur un jalon (5 rejets)
   │                                       │
   │                                       ▼
   │                          E. Litige — Purge
   │                             Tout jalon SOUMIS en attente doit
   │                             être tranché avant de continuer
   │                                       │
   │                                       ▼
   │                          F. Litige — Calcul du prorata
   │                             Mécanique, non négociable
   │                                       │
   │                                       ▼
   │                          G. Litige — Fenêtre d'appel 48h
   │                             (pas de minuteur temps réel — sortie manuelle)
   │                                       │
   │                              ┌────────┴────────┐
   │                              │                 │
   │                        Pas d'appel        Appel recevable
   │                              │                 │
   │                              │                 ▼
   │                              │      H. Litige — Médiation interne
   │                              │         Limitée au(x) jalon(s) contesté(s)
   │                              │                 │
   │                              │                 ▼
   │                              │      I. Litige — Arbitrage externe
   │                              │         (bouton disponible, pas de vérif. de seuil d'enjeu)
   │                              │                 │
   │                              └─────────────────┘
   │                                       │
   ▼                                       ▼
J. Clôture (dans le hub de pilotage)
   - Chemin normal : paiement intégral
   - Chemin litige : paiement selon la répartition finale (prorata ± appel/médiation)
        │
        ▼
K. Frais de plateforme (commission 5% — affichée en amont, pas de récap post-clôture)
        │
        ▼
L. Retrait des fonds (⚠️ non implémenté — historique de paiements en lecture seule)
        │
        ▼
M. Évaluations mutuelles (⚠️ non implémenté — pages "Avis" vides, sans backend)
```

### Correspondance étapes ↔ implémentation réelle

| Étape | Route(s) Next.js | Statut |
|---|---|---|
| A. Publier une mission | `/dashboard/client/missions/creation` | ✅ Implémenté |
| B. Fil des missions | `/dashboard/freelancer/recherche` | ✅ Implémenté |
| C. Détail + Proposition | `/dashboard/freelancer/missions/[id]` | ✅ Implémenté |
| D. Propositions reçues | `/dashboard/client/candidatures` | ✅ Implémenté |
| Chat / Meet / Call | `/dashboard/client/messages`, `/dashboard/freelancer/messages` (+ bulle flottante globale) | ✅ Implémenté (chat temps réel WebSocket, appels audio/vidéo WebRTC) |
| Offre formelle | `/dashboard/client/offres`, `/dashboard/freelancer/offres` | ✅ Implémenté (envoi, négociation, acceptation, retrait) |
| Contrat + Financement + Signature | `/dashboard/pilotage/[contractId]` (phases `NEGOTIATION` → `FUNDED`) | ✅ Implémenté |
| Pilotage + jalons (boucle) | `/dashboard/pilotage/[contractId]` (phase `CONTRACT_ACTIVE`, composants `client-detail.tsx` / `freelancer-detail.tsx`) | ✅ Implémenté |
| E–I. Litige (purge, prorata, appel, médiation, arbitrage) | `/dashboard/pilotage/[contractId]` (phase `DISPUTE_OPENED`, composant `PhaseDispute`) | ✅ Implémenté comme sous-étapes d'une même page à onglets (option retenue plutôt que des pages séparées) |
| J. Clôture | `/dashboard/pilotage/[contractId]` (phases `CLOSING` / `COMPLETED`, composant `PhaseClosing`) | ✅ Implémenté |
| K. Frais de plateforme | Commission 5% visible dans `mission-form-wizard.tsx`, `/tarifs`, `/cgu` | ⚠️ Partiel — pas de récapitulatif dédié à la clôture montrant la ventilation frais/montant net |
| L. Retrait des fonds | `/dashboard/freelancer/paiements` | ⚠️ Partiel — affiche l'historique des `PAYOUT`/`RELEASE`, mais aucun bouton "Demander un retrait" ; `/dashboard/freelancer/onboarding` ne gère que le KYC Stripe Connect |
| M. Évaluations mutuelles | `/dashboard/client/avis`, `/dashboard/freelancer/avis` | ❌ Non implémenté — pages statiques à "0"/"—", pas de modèle `Review` en base, pas de formulaire de soumission |

### Règles de navigation propres au litige (implémentées telles quelles)

- **Entrée automatique, pas manuelle** : le passage de la boucle jalons vers la phase `DISPUTE_OPENED` est déclenché par `advanceMilestone()` dans `lib/contract-workflow.ts` dès que le seuil de rejets (5) est atteint côté prestataire.
- **Purge → Prorata bloqué tant qu'un jalon reste en attente** : `PhaseDispute` (`components/contracts/workflow/index.tsx`) n'affiche le bouton "Calculer le prorata" que lorsque `submitted.length === 0`.
- **Fenêtre d'appel → Clôture directe si pas d'appel** : le bouton "Renoncer à l'appel" avance directement vers `DISPUTE_RESOLVED`. ⚠️ Il n'y a pas de minuteur automatique de 48h — la sortie par défaut est manuelle, pas basée sur le temps écoulé.
- **Retour impossible de l'arbitrage vers l'appel** : le flux de boutons ne propose pas de retour en arrière depuis `ARBITRATION`.
- **Traçabilité du montant à la clôture** : `PhaseClosing` affiche le détail des jalons validés et le montant final, avec la mention explicite du chemin (paiement intégral vs répartition litigieuse).

### Écarts restants à combler

1. **Frais de plateforme à la clôture** : ajouter un bloc récapitulatif (montant brut, commission 5%, montant net versé) dans `PhaseClosing`.
2. **Retrait des fonds** : construire un flux `/dashboard/freelancer/paiements/retrait` (formulaire IBAN/Payoneer + API `POST /api/payouts`) — actuellement absent.
3. **Évaluations mutuelles** : créer un modèle Prisma `Review` (auteur, cible, contractId, note, commentaire) + API `POST /api/reviews` + brancher les pages `avis` existantes sur ces données réelles, avec un formulaire déclenché depuis `PhaseClosing`.