Voici une analyse détaillée de ton modèle, suivie d'une proposition d'optimisation. 

Ton document de base est **très solide** : il s'appuie sur les bonnes pratiques des marketplaces modernes (séparation compte/profil, repoussement de la friction KYC, multi-profils). Cependant, il contient quelques redondances, une contradiction logique mineure, et peut être retravaillé pour devenir un véritable **document de spécification fonctionnelle (PRD)** prêt à être donné à des développeurs ou des UX/UI designers.

---

## 🧠 Analyse du document original

### Ce qui est excellent :
1. **Le déport du KYC (Know Your Customer)** : Demander la pièce d'identité et l'OTP seulement au moment de l'action critique (candidature/paiement) est la meilleure stratégie pour éviter l'abandon.
2. **La séparation Compte vs Rôle** : Un compte = une adresse e-mail, avec des rôles basculables. C'est le modèle idéal (type Upwork/Fiverr).
3. **La multi-spécialisation du freelance** : Autoriser plusieurs "Professionnels" avec des tarifs et zones différentes est un avantage concurrentiel majeur pour les workers polyvalents.
4. **Le transfert des champs métiers/tarifs du client vers la mission** : Un client n'a pas de "profil professionnel" fixe, il a des besoins ponctuels. Cette correction est parfaite.

### Ce qui doit être corrigé/amélioré :
1. **Contradiction sur la candidature freelance (Phase B, Étape 4)** : Tu écris *"Le freelance peut immédiatement soumettre des candidatures..."* puis juste après *"seule la vérification d'identité complète est requise avant la première candidature effective"*. C'est contradictoire. En réalité : le bouton "Postuler" déclenche le modal de vérification d'identité.
2. **Redondance de la Phase A** : Les étapes 1, 2 et 3 de la Phase A sont quasiment identiques pour le freelance et le client. Dans un spec, il faut factoriser cela sous forme de "Base commune".
3. **Manque de clarté sur le stockage des données client** : Si le client est une entreprise, il faut savoir si le nom/prénom représente le créateur du compte ou un contact générique.
4. **Format trop littéraire** : Les blocs "Optimisation" et "Correction" alourdissent la lecture. Il vaut mieux intégrer ces règles directement dans le flux sous forme de notes techniques (UX/UI notes).

---

## 🚀 Proposition optimisée (Format Spécification Fonctionnelle)

*Voici le document retravaillé pour être plus percutant, structuré et directement exploitable par une équipe technique.*

# Architecture d'inscription : Freelances & Clients

## 🏛️ Principes Fondateurs (Architecture)
- **Compte unique, Rôles multiples** : Un utilisateur = 1 e-mail + 1 mot de passe. Les rôles (Freelance / Client) sont des contextes basculables depuis le sidebar, sans création de nouveau compte.
- **Séparation Identité / Activité** : L'inscription crée l'identité. Le profil professionnel ou la publication de mission sont des actions distinctes et répétables (Phase B).
- **Zéro friction initiale (KYC différé)** : Aucune pièce d'identité ni OTP à l'inscription. La vérification d'identité n'est déclenchée qu'au moment d'une action à risque (1ère candidature freelance ou 1er paiement).
- **Validation unique** : L'e-mail valide le compte (Phase A). L'OTP SMS valide uniquement la soumission de la pièce d'identité (Phase B Freelance). Les CGU sont acceptées une seule fois, à l'inscription.

---

## ⚙️ Phase A — Création du Compte (Commune aux deux rôles)
*Parcours linéaire effectué une seule fois. À la fin, l'utilisateur bascule automatiquement vers le dashboard de son rôle choisi.*

**Étape 1 : Authentification**
- E-mail
- Mot de passe
- Confirmation du mot de passe
- ✅ *Check* : Acceptation des CGU

**Étape 2 : Identité (Conditionnelle selon le rôle choisi)**
- **Si Freelance :** Nom, Prénom, Pays de résidence, Adresse, Téléphone.
- **Si Client (Particulier) :** Nom, Prénom, Adresse, Téléphone.
- **Si Client (Entreprise) :** Nom/Prénom du contact, Pays d'implantation, Adresse de l'entreprise, Téléphone, E-mail professionnel.

**Étape 3 : Activation**
- Envoi d'un lien de validation par e-mail.
- Au clic : le compte est actif. L'utilisateur est redirigé vers son dashboard.

