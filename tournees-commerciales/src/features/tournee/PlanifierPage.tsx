import { useMemo, useState } from 'react';
import type { MapPoint } from '../../components/AccountsMap';
import { IconHome, IconPlus } from '../../components/icons';
import { Badge, Button, Card, Empty, EstimationNote, inputCls, StatutBadge } from '../../components/ui';
import type { EtapeTournee, Tournee } from '../../domain/types';
import { fmtDateLongue, fmtDuree, fmtHeureMin, fmtKm, hhmmToMin, isoDateTime } from '../../lib/format';
import { estimateCircuitKm, optimizeTour } from '../../routing';
import { useData } from '../../state/DataContext';
import { useProfil } from '../../state/ProfilContext';
import { appliquerFiltres, FILTRES_DEFAUT } from '../carte/filters';
import { CompteFiche } from '../comptes/CompteFiche';
import { suggerer } from '../suggestions/suggestions';
import { StopList } from './StopList';
import { TourMap } from './TourMap';
import { nouvelleTournee, trouverTournee } from './tourneeUtils';
import { useTourneeCalc } from './useTourneeCalc';

type Onglet = 'tournee' | 'carte' | 'ajouter';
type OngletDroit = 'suggestions' | 'comptes' | 'fiche';

export default function PlanifierPage() {
  const { data, derived, saveTournee, deleteTournee } = useData();
  const { commercial, datePlanif, setDatePlanif } = useProfil();
  const [onglet, setOnglet] = useState<Onglet>('tournee');
  const [droit, setDroit] = useState<OngletDroit>('suggestions');
  const [selected, setSelected] = useState<string | null>(null);
  const [rayon, setRayon] = useState(data.parametres.rayonSuggestionKm);
  const [recherche, setRecherche] = useState('');
  const [afficherTous, setAfficherTous] = useState(true);
  const [optimisation, setOptimisation] = useState<string | null>(null);
  const [confirmSuppr, setConfirmSuppr] = useState(false);

  const existante = commercial ? trouverTournee(data.tournees, commercial.id, datePlanif) : undefined;
  const tournee: Tournee | undefined = commercial ? (existante ?? nouvelleTournee(commercial.id, datePlanif, data.parametres)) : undefined;
  const calc = useTourneeCalc(tournee, commercial);

  const scope = useMemo(
    () => [...derived.infos.values()].filter((i) => i.compte.commercialId === commercial?.id),
    [derived, commercial],
  );
  const dansTournee = useMemo(() => new Set(tournee?.etapes.map((e) => e.compteId)), [tournee]);

  const suggestions = useMemo(() => {
    if (!commercial || !calc || calc.comptes.length === 0) return [];
    return suggerer({
      route: [commercial.domicile, ...calc.comptes, commercial.domicile],
      candidats: scope,
      exclus: dansTournee,
      rayonKm: rayon,
      today: derived.today,
    });
  }, [commercial, calc, scope, dansTournee, rayon, derived.today]);

  const listeComptes = useMemo(
    () =>
      appliquerFiltres(scope, { ...FILTRES_DEFAUT, recherche })
        .filter((i) => !dansTournee.has(i.compte.id))
        .sort((a, b) => a.compte.raisonSociale.localeCompare(b.compte.raisonSociale, 'fr'))
        .slice(0, 80),
    [scope, recherche, dansTournee],
  );

  if (!commercial || !tournee) {
    return (
      <div className="p-6">
        <Empty>La planification se fait depuis le profil d'un commercial. Choisis un commercial dans le sélecteur en haut.</Empty>
      </div>
    );
  }

  const save = (patch: Partial<Tournee>) => saveTournee({ ...tournee, ...patch, modifieeLe: isoDateTime(new Date()) });
  const setEtapes = (etapes: EtapeTournee[]) => save({ etapes });
  const ajouter = (id: string) => !dansTournee.has(id) && setEtapes([...tournee.etapes, { compteId: id }]);

  const optimiser = async () => {
    if (tournee.etapes.length < 2) return;
    const avant = calc?.schedule.totalKm;
    const comptes = tournee.etapes.map((e) => derived.infos.get(e.compteId)!.compte);
    const { order } = await optimizeTour(commercial.domicile, comptes);
    const nouvelles = order.map((i) => tournee.etapes[i]);
    await setEtapes(nouvelles);
    // calcul du gain affiché à l'utilisateur
    const pts = [commercial.domicile, ...nouvelles.map((e) => derived.infos.get(e.compteId)!.compte), commercial.domicile];
    const apres = estimateCircuitKm(pts);
    setOptimisation(
      avant !== undefined && avant - apres > 0.5
        ? `Ordre optimisé : ${fmtKm(apres)} au lieu de ${fmtKm(avant)} (−${fmtKm(avant - apres)}).`
        : `Ordre optimisé : ${fmtKm(apres)}. L'ordre actuel était déjà le meilleur trouvé.`,
    );
  };

  const s = calc?.schedule;
  const limite = hhmmToMin(data.parametres.heureLimiteRetour);
  const retourTardif = s && tournee.etapes.length > 0 && s.retour.arriveeMin > limite;

  const autresPoints: MapPoint[] = afficherTous
    ? scope
        .filter((i) => !dansTournee.has(i.compte.id))
        .map((i) => ({
          id: i.compte.id,
          lat: i.compte.lat,
          lng: i.compte.lng,
          label: `${i.compte.raisonSociale} · ${i.compte.commune} (clic pour voir)`,
          statut: i.statut,
          important: i.important,
          selected: i.compte.id === selected,
          dimmed: true,
        }))
    : [];

  const select = (id: string) => {
    setSelected(id);
    setDroit('fiche');
  };

  const tabCls = (o: Onglet) =>
    `flex-1 min-h-12 font-semibold border-b-4 ${onglet === o ? 'border-marine-700 text-marine-800' : 'border-transparent text-slate-600'}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-slate-200 bg-white md:hidden" role="tablist">
        <button className={tabCls('tournee')} onClick={() => setOnglet('tournee')}>
          Tournée ({tournee.etapes.length})
        </button>
        <button className={tabCls('carte')} onClick={() => setOnglet('carte')}>
          Carte
        </button>
        <button className={tabCls('ajouter')} onClick={() => setOnglet('ajouter')}>
          Ajouter
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Colonne tournée */}
        <section className={`${onglet === 'tournee' ? 'flex' : 'hidden'} w-full flex-col overflow-y-auto bg-slate-50 p-3 md:flex md:w-[26rem] md:shrink-0 md:border-r md:border-slate-200`}>
          <h1 className="text-xl font-bold text-marine-900">Préparer une tournée</h1>
          <p className="mb-3 text-sm text-slate-600 first-letter:uppercase">{fmtDateLongue(datePlanif)}</p>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-bold text-slate-700">Date</span>
              <input type="date" className={inputCls} value={datePlanif} onChange={(e) => e.target.value && setDatePlanif(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">Départ</span>
              <input type="time" className={inputCls} value={tournee.heureDepart} onChange={(e) => save({ heureDepart: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">RDV par défaut</span>
              <select className={inputCls} value={tournee.dureeRdvMin} onChange={(e) => save({ dureeRdvMin: Number(e.target.value) })}>
                {[30, 45, 60, 75, 90, 120].map((d) => (
                  <option key={d} value={d}>
                    {fmtDuree(d)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <Button onClick={optimiser} disabled={tournee.etapes.length < 2}>
              Optimiser l'ordre
            </Button>
            {existante &&
              (confirmSuppr ? (
                <>
                  <Button
                    variant="danger"
                    onClick={() => {
                      deleteTournee(existante.id);
                      setConfirmSuppr(false);
                      setOptimisation(null);
                    }}
                  >
                    Confirmer la suppression
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmSuppr(false)}>
                    Annuler
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmSuppr(true)}>
                  Supprimer
                </Button>
              ))}
          </div>
          {optimisation && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{optimisation}</p>}

          {tournee.etapes.length > 0 && s && (
            <Card className="mb-3 grid grid-cols-3 gap-2 p-3 text-center">
              <div>
                <div className="text-xs text-slate-600">Distance</div>
                <div className="text-lg font-bold">≈ {fmtKm(s.totalKm)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-600">Route</div>
                <div className="text-lg font-bold">≈ {fmtDuree(s.totalRouteMin)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-600">Retour</div>
                <div className={`text-lg font-bold ${retourTardif ? 'text-red-700' : ''}`}>≈ {fmtHeureMin(s.retour.arriveeMin)}</div>
              </div>
            </Card>
          )}
          {retourTardif && (
            <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              Retour estimé après {data.parametres.heureLimiteRetour.replace(':', 'h')}. Retire une étape ou raccourcis des rendez-vous.
            </p>
          )}

          <div className="mb-2 flex items-center gap-2 rounded-lg bg-white p-2 text-sm">
            <IconHome className="text-amber-600" />
            <span>
              Départ {tournee.heureDepart.replace(':', 'h')} · {commercial.domicile.commune}
            </span>
          </div>
          {tournee.etapes.length === 0 ? (
            <Empty>Ajoute des comptes depuis la liste, les suggestions ou la carte.</Empty>
          ) : (
            <StopList
              etapes={tournee.etapes}
              infos={derived.infos}
              stops={s?.stops}
              dureeDefaut={tournee.dureeRdvMin}
              onChange={setEtapes}
              onSelect={select}
            />
          )}
          {tournee.etapes.length > 0 && s && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-white p-2 text-sm">
              <IconHome className="text-amber-600" />
              <span>
                Retour ≈ {fmtHeureMin(s.retour.arriveeMin)} · trajet {fmtKm(s.retour.legKm)}
              </span>
            </div>
          )}
          <EstimationNote className="mt-3" />
          <p className="mt-2 text-xs text-slate-600">Glisse les étapes par la poignée pour changer l'ordre. Les horaires se recalculent sans réoptimiser.</p>
        </section>

        {/* Carte */}
        <section className={`${onglet === 'carte' ? 'block' : 'hidden'} relative min-h-0 flex-1 md:block`}>
          <TourMap
            domicile={{ ...commercial.domicile, label: commercial.domicile.commune }}
            etapes={calc?.comptes ?? []}
            autres={autresPoints}
            extraFit={tournee.etapes.length === 0 ? scope.map((i) => i.compte) : []}
            onSelect={select}
          />
          <label className="absolute right-2 top-2 z-[500] flex min-h-10 items-center gap-2 rounded-lg bg-white/95 px-3 text-sm font-semibold shadow">
            <input type="checkbox" className="h-5 w-5" checked={afficherTous} onChange={(e) => setAfficherTous(e.target.checked)} />
            Autres comptes
          </label>
        </section>

        {/* Ajout : suggestions, liste, fiche */}
        <section className={`${onglet === 'ajouter' ? 'flex' : 'hidden'} w-full flex-col bg-white md:flex md:w-96 md:shrink-0 md:border-l md:border-slate-200`}>
          <div className="flex border-b border-slate-200">
            {(['suggestions', 'comptes', 'fiche'] as OngletDroit[]).map((o) => (
              <button
                key={o}
                onClick={() => setDroit(o)}
                disabled={o === 'fiche' && !selected}
                className={`min-h-12 flex-1 border-b-4 text-sm font-semibold disabled:opacity-40 ${droit === o ? 'border-marine-700 text-marine-800' : 'border-transparent text-slate-600'}`}
              >
                {o === 'suggestions' ? `Suggestions (${suggestions.length})` : o === 'comptes' ? 'Comptes' : 'Fiche'}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {droit === 'suggestions' && (
              <>
                <label className="mb-2 flex items-center gap-2 text-sm">
                  <span className="font-semibold">À moins de</span>
                  <input type="number" min={1} max={100} className={`${inputCls} !w-20`} value={rayon} onChange={(e) => setRayon(Number(e.target.value) || 1)} />
                  <span className="font-semibold">km du trajet</span>
                </label>
                <p className="mb-3 text-xs text-slate-600">
                  Classement : ancienneté de la dernière visite, devis en cours, potentiel, statut. Distance au trajet à vol d'oiseau, détour estimé.
                </p>
                {tournee.etapes.length === 0 ? (
                  <Empty>Ajoute au moins une étape pour obtenir des suggestions le long du trajet.</Empty>
                ) : suggestions.length === 0 ? (
                  <Empty>Aucun compte à moins de {rayon} km du trajet.</Empty>
                ) : (
                  <ul className="space-y-2">
                    {suggestions.map((sg) => (
                      <li key={sg.info.compte.id} className="rounded-lg border border-slate-200 p-2">
                        <div className="flex items-start gap-2">
                          <button className="min-w-0 flex-1 text-left" onClick={() => select(sg.info.compte.id)}>
                            <div className="truncate font-semibold">{sg.info.compte.raisonSociale}</div>
                            <div className="text-sm text-slate-600">
                              {sg.info.compte.commune} · {fmtKm(sg.distanceTraceKm)} du trajet · détour ≈ {fmtKm(sg.detourKm)}
                            </div>
                          </button>
                          <Button size="sm" onClick={() => ajouter(sg.info.compte.id)} aria-label={`Ajouter ${sg.info.compte.raisonSociale}`}>
                            <IconPlus width={18} height={18} />
                          </Button>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge tone="blue">Priorité {sg.score}</Badge>
                          <StatutBadge statut={sg.info.statut} />
                          {sg.motifs.map((m) => (
                            <Badge key={m} tone={m.startsWith('Devis') ? 'amber' : 'slate'}>
                              {m}
                            </Badge>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {droit === 'comptes' && (
              <>
                <input type="search" className={`${inputCls} mb-2`} placeholder="Rechercher un compte, une commune…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
                <ul className="divide-y divide-slate-100">
                  {listeComptes.map((i) => (
                    <li key={i.compte.id} className="flex items-center gap-2 py-2">
                      <button className="min-w-0 flex-1 text-left" onClick={() => select(i.compte.id)}>
                        <div className="truncate font-semibold">{i.compte.raisonSociale}</div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="truncate">{i.compte.commune}</span>
                          <StatutBadge statut={i.statut} />
                        </div>
                      </button>
                      <Button size="sm" variant="secondary" onClick={() => ajouter(i.compte.id)} aria-label={`Ajouter ${i.compte.raisonSociale}`}>
                        <IconPlus width={18} height={18} />
                      </Button>
                    </li>
                  ))}
                </ul>
                {listeComptes.length === 80 && <p className="mt-2 text-xs text-slate-600">80 premiers résultats. Affine la recherche.</p>}
              </>
            )}
            {droit === 'fiche' && selected && (
              <CompteFiche
                compteId={selected}
                onClose={() => {
                  setSelected(null);
                  setDroit('suggestions');
                }}
                actions={
                  dansTournee.has(selected) ? (
                    <Button variant="secondary" onClick={() => setEtapes(tournee.etapes.filter((e) => e.compteId !== selected))}>
                      Retirer de la tournée
                    </Button>
                  ) : (
                    <Button onClick={() => ajouter(selected)}>Ajouter à la tournée</Button>
                  )
                }
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
