> **Mise à jour (2026-07-15)** : les pages HTML prototypes (`chatbox_meet_call.html`,
> `contrat_prestation.html`, `pilotage_mission.html`, `client_jalons.html`,
> `prestataire_jalons.html`, `offre_prestataire.html`) ont été implémentées en React/Next.js.
> Elles sont remplacées ci-dessous par leurs routes réelles, avec mention du statut
> d'implémentation à la fin de ce document.

## Workflow — Client

```
A. Publier une mission
   - Titre, description, budget, compétences requises
   - Route : /dashboard/client/missions/creation
        │
        ▼
D. Propositions reçues (dashboard d'attente)
   - Compare les propositions soumises par les prestataires
   - Sélectionne UNE proposition
   - Route : /dashboard/client/candidatures
        │
        ▼
Messagerie + appels audio/vidéo (chat/meet/call)
   - Discussion, entretien (chat/audio/vidéo) avec le prestataire retenu
   - Négociation informelle avant l'offre formelle
   - Route : /dashboard/client/messages (+ bulle flottante globale)
        │
        ▼
Création de l'offre formelle
   - Le client fixe : jalons, montants, délais
   - Envoi de l'offre au prestataire
   - Route : /dashboard/client/offres
        │
   ┌────┴─────────────────┐
   │                       │
Refusée/contre-proposée   Acceptée
   │                       │
   ▼                       ▼
Retour à la messagerie Financement de l'escrow
(négociation)          - Le client dépose le montant total
                       - Précondition à la signature
                            │
                            ▼
                       Double signature
                       - Le client signe (le prestataire signe aussi)
                            │
                            ▼
                       Contrat scellé et actif
                       - Route : /dashboard/pilotage/[contractId]
                            │
                            ▼
                       Hub de pilotage (vue client)
                       - Progression globale, montant en séquestre
                       - Route : /dashboard/pilotage/[contractId]
                            │
                            ▼
                       Jalons — vue client (client-detail.tsx)
                       - Bouton "Vérifier" / "Révision(N)" sur chaque jalon soumis
                       - Visualise les preuves, valide ou rejette (motif obligatoire)
                            │
                       ┌────┴─────────────────────────┐
                       │                               │
              Tous les jalons validés          Seuil de rejets dépassé
                       │                       sur un jalon
                       │                               │
                       │                               ▼
                       │                   Litige — Purge
                       │                   - Doit trancher tout jalon en attente
                       │                               │
                       │                               ▼
                       │                   Litige — Calcul du prorata
                       │                   (automatique, rien à faire ici)
                       │                               │
                       │                               ▼
                       │                   Litige — Fenêtre d'appel 48h
                       │                   - Le client peut faire appel si en désaccord
                       │                     avec un jalon validé tacitement
                       │                               │
                       │                     ┌─────────┴─────────┐
                       │                     │                   │
                       │              Pas d'appel           Appel du client
                       │                     │                   │
                       │                     │                   ▼
                       │                     │      Litige — Médiation interne
                       │                     │      - Présente ses preuves si convoqué
                       │                     │                   │
                       │                     │      (→ arbitrage externe disponible ;
                       │                     │         ⚠️ pas de vérification de seuil
                       │                     │         d'enjeu dans l'implémentation actuelle)
                       │                     │                   │
                       └─────────────────────┴───────────────────┘
                                             │
                                             ▼
                       Clôture — Route : /dashboard/pilotage/[contractId]
                       - Voit le montant final versé et sa justification
                            │
                            ▼
                       Évaluation du prestataire
                       - Note qualité, communication, délai
                       - Route : /dashboard/client/avis (⚠️ non implémenté — page vide)
```

**Ce que le client ne fait jamais** : soumettre des preuves, retirer des fonds — ces étapes n'existent que côté prestataire.

---

## Workflow — Prestataire