> *[FIN DE LA PHASE A - Aucune autre donnée n'est demandée à ce stade]*

---

## 🛠️ Phase B — Parcours Freelance (Post-inscription)
*Accès depuis le Dashboard. Objectif : créer une ou plusieurs "offres de services" (profils métiers).*

### Action : Créer un profil professionnel (Répétable)
*Un freelance peut créer X profils (ex: Profil "Maçon local" + Profil "Conseil BTP à distance").*

**Étape 1 : Expertise**
- Métier principal (Liste de la plateforme)
- Expérience
- Compétences (Tags)
- Description libre
- Portfolio (Fichiers/URLs)
- Fichier justificatif (Certificat / Diplôme / Certification Flexwork)

**Étape 2 : Logistique & Tarification**
*Paramétrable différemment pour chaque profil créé.*
- **Zone d'intervention** (Choix multiples possibles) :
  - `[ ] Local` : Pays (défaut = résidence), Département (opt.), Ville (opt.), Rayon (km).
  - `[ ] À distance` : Visible sur les missions distantes.
  - `[ ] International` : Visible sur les missions ouvertes sans frontière.
- **Tarification** (Choix unique) :
  - `[ ] Prix fixé` : Montant + Unité (Prestation / Heure / Jour / Semaine / Mois). *Note : Ce tarif est une base de référence, modifiable au moment de la candidature.*
  - `[ ] Devis libre` : Aucun montant par défaut, proposition systématique à chaque candidature.

**Étape 3 : Disponibilité**
- Jours de la semaine + Plages horaires (Modèle existant).

**🚦 Porte de candidature (Déclenchée au 1er "Postuler")**
Lorsque le freelance clique sur "Postuler" pour la première fois :
1. Ouverture d'un modal/méga-menu de **Vérification d'identité (KYC)**.
2. Saisie : Numéro de pièce, Photo recto, Photo verso, Selfie.
3. Sécurité : Validation par **OTP SMS** (Unique occurrence de l'OTP dans tout le parcours).
4. Soumission pour validation administrative.
5. *Comportement* : La candidature est mise en attente de validation KYC ou le freelance est bloqué jusqu'à la validation (selon la règle métier choisie).

---

## 📋 Phase B — Parcours Client (Post-inscription)
*Accès depuis le Dashboard. Objectif : publier un besoin ponctuel (Mission).*

### Action : Publier une mission (Répétable)
*Le client n'a pas de "profil professionnel" permanent. Il décrit son besoin ici.*

**Étape 1 : Besoin**
- Domaine d'intervention (Métier/Catégorie). Si "Autre" : Champ texte libre.
- Type d'intervention (Sous-catégorie). Si "Autre" : Champ texte libre.
- Description de la mission
- Compétences requises (Tags liés au domaine)
- Cahier des charges (Fichier PDF/JPEG/PNG - Optionnel)
- Niveau d'expérience requis (Junior, Confirmé, Senior...)

**Étape 2 : Logistique & Budget**
- **Lieu d'exécution** (Choix unique) :
  - `[ ] Sur site` : Pays, Département (opt.), Ville (opt.).
  - `[ ] Hybride` : Idem Sur site + précision des jours de télétravail.
  - `[ ] À distance` : Case à cocher "Ouvrir à l'international" (Supprime la contrainte pays).
- **Durée prévisionnelle** (Optionnel) : Date de début / Date de fin.
- **Budget** (Choix unique) :
  - `[ ] Budget fixé` : Montant ou Fourchette + Unité (Prestation / Heure / Jour...). *Note : Indicatif, ouvert à la négociation lors du choix du freelance.*
  - `[ ] Ouvert aux devis` : Le client ne renseigne aucun montant et reçoit les propositions financières des freelances.

**Étape 3 : Disponibilité souhaitée**
- Jours et horaires d'intervention exigés (Modèle existant).

**Étape 4 : Publication**
- Aperçu de l'annonce.
- Bouton : "Publier la mission".
> *Note Technique : Aucune étape de validation (OTP, KYC, CGU) n'est requise ici. Le compte est déjà certifié par l'e-mail (Phase A).*

---

### Résumé des changements opérés dans cette optimisation :
1. **Factorisation** : La Phase A n'est écrite qu'une seule fois, ce qui divise la taille du document par deux et évite les erreurs de copier-coller.
2. **Résolution du paradoxe** : L'étape de la candidature freelance est devenue une "Porte de candidature" avec un déclencheur clair (le clic sur le bouton Postuler).
3. **Vocabulaire technique** : Ajout de termes comme "KYC", "Conditionnelle", "Tags", "Modal" pour habituer les lecteurs au jargon de la conception de plateformes.
4. **Clarification des choix multiples/uniques** : Pour la zone du freelance, j'ai précisé "Choix multiples possibles", et pour le mode d'exécution du client "Choix unique", car un client ne peut pas publier une mission qui est à la fois "100% à distance" ET "Sur site" par défaut (c'est soit l'un, soit l'autre, soit hybride).
5. **Suppression des blocs de métadiscours** : Les "Optimisation" et "Correction" ont été intégrés comme des règles naturelles ("Note technique", "Note") pour que le texte soit normatif et non narratif.