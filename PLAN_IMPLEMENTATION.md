# Plan d'Implémentation Flexwork - Workflow Upwork-like

**Date**: 2026-07-02  
**Status**: Analyse complète + Recommandations

---

## 📋 Analyse du Plan3.md

### Workflow Standard (4 modules)

```
APPLICATION → INTERVIEW → OFFER → CONTRACT
```

Le plan3.md décrit un workflow simplifié inspiré par **Upwork** avec :

1. **Statuts d'Application** (11 statuts)
   - UNREAD, READ, SHORTLISTED, DISCUSSION, INTERVIEW
   - OFFER_SENT, OFFER_ACCEPTED, OFFER_DECLINED
   - SELECTED, ARCHIVED, REJECTED

2. **Deux types de contrats**
   - **Fixed**: Montant fixe + Jalons
   - **Hourly**: Taux horaire + Limite hebdomadaire

3. **Entités clés**
   - Application (candidature)
   - Interview (discussion/chat)
   - Offer (offre formelle)
   - Contract (contrat signé)

---

## ✅ Analyse de l'Existant (Schéma Prisma)

### Points Forts

✓ **Application** - Déjà existante avec `ApplicationStatus`  
✓ **Contract** - Modèle complet avec milestones et escrow  
✓ **Messages** - Infrastructure chat en place  
✓ **Mission** - Support budgets fixe/ouvert  
✓ **TimeSession** - Suivi temps pour contrats horaires  
✓ **User + FreelancerProfile + ClientProfile** - Rôles séparés  

### Gaps Identifiés

❌ **Application Status** - Manque des statuts plan3  
   - UNREAD ❌ (existe PENDING)
   - DISCUSSION ❌ (à ajouter)
   - INTERVIEW ❌ (à ajouter)
   - OFFER_SENT ❌ (à ajouter)
   - SELECTED ❌ (à ajouter)

❌ **Offer Model** - N'existe pas  
   - Besoin d'entité `Offer` intermédiaire  
   - Suivi propositions avant contrat

❌ **Interview/Discussion** - Pas d'entité explicite  
   - Messages liés à application, pas interview

❌ **Contract Budget Type** - Pas distinc Fixed/Hourly  
   - Budget unique, pas de taux horaire formalisé

❌ **Workflow Status Tracking** - Pas d'audit trail  
   - Historique des transitions statuts manquant

---

## 🔧 Schéma Prisma Recommandé

### 1. Ajouter/Modifier Enum ApplicationStatus

```prisma
enum ApplicationStatus {
  UNREAD            // Nouvelle candidature (0 action client)
  READ              // Lue par client
  SHORTLISTED       // Présélectionnée
  DISCUSSION        // En discussion (interview commencé)
  INTERVIEW         // Interview programmée
  OFFER_SENT        // Offre envoyée au freelance
  OFFER_ACCEPTED    // Offre acceptée → contrat à créer
  OFFER_DECLINED    // Offre refusée
  SELECTED          // Candidat retenu sans offre formelle
  ARCHIVED          // Archivée par client
  REJECTED          // Rejetée définitivement
  WITHDRAWN         // Retirée par freelance
}
```

### 2. Créer Entité Interview

```prisma
model Interview {
  id                String   @id @default(cuid())
  applicationId     String   @unique
  application       Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  
  // Planification
  scheduledAt       DateTime?
  duration          Int?      // en minutes
  format            String    // "CHAT", "VIDEO_CALL", "PHONE"
  notes             String?   @db.Text
  
  // Résultat
  completedAt       DateTime?
  feedbackByClient  String?   @db.Text
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([applicationId])
  @@map("interviews")
}
```

### 3. Créer Entité Offer

