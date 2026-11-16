# SPEC — Tournées commerciales

## Objectif

Faciliter l'acquisition et le suivi client des commerciaux terrain de Jeremias France (installateurs, fumistes, bureaux d'études, distributeurs du bâtiment et du chauffage) en **optimisant leurs tournées**.

Problèmes à résoudre : pas assez de visites, trop de kilomètres, suivi client irrégulier, tournées non guidées.

Itération actuelle : prototype de démonstration pour la direction et les commerciaux, avec des données fictives et aucun service externe.

## Utilisateurs

| Rôle | Qui | Ce qu'il fait |
|---|---|---|
| **Commercial** | 12 commerciaux itinérants, toute la France | Prépare ses tournées, prend ses rendez-vous aux heures proposées, saisit ses comptes rendus |
| **Manager** | Directeur commercial | Consulte les tournées prévues et le nombre de visites |

Rythme : lundi au bureau, tournées du mardi au vendredi. La tournée est préparée plusieurs jours avant, au minimum la veille, puis les rendez-vous sont pris en suivant les horaires proposés.

## Fonctionnalité principale

1. **Planifier** : sélectionner des comptes (suggestions le long du trajet, recherche), obtenir l'ordre optimisé et une heure de rendez-vous par étape, ajuster à la main.
2. **Plusieurs jours** : si une visite est à plus de 2 h de route ou si la journée finit trop tard, l'outil propose un découpage. Le commercial l'accepte ou le refuse. Chaque soir, il dort dans la commune de la dernière visite.
3. **Prospecter** : ajouter un créneau prospection en fin de journée, avec des prospects proches suggérés.
4. **Rendre compte** : sur mobile, un compte rendu très rapide est enregistré localement.
5. **Suivre** : le manager voit les tournées prévues par commercial.

## Écrans

1. **Planifier** (commercial, ordinateur) : tournées planifiées, étapes avec heures proposées, durée par visite, glisser-déposer, découpage, prospection, suggestions et carte du trajet.
2. **Ma tournée** (commercial, mobile) : visites jour par jour, puis compte rendu (résultat, prochaine action, date de relance, note).
3. **Carte** : comptes colorés par statut, avec des filtres.
4. **Équipe** (manager) : tournées prévues et nombre de visites.

S'y ajoutent les **Paramètres** et la **fiche compte** (fenêtre). Les écrans Prospection (pipeline) et Indicateurs sont retirés : l'étape du prospect reste modifiable depuis la fiche.

## Données

Secteur, commercial (le domicile sert de point de départ), compte (client ou prospect, potentiel A/B/C, case « important », étape et score du prospect), visite, échange, devis, commande, tournée (1 à N jours, étapes ordonnées, durée par étape, créneaux de prospection).

Les statuts sont calculés, jamais saisis : client actif, client à risque, prospect chaud, prospect froid, compte important. Leurs seuils se règlent dans les paramètres.

## Contraintes

- HTML, CSS et JavaScript **sans framework, sans build, sans installation**. Seule bibliothèque : Leaflet, en copie locale.
- Aucun appel réseau autre que les tuiles de carte.
- Deux points de branchement préservés : DataService (futur Dynamics) et fournisseur d'itinéraire (future API routière).
- **Aucune géolocalisation** du commercial (règles CNIL).
- Application responsive. Le compte rendu doit rester très rapide, car la saisie CRM est faible aujourd'hui.

## Hors périmètre

- Mode hors ligne complet, connexion à Dynamics, authentification.
- Recherche d'hôtel, notes de frais, messagerie.
- Indicateurs détaillés et pipeline de prospection.

## Limites connues

- Le vol d'oiseau sous-estime les trajets en relief et autour des estuaires. Seules la Gironde et la Loire sont signalées.
- Le fond de carte OpenStreetMap public ne convient pas à une production.
- Les comptes sont positionnés au centre de leur commune.
