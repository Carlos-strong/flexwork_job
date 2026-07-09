# 🚀 Migration Workflow Upwork - Étapes Finales

## État Actuel ✅

Toute la structure code a été implémentée:
- ✅ Schéma Prisma mis à jour (validé)
- ✅ Services métier créés
- ✅ API endpoints REST créés
- ✅ Composants UI/UX React créés
- ✅ Validations et state machine
- ✅ Documentation

## ⚠️ Étapes Requises Avant Production

### 1. Préparer l'Environnement

```bash
# Démarrer PostgreSQL
# Sur Windows:
pg_ctl -D "C:\Program Files\PostgreSQL\data" start

# Sur macOS:
brew services start postgresql@15

# Sur Linux:
sudo systemctl start postgresql
```

### 2. Appliquer la Migration Prisma

Une fois la DB accessible:

```bash
cd c:\Users\benca\Documents\Projets\Flexwork_job

# Créer la migration
npx prisma migrate dev --name add_workflow_upwork_models

# Ou si force reset (DEV ONLY):
npx prisma migrate reset --force
npx prisma migrate dev --name add_workflow_upwork_models
```

### 3. Générer le Client Prisma

```bash
# Après la migration
npx prisma generate

# Vérifier la génération
ls node_modules/@prisma/client/
```

### 4. Tester les Endpoints Créés

```bash
# Lancer le serveur dev
npm run dev

# Tester la création d'offre
curl -X POST http://localhost:3000/api/applications/test-app-id/offer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Offre Test",
    "offerType": "FIXED",
    "totalBudget": 500000,
    "startDate": "2026-07-03"
  }'
```

### 5. Compiler TypeScript

```bash
# Vérifier qu'il n'y a pas d'erreurs TS
npm run build

# Si erreurs liées à Prisma, régénérer:
rm -rf node_modules/.prisma
npx prisma generate --force
```

## 📊 Fichiers SQL - Migration Manuelle (Si Nécessaire)

Si la migration Prisma échoue, voici les commandes SQL brutes:

```sql
-- 1. Ajouter les nouveaux ENUMS
CREATE TYPE "OfferType" AS ENUM ('FIXED', 'HOURLY');
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN');
CREATE TYPE "InterviewFormat" AS ENUM ('CHAT', 'VIDEO_CALL', 'PHONE', 'MEETING');
CREATE TYPE "ContractType" AS ENUM ('FIXED', 'HOURLY');

-- 2. Créer la table interviews
CREATE TABLE "interviews" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "applicationId" TEXT NOT NULL UNIQUE,
  "scheduledAt" TIMESTAMP(3),
  "duration" INTEGER,
  "format" "InterviewFormat" NOT NULL DEFAULT 'CHAT',
  "notes" TEXT,
  "completedAt" TIMESTAMP(3),
  "feedbackByClient" TEXT,
  "feedbackByFreelancer" TEXT,
  "rating" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE
);

CREATE INDEX "interviews_applicationId_idx" ON "interviews"("applicationId");
CREATE INDEX "interviews_scheduledAt_idx" ON "interviews"("scheduledAt");

-- 3. Créer la table offers
CREATE TABLE "offers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "applicationId" TEXT NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "offerType" "OfferType" NOT NULL DEFAULT 'FIXED',
  "totalBudget" DOUBLE PRECISION,
  "hourlyRate" DOUBLE PRECISION,
  "weeklyHourLimit" INTEGER,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
  "sentAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "declineReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "offers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE
);

CREATE INDEX "offers_applicationId_status_idx" ON "offers"("applicationId", "status");
CREATE INDEX "offers_status_expiresAt_idx" ON "offers"("status", "expiresAt");

-- 4. Créer la table application_status_history
CREATE TABLE "application_status_history" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "applicationId" TEXT NOT NULL,
  "fromStatus" "ApplicationStatus" NOT NULL,
  "toStatus" "ApplicationStatus" NOT NULL,
  "changedBy" VARCHAR(255) NOT NULL,
  "changedByRole" VARCHAR(50) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_status_history_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE
);

CREATE INDEX "application_status_history_applicationId_createdAt_idx" ON "application_status_history"("applicationId", "createdAt");
CREATE INDEX "application_status_history_applicationId_idx" ON "application_status_history"("applicationId");

-- 5. Modifier la table applications
ALTER TABLE "applications" 
ADD COLUMN "proposedDays" INTEGER,
ADD COLUMN "interview" TEXT REFERENCES "interviews"("id");

CREATE INDEX "applications_status_missionId_idx" ON "applications"("status", "missionId");
CREATE INDEX "applications_freelancerId_status_idx" ON "applications"("freelancerId", "status");

-- 6. Modifier la table contracts
ALTER TABLE "contracts"
ADD COLUMN "offerId" TEXT UNIQUE REFERENCES "offers"("id"),
ADD COLUMN "contractType" "ContractType" DEFAULT 'FIXED',
ADD COLUMN "totalBudget" DOUBLE PRECISION,
ADD COLUMN "hourlyRate" DOUBLE PRECISION,
ADD COLUMN "weeklyHourLimit" INTEGER,
ADD COLUMN "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "endDate" TIMESTAMP(3);

CREATE INDEX "contracts_status_createdAt_idx" ON "contracts"("status", "createdAt");
CREATE INDEX "contracts_freelancerId_idx" ON "contracts"("freelancerId");

-- 7. Modifier la table milestones
ALTER TABLE "milestones"
ADD COLUMN "offerId" TEXT REFERENCES "offers"("id") ON DELETE CASCADE,
ALTER COLUMN "contractId" DROP NOT NULL;

CREATE INDEX "milestones_offerId_idx" ON "milestones"("offerId");
CREATE INDEX "milestones_contractId_idx" ON "milestones"("contractId");
```

