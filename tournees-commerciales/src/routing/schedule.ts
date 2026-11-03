import type { CostMatrix } from './types';

export interface ScheduleStopInput {
  /** Index du point dans la matrice (le dépôt est 0). */
  index: number;
  dureeMin: number;
}

export interface ScheduleParams {
  departMin: number; // minutes depuis minuit
  pause?: { debutMin: number; dureeMin: number };
}

export interface ScheduledStop {
  index: number;
  legKm: number;
  legMin: number;
  arriveeMin: number;
  /** Pause déjeuner prise juste avant ce rendez-vous. */
  pauseAvantMin: number;
  debutRdvMin: number;
  finRdvMin: number;
}

export interface Schedule {
  stops: ScheduledStop[];
  retour: { legKm: number; legMin: number; arriveeMin: number };
  totalKm: number;
  totalRouteMin: number;
  totalRdvMin: number;
}

/**
 * Calcule les horaires d'un circuit dans l'ordre donné.
 * Règle de pause : dès que l'horloge atteint le début de la pause (à l'arrivée chez un client),
 * la pause est prise avant le rendez-vous. Une seule pause par jour.
 */
export function computeSchedule(m: CostMatrix, stops: ScheduleStopInput[], p: ScheduleParams): Schedule {
  let clock = p.departMin;
  let prev = 0;
  let pauseTaken = !p.pause;
  let totalKm = 0;
  let totalRouteMin = 0;
  let totalRdvMin = 0;
  const out: ScheduledStop[] = [];

  for (const s of stops) {
    const legKm = m.km[prev][s.index];
    const legMin = m.minutes[prev][s.index];
    clock += legMin;
    const arrivee = clock;
    let pauseAvant = 0;
    if (!pauseTaken && p.pause && clock >= p.pause.debutMin) {
      pauseAvant = p.pause.dureeMin;
      clock += pauseAvant;
      pauseTaken = true;
    }
    const debut = clock;
    clock += s.dureeMin;
    out.push({
      index: s.index,
      legKm,
      legMin,
      arriveeMin: arrivee,
      pauseAvantMin: pauseAvant,
      debutRdvMin: debut,
      finRdvMin: clock,
    });
    totalKm += legKm;
    totalRouteMin += legMin;
    totalRdvMin += s.dureeMin;
    prev = s.index;
  }
  const retourKm = stops.length ? m.km[prev][0] : 0;
  const retourMin = stops.length ? m.minutes[prev][0] : 0;
  clock += retourMin;
  totalKm += retourKm;
  totalRouteMin += retourMin;

  return {
    stops: out,
    retour: { legKm: retourKm, legMin: retourMin, arriveeMin: clock },
    totalKm,
    totalRouteMin,
    totalRdvMin,
  };
}
