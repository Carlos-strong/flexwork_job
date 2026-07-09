## 1. Structure du tableau à construire

| Colonne | Type | Description |
|---|---|---|
| **Candidat** | Texte | Nom du candidat (ex: Yves Gaspard) |
| **Profil** | Statut/Badge | État du profil : *Consulté*, *Non consulté*, etc. |
| **Statut-fixe** | Numérique | Montant fixe associé (ex: 25 000) |
| **Action** | Bouton dynamique / Dropdown | Bouton par défaut "Consulter" → devient notification une fois cliqué. Dropdown avec : Présélectionner / Archiver / Refuser |

**Règles de comportement de la colonne Action (déduites de votre schéma) :**
- État initial : bouton **"Consulter"**
- Au clic → le profil passe à **"Consulté"**, le bouton est **remplacé** par une icône de **notification** (pas un nouveau bouton, remplacement direct)
- Un **mail automatique** est envoyé au candidat à ce moment
- Le champ **reste modifiable** (non figé) après l'envoi — donc l'action peut être annulée/changée
- Dès qu'une action finale (Archiver/Refuser/Présélectionner) est choisie dans le dropdown → le dossier est archivé côté recruteur ET une notification apparaît dans le dashboard du candidat

---

## 2. Prompts d'intégration

**a) Composant tableau (frontend)**
```
Crée un composant CandidateTable avec les colonnes :
Candidat (texte), Profil (badge de statut), Statut-fixe (numérique), 
Action (bouton dynamique).

Comportement de la colonne Action :
- État par défaut : bouton "Consulter"
- Au clic : affiche un modal comportant le profil complet du candidat selection.
Ce modal comporte toutes les données du profil professionnelle du candidat y compris des lecteurs de document en pdf/jpag/portofolio pour la visualisation des documents.
En bas du modal un bouton de confirmation de la consultation du profil qui declanche le reste du process. remplace le bouton par une icône de notification, 
  passe le Profil à "Consulté"
- Affiche ensuite un dropdown avec 3 choix : Présélectionner, Archiver, Refuser
- Le champ reste éditable après le clic (pas de verrouillage)
```

**b) Logique backend (statut + email auto)**
```
Fonction updateCandidateStatus(candidateId, newStatus) :
1. Met à jour le champ "Profil" du candidat
2. Si newStatus === "Consulté" : envoie un email automatique au candidat 
   ET crée une entrée de notification (sans verrouiller le champ) puis ouvre une page qui permet de visualiser le profil complet du candidat.
3. Si newStatus dans [Présélectionner, Archiver, Refuser] : archive le 
   dossier côté recruteur et pousse une notification dans le dashboard candidat
4. Journalise chaque changement avec timestamp
```

**c) Dashboard candidat**
```
Ajoute une section "Notifications" dans le dashboard candidat qui reflète 
en temps réel les changements de statut envoyés par le backend 
(Consulté / Présélectionné / Archivé / Refusé).
```

Un point reste incertain sur votre note : la partie "mail est automat[isé] pour... mais une notification clique" — pouvez-vous confirmer si le mail part **uniquement** au passage "Consulté.
