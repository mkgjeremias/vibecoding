import { isoDateTime } from '../../lib/format';
import { useData } from '../../state/DataContext';
import { useProfil } from '../../state/ProfilContext';
import { nouvelleTournee, trouverTournee } from './tourneeUtils';

/** Actions sur la tournée en préparation (date choisie dans l'écran Planifier). */
export function useTourneeActions() {
  const { data, saveTournee } = useData();
  const { commercial, datePlanif } = useProfil();

  const tournee = commercial ? trouverTournee(data.tournees, commercial.id, datePlanif) : undefined;
  const contient = (compteId: string) => !!tournee?.etapes.some((e) => e.compteId === compteId);

  const ajouter = async (compteId: string) => {
    if (!commercial) return;
    const t = tournee ?? nouvelleTournee(commercial.id, datePlanif, data.parametres);
    if (t.etapes.some((e) => e.compteId === compteId)) return;
    await saveTournee({ ...t, etapes: [...t.etapes, { compteId }], modifieeLe: isoDateTime(new Date()) });
  };

  const retirer = async (compteId: string) => {
    if (!tournee) return;
    await saveTournee({ ...tournee, etapes: tournee.etapes.filter((e) => e.compteId !== compteId), modifieeLe: isoDateTime(new Date()) });
  };

  return { tournee, datePlanif, contient, ajouter, retirer, actif: !!commercial };
}
