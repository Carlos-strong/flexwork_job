Si tu veux reproduire le **workflow standard Upwork**, le processus est beaucoup plus simple que celui que je t'avais proposé pour TrustEngine.

### Workflow standard de sélection → contrat

```text
Candidature reçue
        │
        ▼
Review de la candidature
        │
        ├── Refuser
        │
        ├── Archiver
        │
        └── Shortlist
                │
                ▼
        Discussion / Chat
                │
                ▼
        Entretien (optionnel)
                │
                ▼
        Sélection du candidat
                │
                ▼
        Création de l'offre
                │
                ▼
        Envoi de l'offre
                │
                ▼
        Acceptation par le freelance
                │
                ▼
        Création du contrat
                │
                ▼
        Début de la mission
```

---

### États (Status) des candidatures

| Statut           | Description           |
| ---------------- | --------------------- |
| Submitted        | Candidature soumise   |
| Viewed           | Candidature consultée |
| Shortlisted      | Présélectionnée       |
| Archived         | Archivée              |
| Declined         | Refusée               |
| Interviewing     | Discussion en cours   |
| Selected         | Candidat retenu       |
| Offer Sent       | Offre envoyée         |
| Offer Accepted   | Offre acceptée        |
| Offer Declined   | Offre refusée         |
| Contract Created | Contrat créé          |

---

### Processus détaillé

#### 1. Candidature reçue

Le freelance soumet :

* Cover Letter
* Prix proposé
* Délai
* Portfolio
* Réponses aux questions

```text
Status = SUBMITTED
```

---

#### 2. Analyse par le client

Actions possibles :

```text
✓ Voir le profil
✓ Voir le portfolio
✓ Consulter les avis
✓ Consulter les certifications
```

Le client peut :

```text
SHORTLIST
ARCHIVE
DECLINE
```

---

#### 3. Discussion

Lorsque le client est intéressé :

```text
Status = INTERVIEWING
```

Création automatique :

* Chat privé
* Échange de fichiers
* Questions/Réponses

---

#### 4. Sélection

Le client choisit le freelance.

```text
Status = SELECTED
```

À ce stade il n'y a toujours pas de contrat.

---

#### 5. Création de l'offre

Le client remplit :

##### Contrat fixe

```text
Titre

Description

Montant

Jalons

Date de début
```

##### Contrat horaire

```text
Titre

Description

Taux horaire

Limite hebdomadaire

Date de début
```

---

#### 6. Envoi de l'offre

```text
Status = OFFER_SENT
```

Le freelance reçoit :

* Notification
* Email
* Message interne

---

#### 7. Réponse du freelance

##### Accepter

```text
Status = OFFER_ACCEPTED
```

##### Refuser

```text
Status = OFFER_DECLINED
```

---

#### 8. Création automatique du contrat

Après acceptation :

```text
Status = CONTRACT_CREATED
```

Le système génère :

* Contrat
* Workspace projet
* Chat projet
* Gestion des fichiers
* Facturation
* Paiements

---

### Modèle de base de données recommandé

Je te recommande de séparer :

```text
Job
│
├── Applications
│       ├── Submitted
│       ├── Shortlisted
│       ├── Declined
│       └── Archived
│
├── Interviews
│
├── Offers
│       ├── Draft
│       ├── Sent
│       ├── Accepted
│       └── Declined
│
└── Contracts
        ├── Active
        ├── Completed
        └── Closed
```

---

Pour une implémentation très proche d'Upwork, le workflow métier peut être résumé en **4 modules principaux** :

```text
APPLICATION
    ↓
INTERVIEW
    ↓
OFFER
    ↓
CONTRACT
```

C'est exactement cette séparation qui rend l'architecture d'Upwork simple, évolutive et facile à maintenir.
