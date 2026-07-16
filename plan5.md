Avec **Next.js**, tu peux construire une application de type **Upwork** de manière très propre. L'objectif n'est pas de "garder les pages en mémoire", mais de **gérer l'état de l'application** indépendamment des pages.

Je te recommande une architecture comme celle-ci :

```text
src/
│
├── app/
│   ├── (auth)/
│   ├── jobs/
│   ├── proposals/
│   ├── messages/
│   ├── profile/
│   └── settings/
│
├── components/
│
├── features/
│   ├── auth/
│   ├── jobs/
│   ├── messages/
│   ├── notifications/
│   └── profile/
│
├── services/
│   ├── api.ts
│   ├── auth.ts
│   └── websocket.ts
│
├── store/
│   ├── auth.ts
│   ├── jobs.ts
│   ├── messages.ts
│   └── ui.ts
│
├── hooks/
│
└── lib/
```

## 1. Utilise un gestionnaire d'état global

Pour une application comme Upwork, **Zustand** est un excellent choix.

Par exemple :

```ts
// store/auth.ts

import { create } from "zustand";

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

Le store reste disponible même lorsque tu changes de page.

---

## 2. Utilise TanStack Query pour les données serveur

Toutes les données venant de ton API (missions, profils, messages...) doivent être gérées avec **TanStack Query**.

Exemple :

```ts
const { data: jobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: getJobs
});
```

Cela apporte :

* cache automatique ;
* revalidation ;
* pagination ;
* synchronisation des données ;
* moins d'appels API.

---

## 3. Conserve les filtres dans l'URL

Au lieu de stocker les filtres uniquement dans un state React :

```
/jobs?page=2&category=design&budget=500
```

Avantages :

* partage du lien ;
* actualisation de la page sans perdre le contexte ;
* navigation précédente/suivante cohérente.

---

## 4. Sauvegarde les brouillons

Exemple :

```
Proposal

↓

Toutes les 5 secondes

↓

localStorage

↓

Réouverture

↓

Restaurer
```

Tu peux utiliser :

```ts
localStorage.setItem("proposal", JSON.stringify(data));
```

Puis :

```ts
const draft = localStorage.getItem("proposal");
```

---

## 5. Garde les messages en cache

Le chat est l'une des parties les plus importantes.

Architecture :

```
WebSocket

↓

TanStack Query

↓

Zustand

↓

Interface
```

Les anciens messages restent affichés pendant que les nouveaux arrivent via WebSocket.

---

## 6. Persistance de la connexion

Le token peut être stocké :

* dans un **cookie HTTP Only** (recommandé pour la sécurité) ;
* ou dans un cookie classique si ton architecture l'impose.

Évite de stocker un JWT sensible dans `localStorage`, car il est accessible aux scripts exécutés dans la page en cas de faille XSS.

---

## 7. Conserver la position du scroll

Next.js restaure parfois automatiquement le scroll, mais pour les longues listes (comme des centaines de missions), tu peux enregistrer la position :

```ts
sessionStorage.setItem("jobs-scroll", window.scrollY.toString());
```

Puis la restaurer au retour sur la page.

---

## 8. Les données à conserver

| Donnée                      | Où la stocker              |
| --------------------------- | -------------------------- |
| Utilisateur connecté        | Zustand + cookie HTTP Only |
| Missions                    | TanStack Query             |
| Profil                      | TanStack Query             |
| Chat                        | TanStack Query + WebSocket |
| Notifications               | Zustand + TanStack Query   |
| Brouillons                  | localStorage               |
| Préférences (thème, langue) | localStorage ou cookie     |
| Filtres de recherche        | URL (`searchParams`)       |
| Position du scroll          | sessionStorage             |

