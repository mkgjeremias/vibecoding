# Tournées commerciales · prototype

Aide à la préparation des tournées pour les commerciaux terrain de Jeremias France : ordre de visite optimisé, heures de rendez-vous proposées, tournées sur plusieurs jours, suggestions de comptes le long du trajet, compte-rendu de visite rapide sur mobile.

**Prototype de démonstration.** Toutes les données sont fictives. Les distances et horaires sont des estimations.

## Lancer l'application

Aucune installation : HTML, CSS et JavaScript, sans framework ni Node.js.

1. Ouvrir `index.html` dans Chrome, Edge ou Firefox (double-clic).
2. Choisir un profil en haut à droite : un des 12 commerciaux, ou la direction commerciale.

Seul le fond de carte (tuiles OpenStreetMap) passe par Internet. Tout le reste fonctionne hors ligne.

## Tests

- `tests.html` : 44 tests des calculs (optimiseur, géométrie, planning, marges, découpage sur plusieurs jours, statuts, score, génération des données).
- `tests-ui.html` : parcours automatique de tous les écrans et des actions principales. Les données du navigateur sont sauvegardées puis restaurées.

Ouvrir la page : le résultat s'affiche en haut (« OK : n / n »).

## Écrans

| Écran | Pour qui | Contenu |
|---|---|---|
| Planifier | Commercial | Tournées planifiées, ordre optimisé, heure proposée par étape, durée modifiable par visite, glisser-déposer, proposition de découpage sur plusieurs jours, créneau prospection, suggestions et recherche, carte du trajet |
| Ma tournée | Commercial (mobile) | Visites jour par jour, contact cliquable, compte-rendu en quelques touches, enregistré sur l'appareil |
| Carte | Tous | Comptes colorés par statut, filtres (statut, potentiel, importants, périmètre) |
| Équipe | Manager | Tournées prévues par commercial, visites prévues et réalisées |
| Paramètres | Tous | Journée type, marges, seuils de statut, réinitialisation des données |

La fiche compte (contact, visites, échanges, devis, CA, prochaine action, étape du prospect) s'ouvre depuis tous les écrans.

## Règles de calcul

- Distance = vol d'oiseau × 1,3 ; temps = distance à 60 km/h, majoré de la marge de trajet (15 %).
- Ordre : plus proche voisin, puis amélioration 2-opt. Après un déplacement manuel, horaires et km sont recalculés.
- Heures de rendez-vous arrondies aux 5 minutes ; pause déjeuner prise à la première arrivée après 12h00.
- Plusieurs jours proposés si une visite est à plus de 2 h de route du domicile, ou si la journée finit après 18h30. Chaque jour se remplit jusqu'à 18h30 moins le temps libre (1 h). Nuit dans la commune de la dernière visite ; le dernier jour se termine au domicile. Les jours de tournée vont du mardi au vendredi.
- Alerte si un trajet traverse l'estuaire de la Gironde ou de la Loire (distance sous-estimée).
- Statuts calculés, seuils réglables : client à risque (aucune visite depuis 120 jours, ou CA des 6 derniers mois en baisse de plus de 30 % quand la référence atteint 3 000 €), prospect chaud (score ≥ 60, ou rendez-vous obtenu, ou devis envoyé), compte important (coché, ou CA 12 mois ≥ 40 000 €).
- Score des suggestions : ancienneté de la dernière visite (jusqu'à 40) + devis en cours (30) + potentiel (jusqu'à 25) + client à risque ou prospect chaud (10).

## Structure

```
index.html            application
tests.html            tests des calculs        tests-ui.html   tests de l'interface
css/style.css         styles (responsive)
data/communes.js      communes de plus de 2 000 habitants (Etalab, geo.api.gouv.fr), figées
vendor/leaflet/       bibliothèque de carte Leaflet 1.9.4 (copie locale)
js/util.js            dates, formats, aléatoire déterministe
js/routing/           calcul d'itinéraire isolé
  geo.js                distances, estuaires
  provider.js           fournisseur de distances (point de branchement d'une API routière)
  optimizer.js          plus proche voisin + 2-opt, insertion
  planning.js           horaires, marges, découpage sur plusieurs jours, alertes
js/domain.js          paramètres, statuts, score, suggestions
js/seed.js            génération des données fictives
js/data.js            DataService (point de branchement de Dynamics)
js/app.js             interface
```

## Points de branchement

- **CRM Dynamics** : remplacer l'objet déclaré à la fin de `js/data.js` par une implémentation du même contrat (`load`, `saveCompte`, `saveVisite`, `saveTournee`, `deleteTournee`, `saveParametres`, `reset`).
- **API routière** : écrire un fournisseur au même contrat que `haversineProvider` dans `js/routing/provider.js` et l'activer avec `TC.routing.setProvider(...)`.

## Limites connues

- Vol d'oiseau sous-estimé en relief et autour des estuaires (seules la Gironde et la Loire sont signalées).
- Pas de mode hors ligne complet (la page doit avoir été ouverte), pas de CRM branché, pas d'authentification.
- Données stockées dans le navigateur uniquement : elles ne sont pas partagées entre appareils.
- Fond de carte OpenStreetMap public, non adapté à une production.
- Positions des comptes au centre de leur commune.
- Aucune géolocalisation du commercial (règles CNIL).
