# 🎬 QUICK START - Commandes pour Démarrer Immédiatement

**Date:** 2026-07-02  
**Prérequis:** Node.js, PostgreSQL (Laragon), npm

---

## 🚀 Étape 1: Vérifier l'installation

```bash
cd c:\Users\benca\Documents\Projets\Flexwork_job

# Vérifier Prisma
npx prisma --version
# Attendu: prisma/5.x.x

# Vérifier la connexion DB
npx prisma db execute --stdin <<< "SELECT 1"
# Attendu: Succès
```

---

## 🔧 Étape 2: Démarrer le serveur

```bash
# Terminal 1: Développement
npm run dev

# La console affichera:
# ✓ Compiled client and server successfully
# ➜ Local: http://localhost:3000
```

---

## 🌐 Étape 3: Accéder à l'app

Ouvrez: http://localhost:3000

Les pages seront accessible au démarrage du serveur.

---

## 🧪 Étape 4: Tester les endpoints (Optionnel)

### Via Postman/Insomnia:

```
POST http://localhost:3000/api/applications/test-app/offer
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_SESSION_TOKEN

Body (JSON):
{
  "title": "Test Offer",
  "offerType": "FIXED",
  "totalBudget": 5000,
  "startDate": "2026-07-03"
}
```

---

## 📝 Étape 5: Intégrer dans vos pages

### Exemple: Ajouter la liste des candidatures

```tsx
// app/(dashboard)/[clientId]/missions/[missionId]/applications/page.tsx

import { Suspense } from 'react'
import ApplicationList from '@/components/applications/ApplicationList'
import { prisma } from '@/lib/prisma'

export default async function ApplicationsPage({ 
  params 
}: { 
  params: { missionId: string } 
}) {
  const applications = await prisma.application.findMany({
    where: { missionId: params.missionId },
    include: {
      interview: true,
      offers: true,
      statusHistory: true
    }
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Candidatures</h1>
      <Suspense fallback={<div>Chargement...</div>}>
        <ApplicationList 
          applications={applications}
          canManage={true}
          onStatusChange={async (appId, status) => {
            'use server'
            // Mettre à jour le statut
          }}
        />
      </Suspense>
    </div>
  )
}
```

---

## 📊 Étape 6: Voir les migrations appliquées

```bash
# Vérifier les migrations Prisma
npx prisma migrate status

# Affichera toutes les migrations appliquées incluant:
# ✓ add_workflow_upwork_models (DB PUSH)
```

---

## 🐛 Dépannage Rapide

### Erreur: "Can't reach database"
```bash
# Assurez-vous que Laragon est en cours d'exécution
# Et PostgreSQL est actif (vert dans Laragon)
# Vérifier le port: netstat -ano | findstr 5432
```

### Erreur: "Prisma Client not found"
```bash
# Régénérer:
npx prisma generate
```

### Erreur: "Types are not recognized"
```bash
# Recompiler:
npm run build
```

---

## 📚 Fichiers de Référence

| Fichier | Description |
|---------|-------------|
| `PLAN_IMPLEMENTATION.md` | Architecture & planning |
| `IMPLEMENTATION_GUIDE.md` | Guide d'intégration détaillé |
| `MIGRATION_DEPLOYMENT.md` | Étapes de déploiement |
| `TODOS_COMPLETED.md` | Résumé tous les TODOs |

---

## 🔗 Structure des Composants

```
components/applications/
├── ApplicationCard.tsx       # Carte candidature
├── ApplicationList.tsx       # Liste avec filtrage
├── InterviewManager.tsx      # Gestion interviews
├── OfferForm.tsx            # Formulaire offres
├── OfferDisplay.tsx         # Affichage offres
└── ApplicationTimeline.tsx  # Historique
```

---

## 📋 Checklist Avant Production

- [ ] Tests E2E passants: `npm run test:e2e`
- [ ] Build OK: `npm run build`
- [ ] Aucune erreur TypeScript: `npm run type-check`
- [ ] Audit de sécurité: `npm audit`
- [ ] Permissions vérifiées (client/freelancer/admin)
- [ ] Rate limiting configuré
- [ ] Logs centralisés configurés
- [ ] Notifications envoyées (email/SMS)
- [ ] Monitoring alertes en place

---

## 💡 Tips Avancés

### Activer le monitoring SQL
```bash
# Dans .env.local
DEBUG="prisma:client"

# Cela affichera toutes les requêtes SQL
```

### Réinitialiser la DB (DEV ONLY)
```bash
npx prisma migrate reset
npm run seed  # Si vous avez des seeds
```

### Vérifier le schéma
```bash
npx prisma studio  # Interface graphique Prisma
# Accès: http://localhost:5555
```

---

## 🎯 Workflow Typique de Développement

```bash
# 1. Démarrer le serveur
npm run dev

# 2. Faire des changements
# (Composants, services, etc.)

# 3. Si modification du schéma Prisma
npx prisma migrate dev --name votre_nom_migration

# 4. Tester
npm test

# 5. Build final
npm run build
```

---

## 📞 Support Technique

**Pour les questions:**
- Consulter les fichiers de documentation
- Vérifier IMPLEMENTATION_GUIDE.md
- Lire les commentaires JSDoc du code
- Vérifier les types TypeScript

**Erreurs communes:**
- Voir MIGRATION_DEPLOYMENT.md → Support Déploiement

---

**Prêt? Lancez:** `npm run dev` 🚀

**Bon développement!** 👩‍💻
