# SPEC — Tournées commerciales

## Objectif

Faciliter l'acquisition de nouveaux clients. L'application aide les commerciaux à choisir les bons prospects, à optimiser leurs tournées et à remonter leurs comptes rendus de visite dans le CRM. Elle permet au directeur commercial de suivre l'activité terrain.

## Utilisateurs

Une dizaine de personnes, réparties en trois rôles :

| Rôle | Qui | Ce qu'il fait |
|---|---|---|
| **Utilisateur** | Commercial terrain | Priorise ses prospects, planifie et réalise ses tournées, rédige ses comptes rendus |
| **Manager** | Directeur commercial | Suit l'activité terrain de l'équipe |
| **Admin** | Gestionnaire de l'outil | Gère les comptes et les paramètres |

## Fonctionnalité principale

1. **Prioriser** : les prospects importés de Dynamics 365 reçoivent un score de priorité. Le commercial choisit son Top 10.
2. **Planifier** : le commercial sélectionne ses prospects et l'application calcule l'ordre de visite optimisé.
3. **Visiter et rendre compte** : après chaque visite, un compte rendu rapide est saisi puis envoyé dans Dynamics 365.
4. **Suivre** : le manager consulte l'activité de l'équipe.

## Écrans (3)

1. **Prospects** (commercial) : la base importée de Dynamics, classée par score de priorité, avec le Top 10 choisi par le commercial. C'est ici qu'il sélectionne les prospects de sa tournée.
2. **Ma tournée** (commercial) : la journée de visites dans l'ordre optimisé. Le compte rendu de chaque visite s'ouvre dans un panneau.
3. **Tableau de bord** (manager) : l'activité de l'équipe (visites, comptes rendus, prospects vus). Pour l'admin, une section gère les comptes.

## Données stockées

- **Utilisateurs** : nom, email, rôle, adresse de départ.
- **Prospects** (copie importée de Dynamics, enrichie par des bases publiques comme SIRENE ou l'Annuaire des Entreprises) : ID Dynamics, raison sociale, SIRET, code NAF, effectif, adresse avec coordonnées GPS, contact, téléphone, score de priorité, présence dans le Top 10.
- **Tournées** : commercial, date, liste ordonnée des visites, kilomètres et durée estimés.
- **Visites** : prospect, heure prévue, statut (à faire, faite, annulée ou reportée).
- **Comptes rendus** : visite, date, résumé, intérêt du prospect, prochaine action, statut d'envoi vers Dynamics.

## Contraintes

- Application web **responsive**, utilisable sur téléphone, tablette et ordinateur.
- Les prospects viennent **obligatoirement** de Dynamics 365.

## Hors périmètre (V1)

- Création de prospects dans l'application.
- Synchronisation complète avec le CRM : pas d'opportunités ni de devis, seulement l'import des prospects et l'envoi des comptes rendus.
- Application mobile native.
- Mode hors ligne.
- Suivi GPS en temps réel des commerciaux.
- Notes de frais et indemnités kilométriques.
- Messagerie et notifications internes.

## À définir plus tard

- Fonctionnalités détaillées de « Ma tournée » : point de départ, carte, lien vers Waze ou Maps, rendez-vous à heure fixe, prospects à proximité, estimation de la journée…
- Critères et mode de calcul du score de priorité des prospects.
