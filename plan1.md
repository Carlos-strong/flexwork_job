
Modèle d'enregistrement des freelances
Lors de l'inscription, l'utilisateur choisit l'option « Je veux travailler comme freelance ». Il doit ensuite fournir :
etape 1: Compte
•	e-mail
•	Mot de passe
•	Confirmer Mot de passe
etape 2: Identité
•	Nom et prénom
•	Pays de résidence
•	Adresse de résidence
•	Téléphone
•	Numéro de pièce 
•	Photo recto 
•	Photo verso
etape 3: Prodessionnel
•	Metier
    - Métier principal 
    - Expérience 
    - Compétences
    - Certificat/Diplôme/Certification Flexwork(fichier PDF/jpeg/png)
    - Description
    - Portfolio
•	Zone
    - Pays d'intervention(definir le pays de résidence par défaut puis ajouter "International" a la liste des pays possibles)
    - Departement(optionnel)
    - Ville d'intervention(optionnel)
•	Tarif (Maintenir le tarif par prestation, par heure, par jour, par semaine, par mois)
•	Disponibilité (Maintenir le model implémenté)

etape 4: Validation

Après l'inscription, le freelance complète son profil puis valide via OTP et peut soumettre des candidatures aux offres publiées par les clients. 

2. Modèle d'enregistrement des clients
Le client choisit l'option « Je souhaite recruter pour un projet ». Il fournit :
etape 1: Compte
•	e-mail
•	Mot de passe
•	Confirmer Mot de passe
etape 2: Identité
•	Nom et prénom (Si Client)
•	Informations sur l'entreprise (Si entreprise)
    - Pays d'implantation
    - Adresse de l'entreprise
    - Téléphone de l'entreprise
    - Email professionnel
•	Adresse 
•	Téléphone
etape 3: Prodessionnel
•	Metier
    - Domaine d'intervention -> Choix dans la liste de métiers ou categories de services proposés sur la plateforme e metier
                             -> Si "Autre", afficher un champ de texte pour préciser le métier
    - Choisir les types d'interventions suivant les services de la categorie choisie (ex: pour "Informatique", proposer "Développement web", "Support technique", "Design graphique", etc.)
    - Description de la mission
    - Expérience requis
    - Compétences requises
    - Certificat/Diplôme/Certification Flexwork(fichier PDF/jpeg/png)->optionnel

•	Zone
    - Pays d'intervention(definir le pays de résidence par défaut puis ajouter "International" a la liste des pays )
    - Departement(optionnel)
    - Ville d'intervention(optionnel)
•	Tarif (Definir le tarif par prestation, par heure, par jour, par semaine, par mois)
•	Disponibilité (Maintenir le model implémenté)

etape 4: Validation

Une fois le compte créé, il peut publier des offres, rechercher des freelances et conclure des contrats. 

3. Particularité du modèle
Tu applique un modèl de compte unique avec plusieurs profils :
•	Un utilisateur possède un seul compte et une seule adresse e-mail. 
•	Sous ce compte, il est automatiquement redirigé vers le dashboard lié à son profil d'inscription 
•	Il peut basculer d'un rôle à l'autre sans créer un nouveau compte dans son dasboard au niveau du sidebar puis completer ses informattions par rapport au role choisi. au role choisi.





Pour le cas des prestations physiques locales (maçonnerie, plomberie, électricité, livraison, ménage), le modèle est un peu différent d'Upwork. Ici, il faut gérer :
•	La localisation des intervenants. 
•	La disponibilité. 
•	Les déplacements. 
•	La vérification des compétences. 
•	Les interventions sur site. 
•	Les évaluations de confiance et de sécurité. 
1. Modèle métier
Acteurs
•	Client : demande un service. 
•	Prestataire : réalise le service. 
•	Administrateur : valide les profils et supervise la plateforme. 
Catégories de services
Bâtiment
•	Maçon 
•	Plombier 
•	Électricien 
•	Peintre 
•	Carreleur 
Services à domicile
•	Ménagère 
•	Jardinier 
•	Gardien 
Livraison
•	Livreur moto 
•	Livreur voiture 
•	Livreur camion 
________________________________________
2. Modèle d'inscription des prestataires
Informations communes
Compte
•	Nom 
•	Prénom 
•	Téléphone 
•	Email 
•	Mot de passe 
Informations personnelles
•	Date de naissance 
•	Sexe 
•	Adresse 
•	Ville 
•	Quartier 
Vérification
•	Pièce d'identité 
•	Photo de profil 
•	Casier judiciaire (optionnel selon le pays) 
Informations professionnelles
•	Métier principal 
•	Métier secondaire 
•	Années d'expérience 
•	Description 
Disponibilité
•	Temps plein 
•	Temps partiel 
•	Week-end uniquement 
Zone d'intervention
•	Ville 
•	Quartiers desservis 
•	Rayon (km) 
Tarification
•	Tarif horaire 
•	Tarif journalier 
•	Tarif par intervention 
________________________________________
3. Modèle de services
Chaque service appartient à une catégorie.
Exemple
Catégorie	Service
Plomberie	Réparation fuite
Plomberie	Installation robinet
Électricité	Installation prise
Électricité	Dépannage électrique
Maçonnerie	Construction mur
Maçonnerie	Crépissage
Livraison	Livraison colis
Livraison	Livraison repas
Ménage	Nettoyage maison
Ménage	Nettoyage bureau