```
B. Fil des missions
   - Parcourt les missions ouvertes, filtre par compétence/budget
   - Route : /dashboard/freelancer/recherche
        │
        ▼
C. Détail mission + Proposition
   - Message personnalisé, prix, délai, portfolio
   - Envoi de la proposition (consomme des "connects")
   - Route : /dashboard/freelancer/missions/[id]
        │
   ┌────┴─────────────────┐
   │                       │
Non retenu              Retenu
(notification,           │
fin de parcours)         ▼
                    Messagerie + appels audio/vidéo (chat/meet/call)
                    - Discussion, entretien avec le client
                    - Route : /dashboard/freelancer/messages (+ bulle flottante globale)
                         │
                         ▼
                    Offre formelle du client
                    - Lecture de l'offre (jalons, montant, délais)
                    - Route : /dashboard/freelancer/offres
                         │
                    ┌────┴─────────────────┐
                    │                       │
                 Refuse               Contre-propose        Accepte
                    │                       │                  │
                    ▼                       ▼                  │
              (fin de parcours)      Retour à la messagerie     │
                                     (négociation)               │
                                                                  ▼
                                                    Attente du financement client
                                                    (aucune action possible ici)
                                                                  │
                                                                  ▼
                                                    Double signature
                                                    - Le prestataire signe
                                                                  │
                                                                  ▼
                                                    Contrat scellé et actif
                                                    - Route : /dashboard/pilotage/[contractId]
                                                                  │
                                                                  ▼
                                                    Hub de pilotage (vue prestataire)
                                                    - Route : /dashboard/pilotage/[contractId]
                                                                  │
                                                                  ▼
                                                    Jalons — vue prestataire (freelancer-detail.tsx)
                                                    - "Soumettre preuve" (1ère fois)
                                                    - "Réviser" (après rejet du client)
                                                    - "Complété" (grisé, définitif)
                                                                  │
                                                    ┌─────────────┴─────────────┐
                                                    │                           │
                                          Jalon validé par le client   Rejeté trop de fois
                                                    │                  (seuil dépassé)
                                                    │                           │
                                                    │                           ▼
                                                    │              Litige — Purge
                                                    │              (le prestataire attend,
                                                    │               n'agit pas à cette étape)
                                                    │                           │
                                                    │                           ▼
                                                    │              Litige — Calcul du prorata
                                                    │              (automatique)
                                                    │                           │
                                                    │                           ▼
                                                    │              Litige — Fenêtre d'appel 48h
                                                    │              - Le prestataire peut faire appel
                                                    │                si le prorata l'écarte injustement
                                                    │                (preuve obligatoire : preuves
                                                    │                complémentaires du travail livré)
                                                    │                           │
                                                    │                 ┌─────────┴─────────┐
                                                    │                 │                   │
                                                    │           Pas d'appel        Appel du prestataire
                                                    │                 │                   │
                                                    │                 │                   ▼
                                                    │                 │      Litige — Médiation interne
                                                    │                 │      - Présente ses preuves
                                                    │                 │                   │
                                                    │                 │      (→ arbitrage externe si
                                                    │                 │         enjeu > seuil, à sa
                                                    │                 │         charge s'il conteste)
                                                    │                 │                   │
                                                    └─────────────────┴───────────────────┘
                                                                      │
                                                                      ▼
                                                    Clôture — Route : /dashboard/pilotage/[contractId]
                                                    - Voit le montant qui lui est versé
                                                                      │
                                                                      ▼
                                                    Retrait des fonds
                                                    - Compte bancaire, Payoneer, etc.
                                                    - Route : /dashboard/freelancer/paiements
                                                    - ⚠️ Non implémenté : historique en lecture
                                                      seule uniquement, aucun bouton de demande
                                                      de retrait ni API /api/payouts
                                                                      │
                                                                      ▼
                                                    Évaluation du client
                                                    - Route : /dashboard/freelancer/avis
                                                    - ⚠️ Non implémenté — page vide
```

### Points de synchronisation entre les deux workflows

| Moment | Ce que voit le client | Ce que voit le prestataire |
|---|---|---|
| Soumission d'une proposition | Nouvelle ligne dans "Propositions reçues" | "En attente de réponse" |
| Envoi de l'offre | "Offre envoyée" | Notification + `/dashboard/freelancer/offres` |
| Financement | Bouton "Sécuriser maintenant" | "En attente du financement" (rien à faire) |
| Jalon soumis | Badge "À valider" dans la vue jalons client | Bouton "En attente du client" (désactivé) |
| Rejet | — (vient de rejeter) | Motif affiché + bouton "Réviser" |
| Clôture | Montant versé + justification | Montant reçu, mais pas d'accès à un retrait (⚠️ non implémenté) |

### Statut d'implémentation (vue d'ensemble)

| Composant théorique | Implémentation réelle | Statut |
|---|---|---|
| `chatbox_meet_call.html` | `/dashboard/{client,freelancer}/messages` + bulle flottante | ✅ Implémenté |
| `offre_prestataire.html` | `/dashboard/{client,freelancer}/contrats/offres` | ✅ Implémenté |
| `contrat_prestation.html` | `/dashboard/pilotage/[contractId]` (phases contrat) | ✅ Implémenté |
| `pilotage_mission.html` | `/dashboard/pilotage/[contractId]` (hub unique client + prestataire) | ✅ Implémenté |
| `client_jalons.html` / `prestataire_jalons.html` | `client-detail.tsx` / `freelancer-detail.tsx` dans le hub de pilotage | ✅ Implémenté |
| Litige (purge, prorata, appel, médiation, arbitrage) | `PhaseDispute` — une seule page à onglets (option retenue) | ✅ Implémenté, mais sans minuteur 48h automatique ni vérif. de seuil d'enjeu |
| Retrait des fonds | `/dashboard/freelancer/paiements` | ❌ Historique seul — flux de demande absent |
| Évaluations mutuelles | `/dashboard/{client,freelancer}/avis` | ❌ Pages vides, pas de modèle `Review` ni d'API |

**Décision prise** : le litige a été implémenté comme **une seule page à onglets** (`PhaseDispute`
dans `components/contracts/workflow/index.tsx`) plutôt que 4 pages séparées et navigables —
résolvant l'arbitrage laissé en suspens dans la version précédente de ce document.