```prisma
enum OfferType {
  FIXED     // Montant fixe
  HOURLY    // Taux horaire
}

enum OfferStatus {
  DRAFT         // Brouillon
  SENT          // Envoyée au freelance
  ACCEPTED      // Acceptée → contrat à créer
  DECLINED      // Refusée
  EXPIRED       // Expirée
  WITHDRAWN     // Retirée par client
}

model Offer {
  id                String      @id @default(cuid())
  applicationId     String
  application       Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  
  // Basique
  title             String
  description       String?     @db.Text
  offerType         OfferType   @default(FIXED)
  
  // FIXED: Montant + Jalons
  totalBudget       Float?      // Montant total (si FIXED)
  milestones        Milestone[] // Jalons de paiement
  
  // HOURLY: Taux + Limite
  hourlyRate        Float?      // Taux horaire (si HOURLY)
  weeklyHourLimit   Int?        // Limite hebdo (ex: 40h)
  
  // Dates
  startDate         DateTime
  endDate           DateTime?   // Null si durée indéfinie
  
  // Statut
  status            OfferStatus @default(DRAFT)
  sentAt            DateTime?
  expiresAt         DateTime?   // Expiration si pas acceptée (ex: 7 jours)
  acceptedAt        DateTime?
  declinedAt        DateTime?
  declineReason     String?
  
  // Audit
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  sentBy            String      // ID user qui a envoyé
  
  // Contrat généré
  contract          Contract?
  
  @@index([applicationId, status])
  @@index([status, expiresAt])
  @@map("offers")
}
```

### 4. Modifier Application

```prisma
model Application {
  id              String            @id @default(cuid())
  freelancerId    String
  freelancer      FreelancerProfile @relation(fields: [freelancerId], references: [id])
  missionId       String
  mission         Mission           @relation(fields: [missionId], references: [id])
  
  // Candidature
  coverLetter     String?           @db.Text
  proposedBudget  Float?
  proposedDays    Int?              // Durée proposition
  
  // Statut
  status          ApplicationStatus @default(UNREAD)
  
  // Relations
  interview       Interview?
  offers          Offer[]
  statusHistory   ApplicationStatusHistory[]
  
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  
  @@unique([freelancerId, missionId])
  @@index([status, missionId])
  @@map("applications")
}
```

### 5. Créer Audit Trail

```prisma
model ApplicationStatusHistory {
  id              String            @id @default(cuid())
  applicationId   String
  application     Application       @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  
  fromStatus      ApplicationStatus
  toStatus        ApplicationStatus
  changedBy       String            // ID user (client/freelancer/admin)
  reason          String?           // Motif si rejeté/archivé
  
  createdAt       DateTime          @default(now())
  
  @@index([applicationId, createdAt])
  @@map("application_status_history")
}
```

### 6. Modifier Contract

```prisma
enum ContractType {
  FIXED     // Montant fixe
  HOURLY    // Taux horaire
}

model Contract {
  id            String         @id @default(cuid())
  offerId       String         @unique
  offer         Offer          @relation(fields: [offerId], references: [id])
  
  missionId     String         @unique
  mission       Mission        @relation(fields: [missionId], references: [id])
  
  freelancerId  String
  freelancer    FreelancerProfile @relation("FreelancerContracts", fields: [freelancerId], references: [id])
  
  // Type & Budget
  contractType  ContractType   @default(FIXED)
  
  // FIXED
  totalBudget   Float?
  
  // HOURLY
  hourlyRate    Float?
  weeklyHourLimit Int?
  
  // Statut
  status        ContractStatus @default(PENDING)
  startDate     DateTime
  endDate       DateTime?
  
  // Escrow
  escrowAmount  Float?
  escrowId      String?
  
  // Relations
  milestones    Milestone[]
  messages      Message[]
  timeSessions  TimeSession[]
  
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  
  @@map("contracts")
}
```

---

## 🛡️ Plan d'Implémentation Sécurisé

### Phase 1: Préparation (2-3 jours)

#### 1.1 Migration Prisma Sécurisée

```bash
# Étape 1: Créer migration vide (inspection)
npx prisma migrate dev --name add_workflow_upwork_stage1 --create-only

# Étape 2: Ajouter les 5 nouveaux modèles
# - Interview
# - Offer
# - ApplicationStatusHistory
# - Modifier Application
# - Modifier Contract

# Étape 3: Tester en local
npm run test:migrations

# Étape 4: Valider schéma
npx prisma validate

# Étape 5: Générer Prisma Client
npx prisma generate
```

