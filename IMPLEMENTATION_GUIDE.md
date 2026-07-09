# Guide d'Implémentation du Workflow Upwork-like

## ✅ Implémentation Complète

Toute la structure pour le workflow d'applications → offres → contrats a été implémentée.

### Structure des Fichiers Créés

```
lib/
├── validations/
│   └── application-workflow.ts         ← State machine & validations
├── services/
│   ├── application.service.ts          ← Gestion candidatures
│   └── offer.service.ts                ← Gestion offres

app/
└── api/
    ├── applications/[id]/
    │   ├── interview/route.ts          ← API interviews
    │   └── offer/route.ts              ← API création offres
    └── offers/[id]/
        └── route.ts                    ← API accept/decline/send

components/
└── applications/
    ├── ApplicationCard.tsx             ← Affichage candidature
    ├── ApplicationList.tsx             ← Liste filtrée
    ├── ApplicationTimeline.tsx         ← Historique statuts
    ├── InterviewManager.tsx            ← Gestion interviews
    ├── OfferDisplay.tsx                ← Affichage offres
    └── OfferForm.tsx                   ← Formulaire création offres
```

## 🚀 Prochaines Étapes

### 1. Créer la Migration Prisma

```bash
# Terminal dans le projet

# 1. Valider le schéma
npx prisma validate

# 2. Créer la migration
npx prisma migrate dev --name add_workflow_upwork

# 3. Générer le client Prisma
npx prisma generate
```

### 2. Tester les Endpoints

```bash
# Créer une offre
curl -X POST http://localhost:3000/api/applications/{id}/offer \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Développement Frontend",
    "offerType": "FIXED",
    "totalBudget": 500000,
    "startDate": "2026-07-03",
    "milestones": [
      {
        "title": "Phase 1",
        "amount": 250000,
        "dueDate": "2026-07-15"
      }
    ]
  }'

# Envoyer une offre
curl -X PATCH http://localhost:3000/api/offers/{id}?action=send \
  -H "Content-Type: application/json" \
  -d '{"expiresAt": "2026-07-10T23:59:59Z"}'

# Accepter une offre
curl -X PATCH http://localhost:3000/api/offers/{id}?action=accept \
  -H "Content-Type: application/json" \
  -d '{}'

# Refuser une offre
curl -X PATCH http://localhost:3000/api/offers/{id}?action=decline \
  -H "Content-Type: application/json" \
  -d '{"reason": "Budget insuffisant"}'
```

### 3. Intégrer les Composants dans les Pages

**Page Client - Liste Candidatures**
```tsx
import { ApplicationList } from "@/components/applications/ApplicationList";
import { ApplicationService } from "@/lib/services/application.service";

export default async function CandidaturesPage() {
  const applications = await prisma.application.findMany({
    where: { mission: { client: { user: { id: userId } } } },
    include: {
      freelancer: { include: { user: true } },
      mission: true,
    },
  });

  return (
    <ApplicationList 
      applications={applications} 
      canManage={true}
      onStatusChange={handleStatusChange}
    />
  );
}
```

**Page Application - Détails**
```tsx
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import { OfferForm } from "@/components/applications/OfferForm";
import { InterviewManager } from "@/components/applications/InterviewManager";
import { ApplicationTimeline } from "@/components/applications/ApplicationTimeline";

export default async function ApplicationDetailsPage() {
  const application = await prisma.application.findUnique({
    where: { id: params.id },
    include: {
      interview: true,
      offers: { include: { milestones: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });

  return (
    <div className="space-y-6">
      <ApplicationCard {...application} canManage={true} />
      
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <InterviewManager applicationId={application.id} interview={application.interview} />
          
          <OfferForm applicationId={application.id} />
        </div>
        
        <div>
          <ApplicationTimeline 
            history={application.statusHistory} 
            currentStatus={application.status}
          />
        </div>
      </div>
    </div>
  );
}
```

## 📊 Schema Prisma - Résumé des Changements

