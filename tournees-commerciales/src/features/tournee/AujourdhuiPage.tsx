import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { IconCheck, IconNav, IconPhone } from '../../components/icons';
import { Button, Card, Empty, EstimationNote, StatutBadge } from '../../components/ui';
import { RESULTAT_LABEL } from '../../domain/labels';
import { fmtDateLongue, fmtDuree, fmtHeureMin, fmtKm, isoDay } from '../../lib/format';
import { useData } from '../../state/DataContext';
import { useProfil } from '../../state/ProfilContext';
import { TourMap } from './TourMap';
import { tourneeDuJour } from './tourneeUtils';
import { useTourneeCalc } from './useTourneeCalc';

/** Lien d'itinéraire ouvert dans l'application de navigation du téléphone. */
const lienItineraire = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export default function AujourdhuiPage() {
  const { data, derived } = useData();
  const { commercial, setDatePlanif } = useProfil();
  const navigate = useNavigate();
  const location = useLocation();
  const [carte, setCarte] = useState(false);
  const flash = (location.state as { flash?: string } | null)?.flash;
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => navigate('.', { replace: true, state: null }), 4000);
    return () => clearTimeout(t);
  }, [flash, navigate]);

  const tournee = commercial ? tourneeDuJour(data.tournees, commercial.id) : undefined;
  const calc = useTourneeCalc(tournee, commercial);
  const visitesById = useMemo(() => new Map(data.visites.map((v) => [v.id, v])), [data.visites]);

  if (!commercial) {
    return (
      <div className="p-4">
        <Empty>Choisis un commercial dans le sélecteur de profil.</Empty>
      </div>
    );
  }

  if (!tournee || tournee.etapes.length === 0) {
    return (
      <div className="mx-auto max-w-xl p-4">
        <h1 className="mb-1 text-2xl font-bold text-marine-900">Tournée du jour</h1>
        <p className="mb-4 text-slate-700 first-letter:uppercase">{fmtDateLongue(new Date())}</p>
        <Empty>
          Aucune tournée prévue aujourd'hui.
          <br />
          <Button
            className="mt-3"
            onClick={() => {
              setDatePlanif(isoDay(new Date()));
              navigate('/planifier');
            }}
          >
            Préparer la tournée du jour
          </Button>
        </Empty>
      </div>
    );
  }

  const s = calc?.schedule;
  const faits = new Set(tournee.etapes.filter((e) => e.visiteId).map((e) => e.compteId));
  const prochaineIdx = tournee.etapes.findIndex((e) => !e.visiteId);

  return (
    <div className="mx-auto max-w-xl p-3 md:p-6">
      {flash && (
        <p role="status" className="fixed inset-x-3 bottom-20 z-[1200] rounded-lg bg-green-800 px-4 py-3 font-semibold text-white shadow-lg md:bottom-6 md:left-auto md:right-6 md:max-w-sm">
          {flash}
        </p>
      )}
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-marine-900">Tournée du jour</h1>
          <p className="text-slate-700 first-letter:uppercase">{fmtDateLongue(tournee.date)}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">
            {faits.size}/{tournee.etapes.length}
          </div>
          <div className="text-xs text-slate-600">visites faites</div>
        </div>
      </div>

      {s && (
        <Card className="mb-3 grid grid-cols-3 gap-2 p-3 text-center">
          <div>
            <div className="text-xs text-slate-600">Départ</div>
            <div className="text-lg font-bold">{tournee.heureDepart.replace(':', 'h')}</div>
          </div>
          <div>
            <div className="text-xs text-slate-600">Distance</div>
            <div className="text-lg font-bold">≈ {fmtKm(s.totalKm)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-600">Retour</div>
            <div className="text-lg font-bold">≈ {fmtHeureMin(s.retour.arriveeMin)}</div>
          </div>
        </Card>
      )}

      <Button variant="secondary" className="mb-3 w-full" onClick={() => setCarte((c) => !c)}>
        {carte ? 'Masquer la carte' : 'Voir la carte'}
      </Button>
      {carte && calc && (
        <div className="mb-3 h-72 overflow-hidden rounded-xl border border-slate-300">
          <TourMap domicile={commercial.domicile} etapes={calc.comptes} faits={faits} />
        </div>
      )}

      <ol className="space-y-3">
        {tournee.etapes.map((e, i) => {
          const info = derived.infos.get(e.compteId);
          if (!info) return null;
          const c = info.compte;
          const st = s?.stops[i];
          const visite = e.visiteId ? visitesById.get(e.visiteId) : undefined;
          const estProchaine = i === prochaineIdx;
          return (
            <li key={e.compteId}>
              <Card className={`p-3 ${estProchaine ? 'border-2 border-marine-700' : ''} ${visite ? 'bg-green-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${visite ? 'bg-green-700' : 'bg-marine-700'}`}
                  >
                    {visite ? <IconCheck /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    {estProchaine && <div className="text-xs font-bold uppercase tracking-wide text-marine-700">Prochaine étape</div>}
                    <div className="text-lg font-bold leading-tight">{c.raisonSociale}</div>
                    <div className="text-slate-700">
                      {c.adresse}, {c.commune}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      {st && (
                        <span className="font-bold text-marine-800">
                          ≈ {fmtHeureMin(st.debutRdvMin)} · {fmtDuree(e.dureeMin ?? tournee.dureeRdvMin)}
                        </span>
                      )}
                      <StatutBadge statut={info.statut} />
                    </div>
                    {visite && (
                      <div className="mt-1 text-sm font-semibold text-green-800">
                        Compte-rendu : {RESULTAT_LABEL[visite.resultat]}
                        {visite.prochaineAction ? ` · ${visite.prochaineAction}` : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Link
                    to={`/compte-rendu/${c.id}`}
                    className={`col-span-3 flex min-h-14 items-center justify-center rounded-lg text-lg font-bold ${
                      visite ? 'border-2 border-green-700 bg-white text-green-800' : 'bg-marine-700 text-white'
                    }`}
                  >
                    {visite ? 'Modifier le compte-rendu' : 'Compte-rendu'}
                  </Link>
                  <a
                    href={`tel:${c.contact.telephone.replace(/\s/g, '')}`}
                    className="col-span-1 flex min-h-12 items-center justify-center gap-1 rounded-lg border-2 border-slate-300 bg-white font-semibold text-slate-800"
                  >
                    <IconPhone width={18} height={18} /> Appeler
                  </a>
                  <a
                    href={lienItineraire(c.lat, c.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="col-span-2 flex min-h-12 items-center justify-center gap-1 rounded-lg border-2 border-slate-300 bg-white font-semibold text-slate-800"
                  >
                    <IconNav width={18} height={18} /> Itinéraire
                  </a>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
      <EstimationNote className="mt-4" />
    </div>
  );
}
