# Tournées commerciales · prototype

Application web pour les commerciaux itinérants : carte des clients et prospects, préparation de tournées optimisées, suggestions le long du trajet, pipeline de prospection, compte-rendu de visite sur mobile, indicateurs et vue manager.

**Prototype.** Toutes les données sont fictives et stockées dans le navigateur. Les distances et horaires sont des estimations.

## Installation

Prérequis : Node.js 18 ou plus récent.

```bash
npm install
npm run dev
```

L'application s'ouvre sur `http://localhost:5173`. Le serveur écoute aussi sur le réseau local (adresse affichée dans le terminal) : pratique pour tester sur un téléphone connecté au même Wi-Fi.

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm run build` | Vérification TypeScript et build de production dans `dist/` |
| `npm run preview` | Sert le build de production |
| `npm test` | Tests unitaires (optimiseur, géométrie, planning, seed) |

## Utilisation

- **Sélecteur de profil** en haut : un des 4 commerciaux ou le responsable commercial. Pas d'authentification.
- **Commercial** : Tournée du jour, Carte, Planifier, Prospection, Indicateurs.
- **Responsable** : Vue manager, Carte, Prospection, Indicateurs (toute l'équipe ou un commercial).
- **Paramètres** (roue dentée) : coefficient routier, vitesse moyenne, durée de rendez-vous, pause déjeuner, heure limite de retour, seuils de statut et d'alerte, **réinitialisation des données**.

Parcours type :

1. Sur ordinateur, *Planifier* : choisir la date, ajouter des comptes (liste, carte ou suggestions), cliquer sur *Optimiser l'ordre*, ajuster à la main par glisser-déposer.
2. Sur mobile, *Aujourd'hui* puis *Compte-rendu* sur l'étape : résultat, prochaine action, date de relance, note. Deux clics depuis l'ouverture de l'application.

Une tournée du jour est générée pour chaque commercial au moment du seed, pour pouvoir tester l'écran mobile immédiatement.

## Structure

```
src/
  domain/        Types du modèle, libellés FR, calculs dérivés (statut, CA, dernière visite)
  services/      Couche d'accès aux données : interface DataService + implémentation localStorage
  routing/       Module d'itinéraire isolé : fournisseur de distances, optimiseur, planning horaire
  seed/          Générateur de données fictives + référentiel de communes (communes.json)
  state/         Contextes React (données chargées via les services, profil courant)
  features/
    carte/         Carte et filtres
    tournee/       Planification, tournée du jour, liste réordonnable, carte de tournée
    suggestions/   Comptes proches du trajet, score de priorité
    compteRendu/   Formulaire mobile
    prospection/   Pipeline, édition, création de prospect
    indicateurs/   Calcul des KPI et écran
    manager/       Vue responsable
    comptes/       Fiche compte réutilisée partout
    parametres/    Paramètres et réinitialisation
  components/    UI partagée (boutons, badges, carte de base, icônes, layout)
  lib/           Formats français, aléatoire déterministe, enveloppe convexe
