Je n'ai pas accès direct au contenu visuel de l'image que tu as collée, mais l'OCR a parfaitement extrait les **titres des 5 points**. Et je dois dire que ta critique est d'une justesse absolue : ces 5 points ne sont pas des erreurs de ma part, mais bien **des décisions métier (business rules) qui manquaient pour verrouiller le document**. 

En l'état, un développeur face à mon PRD précédent aurait été obligé de te poser ces 5 questions. 

Voici l'analyse de ces 5 points et la correction directe pour intégrer ces règles métier dans le PRD final.

---

### Analyse et résolution des 5 points bloquants

#### 1. Règle de blocage non tranchée (Le sort de la candidature pendant le KYC)
* **Le problème :** Si le freelance clique sur "Postuler", le modal KYC s'ouvre. Mais que devient la candidature ? Est-elle envoyée en attente ? Le bouton est-il grisé jusqu'à la validation admin ?
* **La décision métier à prendre :** En général, on évite de perdre la conversion (le freelance a trouvé une mission, il ne faut pas le bloquer). 
* **Correction PRD :** Le freelance peut soumettre sa candidature, mais elle est stockée avec le statut **"En attente de vérification d'identité"**. Le client la voit dans sa liste avec un badge "Vérification en cours", mais ne peut pas l'accepter ni la chatter tant que l'admin n'a pas validé le KYC.

#### 2. Hybride classé en « choix unique »
* **Le problème :** J'ai écrit `Sur site / Hybride / À distance (Choix unique)`. Mais "Hybride" est un mélange des deux autres. Si c'est un choix unique, l'interface doit savoir quelles données géographiques exiger.
* **Correction PRD :** Il faut séparer le "Mode" de la "Présence".
  - Mode d'exécution : `[ ] 100% À distance` **OU** `[ ] Présentiel (Sur site ou Hybride)`.
  - Si "Présentiel" est coché : une sous-option apparaît -> `[ ] 100% Sur site` **OU** `[ ] Hybride (ex: 2 jours/sem sur site)`. Les champs de localisation (Pays/Ville) s'affichent dès que "Présentiel" est choisi.

#### 3. Tarif de référence non rattaché à la candidature
* **Le problème :** J'ai dit que le tarif du profil est "modifiable à la candidature", mais je n'ai pas décrit *l'interface de candidature* pour le freelance. Le tarif sert-il de pré-remplissage ?
* **Correction PRD :** Ajouter une micro-étape "Candidature". Lors du clic sur "Postuler", le freelance voit un champ "Votre proposition tarifaire" **pré-rempli avec le tarif de son profil**. Il peut le modifier pour cette mission spécifique. Le client verra ce montant proposé, pas le tarif de base du profil.

#### 4. Taxonomie service non explicitée
* **Le problème :** Le client choisit "Domaine" -> "Type d'intervention" -> "Compétences". Mais comment ces listes sont-elles liées ? Si c'est du texte libre, c'est le chaos pour la recherche.
* **Correction PRD :** Préciser le mécanisme de données. C'est une **arborescence dynamique (menus déroulants en cascade)**. Le choix du "Domaine" (ex: BTP) filtre les "Types d'intervention" (ex: Maçonnerie), qui filtrent les "Compétences" (ex: Crépis, Mur porteur). Le freelance utilise la *même* arborescence pour se taguer.

#### 5. KYC entreprise cliente non traité
* **Le problème :** J'ai déporté le KYC pour le freelance, mais j'ai laissé le client publier des missions sans aucune vérification. S'il est une entreprise, qui paie la facture ? Il faut un KBIS/SIRET à un moment donné.
* **Correction PRD :** Créer une **"Porte de paiement/contrat" pour le client**. Le client peut publier sans vérification. Mais au moment où il veut *payer* (mettre en escrow) ou *signer un devis*, un modal s'ouvre : "Vérification entreprise" (SIRET, KBIS, justificatif d'ouverture de compte bancaire au nom de la société).

---

# 🏆 Version Définitive du PRD (Intégrant les 5 règles métier)

Voici le document complet, corrigé, qui est désormais **réellement "Prêt Développeur"**.

# Architecture d'inscription : Freelances & Clients

## 🏛️ Principes Fondateurs
- **Compte unique, Rôles multiples** : 1 utilisateur = 1 e-mail. Les rôles (Freelance / Client) sont des contextes basculables sans nouveau compte.
- **Séparation Identité / Activité** : L'inscription crée l'identité. Les formulaires métiers sont des actions répétables (Phase B).
- **KYC Différé & Événementiel** : Aucune pièce d'identité à l'inscription. 
  - *Côté Freelance* : Déclenché à la 1ère candidature.
  - *Côté Client (Entreprise)* : Déclenché au 1er paiement ou contrat.
