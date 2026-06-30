# Plateforme freelance — Modèle d'inscription, tarification et zone géographique

> Marketplace freelance hybride (proche d'Upwork/Malt) avec compte unique multi-rôles, publication de missions, candidatures négociables, et intervention locale **ou** à distance/international.

---

## 1. Principe général : compte unique, rôles multiples

Un utilisateur ne crée **qu'un seul compte**. Il choisit ensuite un ou plusieurs rôles (`client`, `freelance`) qu'il peut activer à tout moment depuis le sidebar, sans jamais ressaisir son identité.

```
UTILISATEUR ──┬── ROLE: client     (identité seule, aucun métier requis)
              └── ROLE: freelance  (identité + profil professionnel)
```

**Règle clé** : l'identité (nom, téléphone, email, mot de passe, pièce d'identité) est enregistrée **une seule fois**, peu importe le nombre de rôles ou de métiers exercés.

---

## 2. Flux d'inscription

### Étapes communes (tous les utilisateurs)
1. **Compte** — email, mot de passe, confirmation
2. **Identité** — nom, prénom, téléphone, adresse, pays de résidence
3. **Validation** — OTP SMS + acceptation CGU

→ À ce stade, l'utilisateur a un compte actif et peut déjà publier une mission en tant que client.

### Branche freelance (optionnelle, activable à tout moment)
4. **Vérification d'identité** — pièce + photos recto/verso + selfie (faite une seule fois par personne, pas par métier)
5. **Profil professionnel par métier** — répétable pour chaque métier additionnel :
   - Métier principal, expérience, compétences, certificats (PDF/image), description, portfolio
   - Zone d'intervention (locale et/ou distance/international — voir section 4)
   - Mode de tarification (voir section 3)
   - Disponibilité (jours + horaires)

**Point corrigé par rapport au brief initial** : la vérification d'identité ne bloque pas la création du compte — elle intervient seulement avant la première candidature ou le premier paiement, pour réduire la friction d'inscription.

### Branche client (pas de profil professionnel)
Le client ne renseigne **ni métier, ni tarif, ni disponibilité** à l'inscription — ces champs appartiennent au formulaire de **publication de mission**, répétable autant de fois que voulu après la création du compte. C'est la correction principale par rapport à Urban Company/TaskRabbit où le client décrirait un besoin permanent : ici chaque mission est indépendante.

---

## 3. Modèle de tarification : prix fixé OU devis libre

Le mode de tarification est une propriété de la **mission**, pas de l'utilisateur.

| Mode | Qui fixe le prix | Négociable à la candidature |
|---|---|---|
| `prix_fixe` | Le client définit un montant ou une fourchette | Oui — le freelance peut contre-proposer |
| `devis_libre` | Aucun prix imposé | Oui — chaque freelance soumet son propre tarif |

Dans les deux cas, la table `CANDIDATURE` porte systématiquement un `montant_propose` — ça unifie le traitement applicatif et garde la négociation toujours possible, conformément à votre besoin.

```sql
MISSION.mode_tarification   ENUM('prix_fixe', 'devis_libre')
MISSION.unite_tarif         ENUM('prestation','heure','jour','semaine','mois')
MISSION.budget_min / budget_max   DECIMAL  -- indicatif, non contraignant en base

CANDIDATURE.montant_propose         DECIMAL
CANDIDATURE.unite_tarif_proposee    ENUM(...)
```

---

## 4. Zone géographique : local, distance, international

Chaque **métier exercé** par un freelance (pas l'utilisateur globalement) déclare les modes qu'il accepte, car un même freelance peut faire du local pour un métier (ex: maçonnerie) et du distanciel pour un autre (ex: design).

```sql
PRESTATAIRE_METIER.accepte_local           BOOLEAN
PRESTATAIRE_METIER.accepte_distance        BOOLEAN
PRESTATAIRE_METIER.accepte_international   BOOLEAN

ZONE_INTERVENTION   -- utilisée seulement si accepte_local = TRUE
  pays, ville, rayon_km

MISSION.mode_execution   ENUM('sur_site','distance','hybride')
MISSION.pays_mission / ville_mission   -- NULL si distance pure
```

**Matching simplifié** :
- Mission `sur_site` → ne matcher que les freelances `accepte_local = TRUE` dans la zone
- Mission `distance` sans pays précisé → matcher les freelances `accepte_international = TRUE`
- Mission `hybride` → prévoir un champ `frequence_presence_sur_site` (ex: "1 jour/semaine")

---

## 5. Modèle de données — vue d'ensemble

```
UTILISATEUR ──< UTILISATEUR_ROLE >── ROLE
     │
     ├──< VERIFICATION_IDENTITE        (une fois par personne)
     ├──< ADRESSE
     │
     ├──< PRESTATAIRE_METIER >── METIER
     │         ├──< PRESTATAIRE_SERVICE >── SERVICE
     │         ├──< ZONE_INTERVENTION
     │         └──< DISPONIBILITE
     │
     └──< MISSION (en tant que client) >── SERVICE
               └──< CANDIDATURE >── PRESTATAIRE_METIER
```

---

## 6. Stockage des fichiers (photos, pièces, portfolios)

**Principe** : la base de données ne stocke jamais le binaire, seulement la référence.

```
App client → demande URL signée → API backend → Object storage (S3/Cloudinary)
                                                          ↓
                                   App upload directement le fichier
                                                          ↓
                                   Confirmation → table FICHIER (clé seulement)
```

```sql
FICHIER
  type_entite     ENUM('utilisateur','verification_identite','mission','prestataire_metier')
  id_entite       UUID
  type_fichier    ENUM('photo_profil','piece_recto','piece_verso','selfie','portfolio','cahier_charges')
  cle_stockage    VARCHAR(500)
  statut          ENUM('en_attente','disponible','supprime')
```

**Séparation de sécurité par bucket** :
- `bucket-public` → photo de profil, portfolio (CDN)
- `bucket-prive` → cahier des charges, pièces jointes de mission
- `bucket-kyc-chiffre` → pièces d'identité (accès admin uniquement, jamais exposé au client)

---

## 7. Points de vigilance retenus de l'analyse

1. **Ne pas dupliquer** nom/téléphone/email entre profils client et freelance — un seul `UTILISATEUR`
2. **Séparer inscription et publication de mission** côté client — sinon impossible de publier plusieurs missions différentes
3. **Repousser la vérification d'identité** après l'inscription pour réduire l'abandon, surtout pour les métiers à distance
4. **Taxonomie de services partagée** entre freelance et client (table `SERVICE` unique) pour éviter les doublons non normalisés
5. **Champ "Autre" en texte libre** → file de modération admin qui enrichit la taxonomie officielle au fil du temps