```

Les écrans n'accèdent jamais directement au `localStorage` : ils passent par `state/DataContext`, qui appelle `services/`.

## Modèle de données

| Entité | Champs principaux |
|---|---|
| `Secteur` | id, nom, départements, couleur |
| `Commercial` | id, prénom, nom, secteur, domicile (adresse, commune, lat/lng) |
| `Compte` | id, nature (`client` ou `prospect`), raison sociale, type (installateur, fumiste, bureau d'études, distributeur), adresse, commune, lat/lng, contact, commercial, potentiel (A/B/C), `important`, prochaine action. Pour les prospects : étape du pipeline, score 0-100, motif de perte |
| `Visite` | compte, commercial, début, durée, résultat, prochaine action, date de relance, note, tournée |
| `Echange` | compte, date, canal (appel, e-mail, salon, autre), résumé |
| `Devis` | compte, date, montant HT, statut (en cours, accepté, refusé), objet |
| `Commande` | compte, date, montant HT, devis d'origine |
| `Tournee` | commercial, date, heure de départ, durée de RDV par défaut, étapes ordonnées (compte, durée spécifique, visite liée) |
| `Parametres` | réglages de calcul et seuils |

Valeurs **calculées, jamais saisies** (`domain/derive.ts`) :

- **Statut couleur** : client actif ; client à risque (aucune visite depuis plus de 120 jours, ou CA des 6 derniers mois en baisse de plus de 30 % par rapport aux 6 précédents, évalué seulement si ce CA de référence atteint 3 000 €) ; prospect chaud (score ≥ 60 ou étape « rendez-vous obtenu » / « devis envoyé ») ; prospect froid. Un prospect gagné s'affiche comme client actif.
- **Compte important** : case cochée ou CA 12 mois ≥ 40 000 €.
- **Dernière activité d'un prospect** : visite, échange ou changement d'étape le plus récent.

Tous les seuils se règlent dans *Paramètres*.

### Indicateurs

| Indicateur | Définition |
|---|---|
| Visites par semaine | visites sur la période ÷ nombre de semaines |
| Km parcourus | somme, par journée de visites, du circuit domicile → visites dans l'ordre horaire → domicile (estimation) |
| Part du temps client | durée des rendez-vous clients ÷ durée totale des rendez-vous (hors trajets) |
| Conversion des prospects | gagnés ÷ (gagnés + perdus), prospects clôturés pendant la période |
| Couverture du portefeuille | clients visités dans les 90 derniers jours ÷ clients du portefeuille, à date |

### Données fictives

`seed/generate.ts` produit un jeu **déterministe** (même graine, même résultat) :

- 4 commerciaux : Ouest (35, 44, 56, 22, 53), Nord (59, 62, 80, 02), Rhône-Alpes (69, 01, 38, 42), Sud-Ouest (33, 24, 47, 40).
- 250 clients et 150 prospects placés dans de **vraies communes** de plus de 2 000 habitants, à proximité du centre de la commune (léger décalage pour éviter les superpositions).
- 12 mois d'historique simulés jour par jour : journées terrain réalistes (comptes proches regroupés, ordre de passage optimisé), congés d'été et de fin d'année, visites, devis, commandes, échanges.
- Noms d'entreprises et de contacts inventés. Montants et numéros de téléphone fictifs.

Source des communes : centres géographiques issus de l'API Découpage administratif (`geo.api.gouv.fr`, Etalab) et codes postaux issus du paquet `@etalab/decoupage-administratif`, extraits une fois et figés dans `seed/communes.json`. L'application ne fait aucun appel à ces services.

## Optimisation de tournée : fonctionnement et limites

### Fonctionnement actuel

1. **Distances** : formule de Haversine (vol d'oiseau) × coefficient routier (1,3 par défaut).
2. **Temps** : distance ÷ vitesse moyenne (60 km/h par défaut).
3. **Ordre** : plus proche voisin depuis le domicile, puis amélioration 2-opt sur le circuit fermé (retour au domicile).
4. **Horaires** : départ + trajets + durées de rendez-vous, avec une pause déjeuner insérée à la première arrivée après l'heure de début de pause.
5. **Suggestions** : comptes à moins de X km (vol d'oiseau) du tracé, classés par un score transparent : ancienneté de la dernière visite (jusqu'à 40 points), devis en cours (30), potentiel (jusqu'à 25), client à risque ou prospect chaud (10). Le détour estimé est calculé par insertion au meilleur endroit du circuit.

### Limites à connaître

- **Pas de réseau routier** : le coefficient 1,3 est une moyenne. Il sous-estime les trajets en zone de relief, autour des estuaires ou avec peu de ponts (par exemple traverser la Loire ou la Gironde), et surestime parfois sur autoroute.
- **Vitesse constante** : ni trafic, ni heures de pointe, ni différence ville / autoroute.
- **Pas de contraintes horaires** : l'optimisation ne tient pas compte des créneaux de rendez-vous imposés par les clients ni de leurs horaires d'ouverture. Elle minimise les kilomètres, pas les retards.
- **Heuristique, pas optimum garanti** : plus proche voisin + 2-opt donne en général de bons résultats sur 5 à 15 étapes, sans garantie d'optimalité.
- **Une seule journée** : pas de tournée sur plusieurs jours avec nuit sur place.
- **Positions approximatives** : les comptes sont placés près du centre de leur commune, pas à leur adresse exacte. Les prospects créés dans l'application sont placés au centre de la commune choisie.
- **Tracé** : la carte relie les étapes par des segments droits, ce n'est pas l'itinéraire réel.

### Passer à une vraie API d'itinéraire

Le calcul est isolé dans `src/routing/`. Les écrans n'utilisent que :

- `getRoutingProvider().matrix(points)` : matrice des distances et temps ;
- `getRoutingProvider().geometry(points)` : tracé pour la carte ;
- `optimizeTour(...)`, `computeSchedule(...)`, qui travaillent sur la matrice.

Pour brancher un service réel :

1. Créer une classe qui implémente `RoutingProvider` (`src/routing/types.ts`) :
   - `matrix()` appelle le service de matrice de distances (temps et km routiers) ;
   - `geometry()` appelle le service d'itinéraire et renvoie la polyligne ;
   - `isEstimate = false` pour retirer la mention « estimations » des écrans.
2. L'enregistrer dans `src/routing/index.ts` (`setRoutingProvider`).
3. Facultatif : remplacer l'optimiseur local par le service d'optimisation de tournée du fournisseur, s'il en propose un (utile pour gérer des créneaux horaires).

Pistes à étudier (non testées dans ce prototype, conditions et tarifs à vérifier) : un serveur OSRM ou GraphHopper hébergé en interne sur les données OpenStreetMap France, ou une API commerciale de calcul d'itinéraire. Points d'attention : coût par requête de matrice, quotas, conditions d'usage, appel depuis un serveur pour ne pas exposer de clé dans le navigateur.

Les kilomètres des journées passées (indicateurs) restent calculés localement par `estimateCircuitKm` : appeler une API pour des milliers de journées historiques n'aurait pas de sens. À terme, ils devraient venir des relevés réels (notes de frais, télématique).

## Brancher un CRM

`src/services/DataService.ts` définit le contrat d'accès aux données (chargement, enregistrement d'un compte, d'une visite, d'un échange, d'un devis, d'une tournée, des paramètres). Pour un CRM :

1. écrire une implémentation (par exemple `CrmDataService`) qui appelle l'API du CRM, idéalement via un petit serveur intermédiaire ;
2. la déclarer dans `src/services/index.ts`.

Le chargement complet en mémoire au démarrage convient au volume du prototype (400 comptes, environ 2 000 visites). Avec un vrai portefeuille, il faudra charger par commercial et paginer l'historique.

## Autres limites du prototype

- Données dans le `localStorage` du navigateur : propres à un poste et un navigateur, perdues si le cache est vidé, pas de synchronisation entre ordinateur et mobile.
- Pas de mode hors ligne : en zone blanche, la carte ne se charge pas (les écrans sans carte fonctionnent une fois l'application ouverte).
- Fond de carte : serveurs de tuiles publics d'OpenStreetMap, soumis à une politique d'usage qui ne convient pas à une application de production avec de nombreux utilisateurs. Prévoir un fournisseur de tuiles ou un serveur dédié.
- Pas d'authentification ni de droits : le sélecteur de profil sert à la démonstration.
- Mode clair uniquement, choisi pour la lisibilité en extérieur.
