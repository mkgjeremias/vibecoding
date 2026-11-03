import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountMarkers, BaseMap, Legend, type MapPoint } from '../../components/AccountsMap';
import { Button } from '../../components/ui';
import { fmtDateCourte, fmtNombre } from '../../lib/format';
import { useData } from '../../state/DataContext';
import { useProfil } from '../../state/ProfilContext';
import { CompteFiche } from '../comptes/CompteFiche';
import { useTourneeActions } from '../tournee/useTourneeActions';
import { appliquerFiltres, FILTRES_DEFAUT, FiltresPanel, type Filtres } from './filters';

export default function CartePage() {
  const { data, derived } = useData();
  const { commercial, isManager } = useProfil();
  const navigate = useNavigate();
  const [f, setF] = useState<Filtres>(FILTRES_DEFAUT);
  const [selected, setSelected] = useState<string | null>(null);
  const [showFiltres, setShowFiltres] = useState(false);
  const tournee = useTourneeActions();

  const scope = useMemo(
    () => [...derived.infos.values()].filter((i) => isManager || i.compte.commercialId === commercial?.id),
    [derived, isManager, commercial],
  );
  const visibles = useMemo(() => appliquerFiltres(scope, f), [scope, f]);
  const points: MapPoint[] = visibles.map((i) => ({
    id: i.compte.id,
    lat: i.compte.lat,
    lng: i.compte.lng,
    label: `${i.compte.raisonSociale} · ${i.compte.commune}`,
    statut: i.statut,
    important: i.important,
    selected: i.compte.id === selected,
  }));
  const fitKey = `${isManager ? 'all' : commercial?.id}-${f.secteurId}`;

  const actionsFiche = selected && tournee.actif && (
    <>
      {tournee.contient(selected) ? (
        <Button variant="secondary" onClick={() => tournee.retirer(selected)}>
          Retirer de la tournée du {fmtDateCourte(tournee.datePlanif)}
        </Button>
      ) : (
        <Button onClick={() => tournee.ajouter(selected)}>Ajouter à la tournée du {fmtDateCourte(tournee.datePlanif)}</Button>
      )}
      {tournee.tournee && tournee.tournee.etapes.length > 0 && (
        <Button variant="ghost" onClick={() => navigate('/planifier')}>
          Voir la tournée ({tournee.tournee.etapes.length})
        </Button>
      )}
    </>
  );

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Filtres : panneau latéral sur ordinateur, volet sur mobile */}
      <aside
        className={`${showFiltres ? 'block' : 'hidden'} max-h-[60vh] overflow-y-auto border-b border-slate-200 bg-white p-3 md:block md:max-h-none md:w-80 md:shrink-0 md:border-b-0 md:border-r`}
      >
        <FiltresPanel f={f} setF={setF} secteurs={isManager ? data.secteurs : undefined} />
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setF(FILTRES_DEFAUT)}>
          Réinitialiser les filtres
        </Button>
      </aside>

      <div className="relative min-h-0 flex-1">
        <div className="absolute left-14 right-2 top-2 z-[500] flex items-center justify-between gap-2 md:right-auto">
          <span className="rounded-lg bg-white/95 px-3 py-2 text-sm font-semibold shadow">
            {fmtNombre(visibles.length)} compte{visibles.length > 1 ? 's' : ''} affiché{visibles.length > 1 ? 's' : ''}
          </span>
          <Button size="sm" variant="secondary" className="md:hidden" onClick={() => setShowFiltres((s) => !s)}>
            {showFiltres ? 'Masquer les filtres' : 'Filtres'}
          </Button>
        </div>
        <BaseMap fitPoints={points} fitKey={fitKey}>
          <AccountMarkers points={points} onSelect={setSelected} />
        </BaseMap>
        <div className="absolute bottom-7 left-2 z-[500] hidden rounded-lg bg-white/95 px-3 py-2 shadow md:block">
          <Legend />
        </div>
      </div>

      {selected && (
        <aside className="fixed inset-x-0 bottom-16 z-[1100] max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-slate-300 bg-white p-4 shadow-2xl md:static md:z-auto md:max-h-none md:w-96 md:shrink-0 md:rounded-none md:border-l md:border-t-0 md:shadow-none">
          <CompteFiche compteId={selected} onClose={() => setSelected(null)} actions={actionsFiche} />
        </aside>
      )}
    </div>
  );
}
