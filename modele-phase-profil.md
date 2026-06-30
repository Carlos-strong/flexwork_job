# Modèle d'enregistrement — vue par phase × profil utilisateur

Le workflow se lit selon deux axes :
- **Phase** : Inscription (création du compte, une seule fois) vs Post-inscription (actions répétables dans le temps)
- **Profil** : Freelance vs Client

Un même utilisateur peut être les deux à la fois (compte unique, voir section 3).

---

## Phase A — Inscription (une seule fois par profil)

### A.1 Freelance

| Étape | Contenu |
|---|---|
| 1. Compte | E-mail, mot de passe, confirmation |
| 2. Identité | Nom, prénom, pays de résidence, adresse, téléphone |
| 3. Professionnel *(répétable par métier)* | Métier principal, expérience, compétences, certificats, description, portfolio · Zone (local/distance/international) · Tarif de référence (prix fixé ou devis libre, par unité) · Disponibilité |
| 4. Validation | OTP SMS, acceptation CGU |

> Pas de pièce d'identité à cette phase — repoussée en phase B.

### A.2 Client

| Étape | Contenu |
|---|---|
| 1. Compte | E-mail, mot de passe, confirmation |
| 2. Identité | Nom/prénom (particulier) ou infos entreprise (pays, adresse, téléphone, email pro) · Adresse · Téléphone |
| 3. Validation | OTP SMS, acceptation CGU |

> Pas d'étape "Professionnel" côté client — aucun métier, tarif ni disponibilité déclaré à l'inscription. Le compte est actif dès cette étape.

**Constat de la phase A** : l'inscription freelance est plus longue (4 étapes, dont un profil professionnel) car elle crée un actif réutilisable. L'inscription client est volontairement courte (3 étapes) car elle ne fait que créer une identité ; le contenu métier est déplacé en phase B.

---

## Phase B — Post-inscription (actions répétables, à tout moment)

### B.1 Freelance

| Action | Déclenchement | Contenu |
|---|---|---|
| Vérification d'identité | À la 1ère candidature ou au 1er paiement reçu | Numéro de pièce, photo recto/verso, selfie → validation admin |
| Ajout d'un métier supplémentaire | Depuis le dashboard, à tout moment | Reprend l'étape 3 de la phase A pour un nouveau métier, sans repasser par la vérification d'identité |
| Candidature à une mission | Sur une mission publiée par un client | Montant proposé, délai estimé, message — négociable même si le client a fixé un prix |
| Mise à jour profil | À tout moment | Tarif, disponibilité, zone, portfolio modifiables indépendamment par métier |

### B.2 Client

| Action | Déclenchement | Contenu |
|---|---|---|
| Publication d'une mission | Depuis le dashboard, autant de fois que voulu | Domaine + service (avec champ "Autre"), description, compétences requises, cahier des charges (optionnel) · Zone (sur site/distance/hybride) · Tarif (prix fixé ou ouvert aux devis) · Durée prévisionnelle · Disponibilité souhaitée |
| Réception et tri des candidatures | Après publication | Comparaison des montants proposés, profils, délais |
| Acceptation / contre-offre | Sur une candidature reçue | Validation du montant ou négociation |
| Conclusion de contrat | Après acceptation | Démarrage de la mission |

**Constat de la phase B** : c'est ici que le client effectue tout ce que l'ancien modèle plaçait à l'inscription (métier, tarif, zone, disponibilité) — mais appliqué à une mission précise et répétable, pas à un profil figé.

---

## Tableau croisé — où vit chaque donnée

| Donnée | Freelance | Client |
|---|---|---|
| Métier / domaine | Phase A (profil permanent, par métier) | Phase B (par mission, ponctuel) |
| Tarif | Phase A (référence par défaut) + ajustable en B (candidature) | Phase B (par mission) |
| Zone géographique | Phase A (par métier : local/distance/international) | Phase B (par mission : sur site/distance/hybride) |
| Disponibilité | Phase A (profil) | Phase B (souhait par mission) |
| Pièce d'identité | Phase B (différée, conditionnelle) | Jamais demandée (sauf vérification entreprise si besoin) |
| Négociation du prix | Phase B, à la candidature | Phase B, à la réception des candidatures |

---

## Lecture du modèle

```
                    PHASE A : Inscription              PHASE B : Post-inscription
                    (une fois, identité)                (répétable, activité)

FREELANCE     →     Compte + Identité            →     Vérification identité (différée)
                     + Profil pro par métier            + Ajout de métiers
                     + Zone, tarif, dispo                + Candidatures (négociables)

CLIENT        →     Compte + Identité            →     Publication de missions (répétable)
                     (rien d'autre)                      + Zone, tarif, dispo PAR mission
                                                          + Tri des candidatures
```

**Principe directeur** : la phase A ne contient que ce qui est **stable dans le temps** (qui je suis, quel métier j'exerce). La phase B contient tout ce qui est **variable d'une transaction à l'autre** (quelle mission, quel tarif, quelle zone, cette fois-ci). C'est cette séparation qui évite au client de se retrouver enfermé dans un seul métier/tarif/zone déclarés une fois pour toutes.
