# API Offres — Documentation

## Routes disponibles

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/offers` | Liste toutes les offres (option: ?applicationId=X) |
| `POST` | `/api/offers` | Crée + envoie une offre (DRAFT → SENT) |
| `PATCH` | `/api/offers/[id]?action=send` | Envoie une offre brouillon |
| `PATCH` | `/api/offers/[id]?action=accept` | Accepte une offre → contrat créé |
| `PATCH` | `/api/offers/[id]?action=decline` | Refuse une offre |
| `PATCH` | `/api/offers/[id]?action=withdraw` | Retire une offre (client) |
| `GET` | `/api/offers/client` | Offres côté client (avec mission + freelance) |
| `GET` | `/api/offers/freelancer` | Offres côté freelance (avec mission + client) |
| `GET` | `/api/offers/stats` | Statistiques des offres (client/freelancer) |
| `POST` | `/api/offers/expire` | Expire les offres dépassées (admin/cron) |
| `POST` | `/api/applications/[id]/offer` | Crée une offre brouillon depuis candidature |

## Pages utilisateur

| Page | Rôle | Description |
|------|------|-------------|
| `/dashboard/client/offres` | Client | Liste + détail des offres envoyées, retrait possible |
| `/dashboard/freelancer/offres` | Freelance | Liste + détail des offres reçues, accepter/refuser |
| `/dashboard/client/candidatures` | Client | Pipeline de recrutement avec envoi d'offre intégré |

## Workflow

```
Candidature (SHORTLISTED/DISCUSSION/INTERVIEW)
    ↓ Client crée l'offre (offer.service.createOffer)
    ↓ Client envoie l'offre (offer.service.sendOffer)
    ↓ Statut candidature → OFFER_SENT
    ↓ Freelance accepte (offer.service.acceptOffer)
    ↓ Contrat créé + Escrow + Workspace
    ↓ Statut candidature → OFFER_ACCEPTED → ACCEPTED
```