## 🧪 Tests Post-Migration

```bash
# Tester les validations
npm test -- lib/validations/application-workflow.test.ts

# Tester les services
npm test -- lib/services/application.service.test.ts
npm test -- lib/services/offer.service.test.ts

# Tester les composants
npm test -- components/applications/**/*.test.tsx

# Tests d'intégration complets
npm run test:e2e
```

## 📱 Vérification Finale

Checklist avant déploiement:

- [ ] Migration Prisma appliquée
- [ ] Tous les types Prisma générés
- [ ] Pas d'erreurs TypeScript (`npm run build`)
- [ ] Endpoints API testés avec Postman/Insomnia
- [ ] Composants affichés correctement (`npm run dev`)
- [ ] Tests passent (`npm test`)
- [ ] Audit trail enregistré dans la DB
- [ ] Notifications envoyées
- [ ] Permissions vérifiées
- [ ] Logs centralisés configurés

## 🎯 Prochaines Phases

### Phase 2 - Monitoring & Analytics
- Dashboard pour les métrics du workflow
- Alertes sur statuts bloqués
- Analytics conversions

### Phase 3 - Améliorations UX
- Drag & drop pour kanban des candidatures
- Notifications en temps réel (WebSocket)
- Bulk actions sur candidatures

### Phase 4 - Intégrations
- Webhook pour événements workflow
- Slack notifications
- Calendrier intégré (Google Calendar, Outlook)

## 📞 Support Déploiement

En cas de problème:

1. **Erreur de migration**: Vérifier les contraintes FK, relancer `npx prisma migrate resolve --applied add_workflow_upwork_models`
2. **Erreurs TypeScript**: Régénérer Prisma: `rm -rf node_modules/@prisma/client && npx prisma generate --force`
3. **Endpoints non réactifs**: Vérifier les middleware d'auth dans `lib/auth.ts`
4. **Composants bugués**: Consol logs dans le browser, vérifier les erreurs React

---

**Statut:** ✅ Code complet, prêt pour migration DB  
**Dernière MAJ:** 2026-07-02
