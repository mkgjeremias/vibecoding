import { useEffect, useMemo, useState } from 'react';
import type { Commercial, Compte, Tournee } from '../../domain/types';
import { useData } from '../../state/DataContext';
import { calculerTournee, type TourneeCalculee } from './tourneeUtils';

/** Calcul asynchrone (compatible avec une future API d'itinéraire) des horaires d'une tournée. */
export function useTourneeCalc(t: Tournee | undefined, commercial: Commercial | undefined) {
  const { data } = useData();
  const comptesById = useMemo(() => new Map<string, Compte>(data.comptes.map((c) => [c.id, c])), [data.comptes]);
  const [calc, setCalc] = useState<TourneeCalculee | null>(null);
  const key = t ? JSON.stringify([t.etapes.map((e) => [e.compteId, e.dureeMin]), t.heureDepart, t.dureeRdvMin]) : '';
  const p = data.parametres;

  useEffect(() => {
    if (!t || !commercial) {
      setCalc(null);
      return;
    }
    let alive = true;
    calculerTournee(t, commercial, comptesById, p).then((r) => alive && setCalc(r));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, commercial?.id, p]);

  return calc;
}
