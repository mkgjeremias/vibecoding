import type { Parametres } from '../domain/types';

export const PARAMETRES_DEFAUT: Parametres = {
  coefRoutier: 1.3,
  vitesseMoyenneKmh: 60,
  dureeRdvMin: 60,
  heureDepart: '08:00',
  pauseDejeuner: { active: true, debut: '12:00', dureeMin: 60 },
  heureLimiteRetour: '18:30',
  rayonSuggestionKm: 10,
  seuilActifJours: 90,
  seuilRisqueJours: 120,
  seuilBaisseCA: 0.3,
  seuilScoreChaud: 60,
  seuilCAImportant: 40000,
  seuilProspectInactifJours: 30,
  couvertureJours: 90,
};