#### 1.2 Tests Unitaires

Créer tests pour chaque modèle :
```
tests/models/interview.test.ts
tests/models/offer.test.ts
tests/models/application-status.test.ts
tests/models/contract-workflow.test.ts
```

### Phase 2: API Endpoints (1 semaine)

#### 2.1 Application Management

```
GET    /api/missions/{id}/applications          // Lister candidatures
PATCH  /api/applications/{id}/status            // Changer statut
GET    /api/applications/{id}/history           // Historique statuts
```

#### 2.2 Interview Management

```
POST   /api/applications/{id}/interview         // Programmer interview
PATCH  /api/applications/{id}/interview         // Mettre à jour résultat
```

#### 2.3 Offer Management

```
POST   /api/applications/{id}/offer             // Créer offre
PATCH  /api/offers/{id}                         // Modifier offre (draft)
PATCH  /api/offers/{id}/send                    // Envoyer offre
PATCH  /api/offers/{id}/accept                  // Accepter offre
PATCH  /api/offers/{id}/decline                 // Refuser offre
GET    /api/offers/{id}                         // Voir détails offre
```

#### 2.4 Validations

```typescript
// Application Status Transitions
const validTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  UNREAD: ["READ", "SHORTLISTED", "ARCHIVED"],
  READ: ["SHORTLISTED", "ARCHIVED", "REJECTED"],
  SHORTLISTED: ["DISCUSSION", "ARCHIVED"],
  DISCUSSION: ["INTERVIEW", "OFFER_SENT", "ARCHIVED"],
  INTERVIEW: ["OFFER_SENT", "ARCHIVED"],
  OFFER_SENT: ["OFFER_ACCEPTED", "OFFER_DECLINED"],
  OFFER_ACCEPTED: ["SELECTED"],
  OFFER_DECLINED: ["SHORTLISTED"],
  SELECTED: [],
  ARCHIVED: [],
  REJECTED: [],
  WITHDRAWN: [],
};
```

### Phase 3: Logique Métier (1 semaine)

#### 3.1 État Machine Application

```typescript
// state-machine/application.ts
class ApplicationStateMachine {
  static canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean
  static getNextStates(current: ApplicationStatus): ApplicationStatus[]
  static transition(app: Application, to: ApplicationStatus, by: string): Promise<void>
}
```

#### 3.2 Création Contrat à partir Offre

```typescript
// services/offer.service.ts
async acceptOffer(offerId: string): Promise<Contract> {
  // 1. Valider offre acceptée
  // 2. Créer contrat avec données offre
  // 3. Initialiser escrow si needed
  // 4. Changer statuts (Application → SELECTED, Offer → ACCEPTED)
  // 5. Notifier client + freelance
  // 6. Créer chat/workspace contrat
}
```

#### 3.3 Notifications

```typescript
// Événements
- application.submitted      → Email client
- application.shortlisted    → Email freelance
- interview.scheduled        → Email + SMS freelance
- offer.sent                 → Email + Notification freelance
- offer.accepted             → Email client (contrat créé)
- offer.declined             → Email client + Suggestion autres candidats
```

### Phase 4: Frontend (1 semaine)

#### 4.1 Côté Client

```
/dashboard/missions/{id}/applications
  - Liste candidatures filtrées par statut
  - Action: Shortlist, Archive, Decline
  - Détails: Portfolio, Prix, Avis

/dashboard/missions/{id}/applications/{appId}
  - Profil candidat complet
  - Chat/Discussion
  - Programmer interview
  - Créer & Envoyer offre
  - Historique statuts
```

#### 4.2 Côté Freelance

```
/dashboard/applications
  - Mes candidatures (statuts)
  - Notifications offres
  - Accepter/Refuser offre
  - Répondre questions interview
```

### Phase 5: Sécurité & Audit (3-4 jours)

#### 5.1 Contrôles d'Accès

```typescript
// Seulement client peut:
- Créer/Lire applications pour sa mission
- Changer statut application
- Programmer interview
- Créer/Envoyer/Retirer offre

// Seulement freelance peut:
- Lire ses candidatures
- Accepter/Refuser offre
- Participer interview

// Seulement admin peut:
- Accéder audit trail complet
```