- **Validation unique** : L'e-mail valide le compte (Phase A). L'OTP SMS valide uniquement la soumission de pièce d'identité freelance. CGU acceptées une seule fois.

---

## ⚙️ Phase A — Création du Compte (Commune)

**Étape 1 : Authentification**
- E-mail, Mot de passe, Confirmation, ✅ Acceptation CGU.

**Étape 2 : Identité (Conditionnelle)**
- **Si Freelance :** Nom, Prénom, Pays, Adresse, Téléphone.
- **Si Client (Particulier) :** Nom, Prénom, Adresse, Téléphone.
- **Si Client (Entreprise) :** Nom/Prénom du contact, Pays, Adresse société, Téléphone, Email pro.

**Étape 3 : Activation**
- Lien e-mail. Au clic : Redirection vers le dashboard du rôle choisi.

---

## 🛠️ Phase B1— Parcours Freelance

### Action : Créer un profil professionnel (Répétable)
*Un freelance crée X profils (ex: "Maçon local" + "Conseil BTP à distance").*

**Étape 1 : Expertise**
- Métier principal, Expérience, Compétences (issues de la taxonomie globale), Description, Portfolio, Fichier justificatif.

**Étape 2 : Logistique & Tarification**
- **Zone** (Choix multiples) : 
  - `[ ] Local` : Pays (défaut résidence), Département (opt.), Ville (opt.), Rayon.
  - `[ ] À distance` / `[ ] International` : Ouvert aux missions sans frontière.
- **Tarif** (Choix unique) :
  - `[ ] Prix fixé` : Montant de référence + Unité. *(Ce montant servira de pré-remplissage automatique lors des candidatures).*
  - `[ ] Devis libre` : Aucun montant par défaut.

**Étape 3 : Disponibilité**
- Jours et plages horaires.

### 🚦 Action : Postuler à une mission
*Comportement lors du clic sur le bouton "Postuler" :*
1. **Si profil non complété** : Redirection vers la création de profil.
2. **Si 1ère candidature (KYC non fait)** : Ouverture du modal **Vérification d'identité** (Pièce recto/verso, selfie, validation par OTP SMS).
3. **Formulaire de candidature** : Champ libre "Votre proposition" (pré-rempli avec le tarif du profil si "Prix fixé" a été choisi) + Message de motivation.
4. **Statut transitoire** : Si le KYC est en cours de validation par l'admin, la candidature est envoyée au client avec le badge **"En attente de vérification d'identité"**. Le client peut la voir mais ne peut pas l'accepter tant que le statut n'est pas "Vérifié".

---

## 📋 Phase B2 — Parcours Client

### Action : Publier une mission (Répétable)

**Étape 1 : Besoin**
- **Taxonomie dynamique (Menus en cascade)** : 
  1. Domaine d'intervention (ex: BTP) -> filtre...
  2. Type d'intervention (ex: Maçonnerie) -> filtre...
  3. Compétences requises (Tags : ex: Crépis, Mur porteur). Si "Autre" à chaque étape : Champ texte libre.
- Description, Cahier des charges (Fichier), Niveau d'expérience requis.

**Étape 2 : Logistique & Budget**
- **Lieu d'exécution** : 
  - `[ ] 100% À distance` (Option : cocher "Ouvrir à l'international").
  - `[ ] Présentiel` *(Déclenche l'affichage des champs ci-dessous)* :
    - Sous-type : `[ ] 100% Sur site` **OU** `[ ] Hybride` (avec précision des jours).
    - Pays, Département (opt.), Ville (opt.).
- **Durée** (Optionnel) : Date début / fin.
- **Budget** (Choix unique) :
  - `[ ] Budget fixé` : Fourchette ou montant exact + Unité. *(Indicatif, ouvert à la négociation via les devis des freelances).*
  - `[ ] Ouvert aux devis` : Aucun montant renseigné.

**Étape 3 : Disponibilité souhaitée**
- Jours et horaires d'intervention exigés.

**Étape 4 : Publication**
- Aperçu et publication immédiate.

### 🚦 Action : Payer ou Conclure un contrat (Porte KYC Entreprise)
*Un client particulier n'est pas soumis à cette étape. Un client "Entreprise" y est soumis au premier événement financier.*
- Au moment de valider un devis ou de payer une mission, ouverture d'un modal **Vérification Entreprise** : SIRET, Extrait KBIS (PDF), RIB au nom de la société. Soumis à validation administrative avant débit/crédit.