Pour une plateforme de services physiques à domicile (maçonnerie, plomberie, électricité, ménage, livraison), il est préférable d'utiliser un compte unique Utilisateur puis de permettre à l'utilisateur de devenir Client, Prestataire ou les deux. Cela simplifie l'inscription et favorise la croissance de la plateforme.
1. Formulaire d'inscription du Client
Étape 1 : Création du compte
Informations personnelles
•	Nom
•	Prénom
•	Téléphone (obligatoire)
•	Email (facultatif ou obligatoire selon la stratégie)
•	Mot de passe
•	Confirmation du mot de passe
Étape 2 : Localisation
Adresse principale
•	Pays
•	Ville
•	Arrondissement/Commune
•	Quartier
•	Adresse détaillée
•	Position GPS (optionnelle)
Étape 3 : Validation
•	Code OTP par SMS
•	Acceptation des conditions d'utilisation
Données enregistrées
CLIENT
--------
id_client
nom
prenom
telephone
email
mot_de_passe
ville
quartier
adresse
date_inscription
statut_compte
________________________________________
2. Formulaire d'inscription du Prestataire (Freelance)
Étape 1 : Informations personnelles
•	Nom
•	Prénom
•	Téléphone
•	Email
•	Mot de passe
•	Photo de profil
Étape 2 : Vérification d'identité
•	Numéro de pièce d'identité
•	Type de pièce :
o	Carte nationale
o	Passeport
o	Permis
•	Photo recto
•	Photo verso
•	Selfie de vérification
Étape 3 : Informations professionnelles
Métier principal
Liste :
•	Maçon
•	Plombier
•	Électricien
•	Ménagère
•	Livreur
•	Jardinier
•	Peintre
•	Autre
Services proposés
Exemple pour un plombier :
☑ Réparation de fuite
☑ Installation robinet
☑ Débouchage canalisation
☑ Installation chauffe-eau
Expérience
•	Débutant
•	1 à 3 ans
•	3 à 5 ans
•	Plus de 5 ans
Description
Exemple :
Plombier professionnel avec 7 ans d'expérience dans les installations et réparations domestiques.
________________________________________
Étape 4 : Zone d'intervention
•	Ville
•	Arrondissement
•	Quartiers desservis
•	Rayon d'intervention (1 à 50 km)
________________________________________
Étape 5 : Tarification
Choix du mode
○ Tarif horaire
○ Tarif journalier
○ Tarif hebdomadaire
○ Tarif mensuel
○ Tarif par prestation
Exemple :
Service	Prix
Réparation fuite	5 000 FCFA
Installation robinet	8 000 FCFA
________________________________________
Étape 6 : Disponibilité
☑ Lundi
☑ Mardi
☑ Mercredi
☑ Jeudi
☑ Vendredi
☑ Samedi
☑ Dimanche
Heure début
Heure fin
________________________________________
Étape 7 : Validation
•	OTP SMS
•	Validation administrative
Données enregistrées
PRESTATAIRE
------------
id_prestataire
nom
prenom
telephone
email
photo
piece_identite
experience
description
ville
quartier
rayon_intervention
disponibilite
statut_validation
date_inscription
________________________________________
3. Modèle amélioré (recommandé)
Au lieu de séparer dès le départ Client et Prestataire :
UTILISATEUR
------------
id
nom
prenom
telephone
email
mot_de_passe
photo
date_creation

ROLE
------
id_role
libelle

UTILISATEUR_ROLE
----------------
id_utilisateur
id_role
Rôles :
•	Client
•	Prestataire
•	Administrateur
Ainsi, une ménagère peut aussi commander un plombier, ou un plombier peut demander un livreur. Un même compte peut jouer plusieurs rôles.
4. Formulaire de demande de service (côté client)
Après inscription :
Nouvelle demande
•	Catégorie
•	Service demandé
•	Description du problème
•	Photos (optionnel)
•	Adresse
•	Date souhaitée
•	Heure souhaitée
•	Budget proposé
Exemple :
Catégorie : Plomberie

Service : Réparation fuite

Description :
Fuite importante sous l'évier de la cuisine.

Date :
25/06/2026

Heure :
14h00

Budget :
7 000 FCFA
Cette structure est proche des modèles utilisés par des plateformes comme :
•	TaskRabbit
•	Thumbtack
•	Urban Company