#### 5.2 Rate Limiting

```typescript
- POST /api/applications/{id}/offer → 5 offres/heure par client
- PATCH /api/applications/{id}/status → 30 actions/jour par client
- POST /api/applications/{id}/interview → 10 interviews/jour par client
```

#### 5.3 Audit Logging

```
ApplicationStatusHistory - Chaque transition enregistrée
- Qui (userId)
- Quand (timestamp)
- De quel statut à quel statut
- Raison optionnelle

Contrôler: SELECT * FROM application_status_history 
          WHERE application_id = ... ORDER BY created_at DESC
```

---

## 📊 Ordre d'Exécution Recommandé

### Sprint 1 (Week 1)
1. Migration Prisma + Models (Interview, Offer, StatusHistory)
2. Tests unitaires modèles
3. Endpoints CRUD de base

### Sprint 2 (Week 2)
1. State machine + validations transitions
2. Services métier (acceptOffer, declineOffer, etc.)
3. Notifications

### Sprint 3 (Week 3)
1. Frontend client (liste applications, créer offre)
2. Frontend freelance (vue candidatures, accepter offre)
3. Audit trail UI

### Sprint 4 (Week 4)
1. Tests d'intégration E2E complets
2. Déploiement staging
3. Tests sécurité (injection, brute-force, etc.)

---

## 🔒 Checklist Sécurité

- [ ] Validation des transitions statuts strictes
- [ ] Vérification propriété (client = mission, freelance = application)
- [ ] Audit trail immutable (INSERT-only, pas UPDATE/DELETE)
- [ ] Rate limiting endpoints sensibles
- [ ] Chiffrement données sensibles (offre avant envoi)
- [ ] Logs des actions critiques (offre acceptée, contrat créé)
- [ ] Tests injection SQL/NoSQL
- [ ] Tests CSRF/XSS
- [ ] Validation côté serveur stricte
- [ ] Gestion erreurs sans fuite info
- [ ] Backup quotidien données de production

---

## 📝 Fichiers à Modifier/Créer

```
prisma/
  └── schema.prisma              ← Modèles + Enums

src/lib/
  ├── state-machine/
  │   └── application.ts
  └── validations/
      └── application-workflow.ts

src/api/
  └── applications/
      ├── index.ts               ← List, filter
      ├── [id]/
      │   ├── status.ts          ← PATCH status
      │   ├── history.ts         ← GET history
      │   ├── interview/
      │   │   ├── index.ts
      │   │   └── [interviewId].ts
      │   └── offer/
      │       ├── index.ts
      │       └── [offerId].ts

tests/
  └── api/
      ├── application-workflow.test.ts
      ├── offer-lifecycle.test.ts
      └── contract-creation.test.ts

docs/
  └── workflow-implementation.md
```

---

## 🚀 Déploiement Phases

### Staging (Test complet)
1. Migration DB staging
2. Tests complets E2E
3. Test load (50+ users concurrents)
4. Security audit

### Production (Rollout progressif)
1. Backup DB
2. Migration production
3. Deploy API
4. Deploy Frontend
5. Monitoring actif (24h)
6. Rollback plan prêt

---

## ⚠️ Risques & Mitigations

| Risque | Mitigation |
|--------|-----------|
| Perte données statuts | Audit trail immutable + backup |
| Race condition statuts | Optimistic locking + version field |
| Offre envoyée deux fois | Idempotency key + état transactionnel |
| Freelance accepte offre expirée | Vérifier expiresAt avant acceptance |
| Client crée offre montant 0 | Validation minimum (>0) |

---

## 📚 Documentation à Générer

- [ ] Diagramme flux Application → Contract
- [ ] Tableau transitions statuts complet
- [ ] Guide intégration frontend pour devs
- [ ] Runbook opérationnel (troubleshoot statuts)
- [ ] Plan de données (anonymisation/export)

---

**Prochaine étape**: Valider ce plan, puis lancer Sprint 1 avec migration Prisma.
