import { addDays, getDay } from 'date-fns';
import type { Commercial, Compte, Parametres, Tournee } from '../../domain/types';
import { hhmmToMin, isoDateTime, isoDay } from '../../lib/format';
import { computeSchedule, getRoutingProvider, type Schedule } from '../../routing';

export function prochainJourOuvre(from: Date = new Date()): Date {
  let d = addDays(from, 1);
  while (getDay(d) === 0 || getDay(d) === 6) d = addDays(d, 1);
  return d;
}

export function nouvelleTournee(commercialId: string, date: string, p: Parametres): Tournee {
  const now = isoDateTime(new Date());
  return {
    id: `t_${commercialId}_${date}`,
    commercialId,
    date,
    heureDepart: p.heureDepart,
    dureeRdvMin: p.dureeRdvMin,
    etapes: [],
    creeLe: now,
    modifieeLe: now,
  };
}

export function trouverTournee(tournees: Tournee[], commercialId: string, date: string) {
  return tournees.find((t) => t.commercialId === commercialId && t.date === date);
}

export const tourneeDuJour = (tournees: Tournee[], commercialId: string) =>
  trouverTournee(tournees, commercialId, isoDay(new Date()));

export interface TourneeCalculee {
  schedule: Schedule;
  comptes: Compte[];
}

/** Horaires et distances d'une tournée dans l'ordre actuel de ses étapes. */
export async function calculerTournee(
  t: Tournee,
  commercial: Commercial,
  comptesById: Map<string, Compte>,
  p: Parametres,
): Promise<TourneeCalculee> {
  const comptes = t.etapes.map((e) => comptesById.get(e.compteId)).filter(Boolean) as Compte[];
  const m = await getRoutingProvider().matrix([commercial.domicile, ...comptes]);
  const schedule = computeSchedule(
    m,
    t.etapes.map((e, i) => ({ index: i + 1, dureeMin: e.dureeMin ?? t.dureeRdvMin })),
    {
      departMin: hhmmToMin(t.heureDepart),
      pause: p.pauseDejeuner.active
        ? { debutMin: hhmmToMin(p.pauseDejeuner.debut), dureeMin: p.pauseDejeuner.dureeMin }
        : undefined,
    },
  );
  return { schedule, comptes };
}
