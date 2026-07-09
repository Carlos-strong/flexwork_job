# 🟢 Utilisation avec Laragon

Laragon fournit PostgreSQL en local. On garde Redis/Mailpit via Docker (ou on installe Redis directement).

---

## 📦 1. Prérequis Laragon

- **Laragon** installé → [télécharger](https://laragon.org/download/)
- **PostgreSQL** activé dans Laragon :
  - Menu Laragon → `Outils` → `Gestionnaire de modules`
  - Activer `PostgreSQL`

### Vérifier que PostgreSQL tourne :
```bash
# Dans le terminal Laragon
psql -U postgres -c "SELECT 1"
```

---

## 🗄️ 2. Créer la base de données

Depuis le **terminal Laragon** (`Terminal` dans l'interface, ou clic droit → `Terminal`) :

```bash
cd C:\Users\benca\Documents\Projets\Flexwork_job

# Créer la base
createdb -U postgres flexwork

# Appliquer le schéma Prisma
npx prisma db push

# Insérer les données de démo
npm run seed
```

---

## ⚡ 3. Configuration `.env.local`

```env
# Laragon PostgreSQL (sans mot de passe)
DATABASE_URL="postgresql://postgres:@localhost:5432/flexwork?schema=public"

# Redis (via Docker ou installé localement)
REDIS_URL="redis://localhost:6379"
```

> ⚠️ Si ton PostgreSQL Laragon a un mot de passe, utilise :
> `DATABASE_URL="postgresql://postgres:TONMDP@localhost:5432/flexwork?schema=public"`

---

## 🚀 4. Démarrer le projet

Dans le terminal Laragon :

```bash
cd C:\Users\benca\Documents\Projets\Flexwork_job

# 1. Lancer les services externes (Redis + Mailpit via Docker)
docker compose up -d

# 2. (Optionnel) Serveur TURN/STUN pour WebRTC
#    - Si Docker est disponible : docker compose --profile turn up -d coturn
#    - Sinon : pas de TURN — le fallback STUN Google suffit en local
npm run turn

# 3. Lancer le serveur Next.js
npm run dev

# 4. (Optionnel) WebSocket pour messagerie temps réel
npm run ws

# 5. (Optionnel) Workers BullMQ
npm run workers
```

Ouvre http://localhost:3000

Ou lance tout d'un coup :
```bash
npm run dev:all
```

---

## 🎯 5. Raccourci Laragon

Crée un **projet Laragon** pour accéder rapidement :

1. Copie ce dossier dans `C:\laragon\www\flexwork`
2. Ou crée un lien symbolique :
   ```bash
   mklink /D C:\laragon\www\flexwork C:\Users\benca\Documents\Projets\Flexwork_job
   ```
3. Dans Laragon : clic droit → `www` → `flexwork` → `Terminal`

---

## 🧪 6. Vérifications

| Service | Commande | URL |
|---------|----------|-----|
| PostgreSQL | `psql -U postgres -d flexwork` | `localhost:5432` |
| Redis | `redis-cli ping` | `localhost:6379` |
| Mailpit | Docker | http://localhost:8025 |
| Next.js | `npm run dev` | http://localhost:3000 |

---

## 🔄 Alternative sans Docker

Si tu ne veux pas Docker du tout :

1. **Redis** : installe-le via le module Laragon ou [télécharge](https://github.com/microsoftarchive/redis/releases)
2. **Mailpit** : pas essentiel en dev (les emails sont loggés dans la console)
