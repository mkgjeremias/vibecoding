# SPEC — Tournées commerciales

## Objectif

Aider les commerciaux terrain de Jeremias France (installateurs, fumistes, bureaux d'études, distributeurs du bâtiment et du chauffage) à préparer leurs tournées simplement, et donner à la direction un tableau de pilotage.

Le retour sur la version précédente : elle était trop complexe, on ne savait pas par où commencer ni comment choisir les comptes à voir, et la direction n'avait pas de pilotage.

Itération actuelle : un prototype de démonstration, avec des données fictives et aucun service externe.

## Utilisateurs

| Rôle | Qui | Écrans |
|---|---|---|
| **Commercial** | 11 itinérants, un par secteur | Préparer, Ma tournée |
| **Direction** | Directeur commercial | Pilotage, Paramètres |

- Les 2 commerciaux sédentaires ne sont pas concernés.
- Rythme : lundi au bureau, tournées du mardi au vendredi. Objectif : au moins 10 visites par semaine.
- Le commercial prépare d'abord sa tournée, puis prend ses rendez-vous aux heures proposées.

## Secteurs

| Secteur | Départements |
|---|---|
| AA | 60, 75, 78, 92, 93, 94, 95 |
| AB | 10, 28, 41, 45, 51, 77, 89, 91 |
| AC | 14, 27, 50, 61, 76 |
| AE | 02, 08, 59, 62, 80 |
| FB | 52, 54, 55, 57, 67, 68, 70, 88, 90 |
| FC | 18, 22, 23, 29, 35, 36, 37, 44, 49, 53, 56, 72, 79, 85, 86, 87, 2A, 2B |
| BA | 03, 07, 21, 42, 43, 58, 63, 71 |
| BB | 01, 25, 26, 38, 39, 69, 73, 74 |
| CA | 04, 05, 06, 13, 30, 34, 83, 84 |
| CB | 16, 17, 19, 24, 32, 33, 40, 46, 47, 64, 65 |
| CD | 09, 11, 12, 15, 31, 48, 66, 81, 82 |

FC est un découpage provisoire et très étendu. Il sert de démonstration des tournées sur plusieurs jours.

## Parcours commercial

**Préparer**, en 3 étapes avec Suivant et Retour :
1. **Où aller ?** Les départements du secteur, avec le nombre de comptes à voir (en retard, à risque, devis en attente, prospects chauds) et une carte. Le commercial choisit les départements et la date.
2. **Qui voir ?** Les comptes triés par priorité, filtrables par activité et par type. Chaque compte affiche sa raison en clair, sans score. Une présélection automatique remplit le temps disponible. Un compteur suit en direct les visites, les km et les jours.
3. **Caler les rendez-vous.** Itinéraire par jour, heure à proposer, téléphone et bouton « Rendez-vous confirmé ». Glisser-déposer possible, créneau prospection en option. La tournée est « prête » quand tous les rendez-vous sont confirmés.

**Ma tournée** (mobile) : les visites jour par jour, puis un compte-rendu rapide (résultat, prochaine action, date de relance, note).

## Pilotage direction

- Filtres : période, secteur, activité.
- Synthèse : visites, visites par semaine et par commercial, km par visite, devis, commandes.
- Une ligne par commercial : visites par semaine (alerte sous 10), km par visite, part des clients A et B vus dans leur fréquence, clients à risque sans visite prévue, part de visites avec compte-rendu, devis, commandes.
- Répartition des visites par activité.
- Carte des secteurs selon la part de comptes à voir.

Les données viennent uniquement des visites déclarées et des tournées prévues.

## Données et règles

- Le modèle comprend : secteur, commercial, compte (type, une ou plusieurs activités : fumisterie individuelle, fumisterie tertiaire, ventilation, industrie), visite, échange, devis, commande et tournée.
- **Fréquence de visite** réglable : A tous les 42 jours (6 semaines), B tous les 91 jours (3 mois), C tous les 182 jours (6 mois). Un compte est **à voir** s'il est en retard sur sa fréquence, s'il est client à risque, s'il a un devis en attente, ou si c'est un prospect chaud.
- **Statuts calculés** :
  - client à risque : aucune visite depuis 120 jours, ou CA des 6 derniers mois en baisse de plus de 30 % quand la référence atteint 3 000 € ;
  - prospect chaud : score ≥ 60, ou rendez-vous obtenu, ou devis envoyé ;
  - compte important : coché, ou CA 12 mois ≥ 40 000 €.
- **Priorité** : elle est calculée en interne pour trier les comptes et n'est jamais affichée.
- **Calcul des tournées** : vol d'oiseau × 1,3 à 60 km/h, plus proche voisin puis 2-opt. Départ 8h00, visite de 60 min, pause 12h00–13h00, alerte de retour après 18h30, trajets majorés de 15 %, 1 h de temps libre par jour.
- **Plusieurs jours** : proposé si une visite est à plus de 2 h de route ou si la journée finit trop tard. Le commercial accepte ou refuse. La nuit se passe dans la commune de la dernière visite.

## Contraintes

- HTML, CSS et JavaScript **sans framework, sans build ni installation**. Seule bibliothèque : Leaflet, en copie locale.
- Aucun appel réseau autre que les tuiles du fond de carte (Plan IGN).
- Points de branchement préservés : DataService (futur Dynamics) et fournisseur d'itinéraire (future API routière).
- **Aucune géolocalisation** du commercial.
- Interface en français avec le vocabulaire du terrain.

## Hors périmètre et limites

- Hors périmètre : mode hors ligne complet, connexion au CRM, authentification.
- Le vol d'oiseau sous-estime les trajets en relief, autour des estuaires (seules la Gironde et la Loire sont signalées) et vers la Corse (ferry signalé, mais non compté).
- Les comptes sont positionnés au centre de leur commune.
