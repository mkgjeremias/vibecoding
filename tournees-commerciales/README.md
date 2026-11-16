# Tournées commerciales · prototype

Aide à la préparation des tournées pour les commerciaux terrain de Jeremias France : un parcours guidé en 3 étapes (où aller, qui voir, caler les rendez-vous), un compte-rendu rapide sur mobile, et un tableau de pilotage pour la direction.

**Prototype de démonstration.** Toutes les données sont fictives. Les distances et horaires sont des estimations.

## Lancer l'application

Aucune installation : HTML, CSS et JavaScript, sans framework ni Node.js.

1. Ouvrir `index.html` dans Chrome, Edge ou Firefox (double-clic).
2. Choisir un profil en haut à droite : un des 11 commerciaux (un par secteur), ou la direction commerciale. Le profil par défaut est le commercial du secteur FC, très étendu, qui montre les tournées sur plusieurs jours.

Seul le fond de carte (Plan IGN de la Géoplateforme, service public gratuit et sans clé) passe par Internet. Tout le reste fonctionne hors ligne.

## Tests

- `tests.html` : 66 tests des calculs (optimiseur, géométrie, planning, marges, découpage sur plusieurs jours, statuts, fréquence de visite, priorisation, indicateurs du pilotage, génération des données et secteurs).
- `tests-ui.html` : parcours automatique de tous les écrans et des actions principales. Les données du navigateur sont sauvegardées puis restaurées.

Ouvrir la page : le résultat s'affiche en haut (« OK : n / n »).

## Écrans

| Écran | Pour qui | Contenu |
|---|---|---|
| Préparer | Commercial | 1. Où aller ? : départements du secteur avec le nombre de comptes à voir, carte. 2. Qui voir ? : comptes triés par priorité avec leur raison en clair, filtres activité et type, présélection automatique, compteur visites / km / jours. 3. Caler les rendez-vous : itinéraire par jour, heure à proposer, téléphone, « Rendez-vous confirmé », glisser-déposer, prospection en fin de journée, découpage sur plusieurs jours |
| Ma tournée | Commercial (mobile) | Visites jour par jour, contact, compte-rendu en quelques touches, enregistré sur l'appareil |
| Pilotage | Direction | Synthèse, tableau par commercial (visites par semaine, km par visite, clients A et B vus dans leur fréquence, clients à risque sans visite prévue, comptes-rendus, devis, commandes), visites par activité, carte des secteurs ; filtres période, secteur, activité |
| Paramètres | Direction | Journée type, fréquences de visite, marges, seuils de statut, réinitialisation des données |

La fiche compte (contact, visites, échanges, devis, CA, prochaine action, étape du prospect) s'ouvre depuis tous les écrans.

## Règles de calcul

- Distance = vol d'oiseau × 1,3 ; temps = distance à 60 km/h, majoré de la marge de trajet (15 %).
- Ordre : plus proche voisin, puis amélioration 2-opt. Après un déplacement manuel, horaires et km sont recalculés.
- Heures de rendez-vous arrondies aux 5 minutes ; pause déjeuner prise à la première arrivée après 12h00.
- Plusieurs jours proposés si une visite est à plus de 2 h de route du domicile, ou si la journée finit après 18h30. Chaque jour se remplit jusqu'à 18h30 moins le temps libre (1 h). Nuit dans la commune de la dernière visite ; le dernier jour se termine au domicile. Les jours de tournée vont du mardi au vendredi.
- Alerte si un trajet traverse l'estuaire de la Gironde ou de la Loire (distance sous-estimée).
- Statuts calculés, seuils réglables : client à risque (aucune visite depuis 120 jours, ou CA des 6 derniers mois en baisse de plus de 30 % quand la référence atteint 3 000 €), prospect chaud (score ≥ 60, ou rendez-vous obtenu, ou devis envoyé), compte important (coché, ou CA 12 mois ≥ 40 000 €).
- Fréquence de visite : A 6 semaines, B 3 mois, C 6 mois (réglable). Un compte est à voir s'il est en retard sur sa fréquence, client à risque, avec un devis en attente ou prospect chaud. La priorité qui trie les comptes reste interne et n'est pas affichée.
- Alerte quand un trajet va ou vient de Corse : traversée en ferry non comptée.

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
js/domain.js          paramètres, statuts, comptes à voir, priorité, indicateurs du pilotage
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
- Fond de carte : Plan IGN (Géoplateforme). Les serveurs d'OpenStreetMap refusent les pages ouvertes depuis un fichier local ; en production, vérifier les conditions d'usage ou choisir un fournisseur sous contrat.
- Positions des comptes au centre de leur commune.
- Aucune géolocalisation du commercial (règles CNIL).
