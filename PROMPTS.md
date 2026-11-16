# Historique des prompts

## 2026-11-16

crée le fichier d'instructions de ce projeT. (CLAUDE.md) avec ces règles :
1. appuie-toi sur SPEC.md pour toutes tes décisions
2. uniquement HTML, CSS et Javascriptn sans framework et sans rien installer
A chaque demande, ajoute mon prompt à la fin de PROMPTS.md, avec la date

## 2026-11-16

on peut assouplir les règles

## 2026-11-16

oui (commit et push de CLAUDE.md et PROMPTS.md)

## 2026-11-16

comment je fais pour changer de place mon dossier de base

## 2026-11-16

Brief d'itération (collé) : recentrer l'outil sur l'optimisation de tournées et le rendre démontrable.
- À modifier : A. données de démo (12 commerciaux, toute la France, secteur rural Limousin/Creuse, secteur urbain dense, ~60 clients + 40 prospects chacun, 12 mois d'historique) ; B. heure proposée par étape, durée de visite par étape, marge trajet en % (15 %), temps libre/jour (1 h), recalcul après déplacement ; C. tournées sur plusieurs jours (découpage proposé si visite à > 2 h aller ou retour trop tard, accepté/refusé, nuit dans la commune de la dernière visite) ; D. créneau prospection en fin de journée avec suggestions ; E. mobile jour par jour, compte-rendu inchangé.
- À retirer : écran Prospection (pipeline), écran Indicateurs ; vue manager réduite (tournées prévues + nb visites).
- Contraintes : pas de géolocalisation, pas de nouvelle dépendance, aucun appel réseau sauf tuiles ; tests à compléter (optimiseur, géométrie, planning, données, multi-jours, marges).
- Limites connues : estuaires (Loire, Gironde) à signaler en multi-jours ; pas de hors-ligne, CRM, auth.

## 2026-11-16

recupere tous les elements depuis GIT

## 2026-11-16

Brief d'itération renvoyé (identique au précédent) : lancement de l'implémentation.

## 2026-11-16

fais quelque chose de simple alors, remplace node.js

## 2026-11-16

oui et me faire voir le rendu, comment je fais ?

## 2026-11-16

pourquoi je ne vois pas le fond de la cart e?

## 2026-11-16

(capture d'écran) voici ce que je vois : tuiles « Access blocked » 403 d'OpenStreetMap

## 2026-11-16

est-ce que je peux partager la page à Claude pour travailler sur le fond et te donner des directions plus claires

## 2026-11-16

oui (publier la page sur claude.ai, commit et push de la correction du fond de carte)

## 2026-11-16

modification

## 2026-11-16

Brief d'itération (collé) : parcours simple et guidé pour le commercial (Préparer en 3 étapes : Où aller ? / Qui voir ? / Caler les rendez-vous ; Ma tournée), tableau de Pilotage pour la direction. 11 secteurs (AA, AB, AC, AE, FB, FC partagé entre 2 commerciaux, BA, BB, CA, CB, CD) ; activités des comptes (fumisterie individuelle, fumisterie tertiaire, ventilation, industrie) ; fréquence de visite par potentiel (A 6 sem., B 3 mois, C 6 mois) et comptes « à voir » ; raisons en clair, score masqué ; suppression des écrans Carte et Équipe ; tests à jour (secteurs, fréquence, priorisation, optimiseur, multi-jours, pilotage).

## 2026-11-16

ajoute cette modification : 11 commerciaux itinérants, un par secteur ; FC découpage provisoire très étendu (1 commercial), cas de démonstration des tournées sur plusieurs jours ; les 2 commerciaux sédentaires ne sont pas concernés.

## 2026-11-16

commit

## 2026-11-16

oui (push sur GitHub)