### Nouveaux Enums
- `OfferType` (FIXED, HOURLY)
- `OfferStatus` (DRAFT, SENT, ACCEPTED, DECLINED, EXPIRED, WITHDRAWN)
- `InterviewFormat` (CHAT, VIDEO_CALL, PHONE, MEETING)
- `ContractType` (FIXED, HOURLY)

### Nouveaux Modèles
1. **Interview** - Entretiens entre client et freelance
2. **Offer** - Offres formelles de missions
3. **ApplicationStatusHistory** - Audit trail des transitions

### Modèles Modifiés
- **Application** - Ajout relations Interview, Offer, statusHistory
- **Contract** - Ajout offerId, contractType, hourlyRate, weeklyHourLimit
- **Milestone** - Peut être lié à Offer ou Contract

## 🔐 Validation et Permissions

### State Machine - Transitions Valides

```
UNREAD → READ, SHORTLISTED, ARCHIVED, REJECTED
READ → SHORTLISTED, ARCHIVED, REJECTED
SHORTLISTED → DISCUSSION, ARCHIVED, WITHDRAWN
DISCUSSION → INTERVIEW, OFFER_SENT, ARCHIVED, WITHDRAWN
INTERVIEW → OFFER_SENT, ARCHIVED, WITHDRAWN
OFFER_SENT → OFFER_ACCEPTED, OFFER_DECLINED
OFFER_ACCEPTED → SELECTED
OFFER_DECLINED → SHORTLISTED, ARCHIVED
```

### Permissions

**Client peut:**
- Lire toutes les candidatures de ses missions
- Shortlister / Archiver / Refuser
- Créer & Envoyer offres
- Programmer entretiens
- Voir historique

**Freelance peut:**
- Lire ses candidatures
- Accepter / Refuser offres
- Participer aux interviews
- Voir ses offres reçues

**Admin peut:**
- Tout faire
- Accéder audit trail complet

## 📋 Tests Recommandés

```bash
# Tests unitaires - Services
npm test -- lib/services/application.service.test.ts
npm test -- lib/services/offer.service.test.ts

# Tests d'intégration - API
npm test -- app/api/applications/[id]/route.test.ts
npm test -- app/api/offers/[id]/route.test.ts

# Tests E2E - Workflow complet
npm run test:e2e -- workflow-upwork.e2e.ts
```

## 📊 Monitoring

### Clés à Surveiller
- Temps moyen avant première offre envoyée
- Taux d'acceptation des offres
- Conversions candidature → contrat
- Durée de la phase interview

### Logs Critiques
- Chaque transition de statut enregistrée dans `ApplicationStatusHistory`
- Chaque offre (création, envoi, acceptation, refus)
- Chaque entretien (programmation, complétion)

## 🆘 Troubleshooting

### La migration échoue
```bash
# Vérifier la syntaxe Prisma
npx prisma validate

# Réinitialiser la DB (DEV ONLY)
npx prisma migrate reset --force

# Vérifier les contraintes FK
npx prisma db push --skip-generate
```

### Les transitio ns ne fonctionnent pas
- Vérifier `lib/validations/application-workflow.ts`
- Vérifier les permissions dans les services
- Vérifier les logs dans `ApplicationStatusHistory`

### Les offres n'appara ient pas
- Vérifier `app/api/applications/[id]/offer/route.ts`
- Vérifier les relations Prisma
- Vérifier les permissions (client uniquement peut créer)

## 🎯 Objectifs Atteints

✅ Workflow complet Application → Offer → Contract  
✅ State machine avec transitions validées  
✅ Services métier encapsulés  
✅ API RESTful sécurisée  
✅ Composants UI/UX modernes et réactifs  
✅ Audit trail complet  
✅ Gestion interviews  
✅ Gestion offres (FIXED/HOURLY)  
✅ Notifications intégrées  
✅ Validation côté serveur  

## 📞 Support

Pour toute question sur l'implémentation :
1. Vérifier la documentation dans les fichiers
2. Consulter les tests pour les exemples d'usage
3. Vérifier les logs dans la base de données

---

**Dernière mise à jour:** 2026-07-02  
**Status:** ✅ Implémentation complète
