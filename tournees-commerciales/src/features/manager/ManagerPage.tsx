import { useMemo, useState } from 'react';
import { CircleMarker, Polygon, Tooltip } from 'react-leaflet';
import { BaseMap } from '../../components/AccountsMap';
import { IconAlert } from '../../components/icons';
import { Badge, Card, EstimationNote, PageTitle } from '../../components/ui';
import { STATUT_COULEUR, TYPE_LABEL } from '../../domain/labels';
import { fmtEuro, fmtKm, fmtNombre, fmtPct, joursDepuis } from '../../lib/format';
import { convexHull } from '../../lib/hull';
import { useData } from '../../state/DataContext';
import { CompteFiche } from '../comptes/CompteFiche';
import { calculerKpis } from '../indicateurs/kpis';

const PERIODES = [4, 12, 26, 52];

export default function ManagerPage() {
  const { data, derived } = useData();
  const [nbSemaines, setNbSemaines] = useState(12);
  const [selected, setSelected] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<'clients' | 'prospects'>('clients');
  const p = data.parametres;

  const infos = useMemo(() => [...derived.infos.values()], [derived]);

  const lignes = useMemo(
    () =>
      data.commerciaux.map((c) => {
        const k = calculerKpis(data, derived, [c], nbSemaines);
        const mine = infos.filter((i) => i.compte.commercialId === c.id);
        return {
          c,
          secteur: data.secteurs.find((s) => s.id === c.secteurId)!,
          k,
          risque: mine.filter((i) => i.statut === 'client_risque').length,
          ca: mine.reduce((s, i) => s + i.ca12m, 0),
          prospectsActifs: mine.filter((i) => i.compte.nature === 'prospect' && i.compte.etape !== 'gagne' && i.compte.etape !== 'perdu').length,
          devis: mine.reduce((s, i) => s + i.devisEnCours.reduce((t, d) => t + d.montantHT, 0), 0),
        };
      }),
    [data, derived, infos, nbSemaines],
  );

  const alertesClients = useMemo(
    () =>
      infos
        .filter((i) => i.important && joursDepuis(i.derniereVisite, derived.today) > p.couvertureJours)
        .sort((a, b) => joursDepuis(b.derniereVisite, derived.today) - joursDepuis(a.derniereVisite, derived.today)),
    [infos, derived.today, p.couvertureJours],
  );
  const alertesProspects = useMemo(
    () =>
      infos
        .filter(
          (i) =>
            i.compte.nature === 'prospect' &&
            i.compte.etape !== 'gagne' &&
            i.compte.etape !== 'perdu' &&
            joursDepuis(i.derniereActivite, derived.today) > p.seuilProspectInactifJours,
        )
        .sort((a, b) => joursDepuis(b.derniereActivite, derived.today) - joursDepuis(a.derniereActivite, derived.today)),
    [infos, derived.today, p.seuilProspectInactifJours],
  );

  const enveloppes = useMemo(
    () =>
      data.secteurs.map((s) => ({
        s,
        hull: convexHull(data.comptes.filter((c) => c.secteurId === s.id)),
      })),
    [data.secteurs, data.comptes],
  );

  const nomCommercial = (id: string) => {
    const c = data.commerciaux.find((x) => x.id === id);
    return c ? `${c.prenom} ${c.nom}` : '';
  };

  const liste = onglet === 'clients' ? alertesClients : alertesProspects;

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
        <PageTitle
          actions={
            <div className="inline-flex rounded-lg border-2 border-slate-300 bg-white p-0.5" role="group" aria-label="Période">
              {PERIODES.map((n) => (
                <button
                  key={n}
                  aria-pressed={nbSemaines === n}
                  onClick={() => setNbSemaines(n)}
                  className={`min-h-10 rounded-md px-3 text-sm font-semibold ${nbSemaines === n ? 'bg-marine-700 text-white' : 'text-slate-700'}`}
                >
                  {n} sem.
                </button>
              ))}
            </div>
          }
        >
          Vue manager
        </PageTitle>

        <div className="mb-4">
          <Card className="overflow-x-auto">
            <h2 className="px-4 pt-3 font-bold">Comparaison sur {nbSemaines} semaines</h2>
            <table className="mt-2 w-full min-w-[40rem] text-sm">
              <thead className="text-left text-slate-600">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 font-semibold">Commercial</th>
                  <th className="px-2 py-2 text-right font-semibold">Visites / sem.</th>
                  <th className="px-2 py-2 text-right font-semibold">Km / sem.</th>
                  <th className="px-2 py-2 text-right font-semibold">Temps client</th>
                  <th className="px-2 py-2 text-right font-semibold">Conversion</th>
                  <th className="px-2 py-2 text-right font-semibold">Couverture</th>
                  <th className="px-2 py-2 text-right font-semibold">Clients à risque</th>
                  <th className="px-2 py-2 text-right font-semibold">Devis en cours</th>
                  <th className="px-3 py-2 text-right font-semibold">CA 12 mois</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.c.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 font-semibold">
                        <span className="h-3 w-3 rounded-sm" style={{ background: l.secteur.couleur }} />
                        {l.c.prenom} {l.c.nom}
                      </div>
                      <div className="pl-5 text-xs text-slate-600">{l.secteur.nom}</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtNombre(Math.round(l.k.visitesParSemaine * 10) / 10)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtKm(l.k.kmParSemaine)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtPct(l.k.partClient)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {l.k.tauxConversion === null ? 'n.d.' : fmtPct(l.k.tauxConversion)}
                      <div className="text-xs text-slate-500">
                        {l.k.prospectsGagnes}/{l.k.prospectsGagnes + l.k.prospectsPerdus}
                      </div>
                    </td>
                    <td className={`px-2 py-2 text-right tabular-nums ${l.k.couverture < 0.7 ? 'font-bold text-red-700' : ''}`}>{fmtPct(l.k.couverture)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.risque}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtEuro(l.devis)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtEuro(l.ca)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-slate-600">
              Couverture en rouge sous 70 %. Conversion sur les prospects clôturés pendant la période (gagnés / clôturés). Montants fictifs.
            </p>
          </Card>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <Card className="overflow-hidden">
            <h2 className="px-4 pt-3 font-bold">Secteurs</h2>
            <div className="h-96">
              <BaseMap fitPoints={data.comptes} fitKey="secteurs">
                {enveloppes.map(({ s, hull }) => (
                  <Polygon key={s.id} positions={hull.map((h) => [h.lat, h.lng])} pathOptions={{ color: s.couleur, weight: 2, fillOpacity: 0.12 }}>
                    <Tooltip sticky>{s.nom}</Tooltip>
                  </Polygon>
                ))}
                {alertesClients.map((i) => (
                  <CircleMarker
                    key={i.compte.id}
                    center={[i.compte.lat, i.compte.lng]}
                    radius={6}
                    pathOptions={{ color: '#fff', weight: 1.5, fillColor: STATUT_COULEUR.client_risque, fillOpacity: 0.95 }}
                    eventHandlers={{ click: () => setSelected(i.compte.id) }}
                  >
                    <Tooltip>{i.compte.raisonSociale} · client important non visité</Tooltip>
                  </CircleMarker>
                ))}
                {data.commerciaux.map((c) => (
                  <CircleMarker key={c.id} center={[c.domicile.lat, c.domicile.lng]} radius={8} pathOptions={{ color: '#0f172a', weight: 2, fillColor: '#f59e0b', fillOpacity: 1 }}>
                    <Tooltip>
                      {c.prenom} {c.nom} · {c.domicile.commune}
                    </Tooltip>
                  </CircleMarker>
                ))}
              </BaseMap>
            </div>
            <p className="px-4 py-2 text-xs text-slate-600">
              Emprise = enveloppe des comptes de chaque secteur. Point orange : domicile du commercial. Point rouge : client important non visité depuis plus de{' '}
              {p.couvertureJours} jours.
            </p>
          </Card>

          <Card className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 pt-3">
            <IconAlert className="text-red-700" />
            <h2 className="mr-auto font-bold">Alertes</h2>
            <div className="flex">
              <button
                onClick={() => setOnglet('clients')}
                className={`min-h-11 border-b-4 px-3 text-sm font-semibold ${onglet === 'clients' ? 'border-marine-700 text-marine-800' : 'border-transparent text-slate-600'}`}
              >
                Clients importants non visités ({alertesClients.length})
              </button>
              <button
                onClick={() => setOnglet('prospects')}
                className={`min-h-11 border-b-4 px-3 text-sm font-semibold ${onglet === 'prospects' ? 'border-marine-700 text-marine-800' : 'border-transparent text-slate-600'}`}
              >
                Prospects sans action ({alertesProspects.length})
              </button>
            </div>
          </div>
          <p className="px-4 pt-2 text-xs text-slate-600">
            {onglet === 'clients'
              ? `Clients importants (cochés ou CA 12 mois ≥ ${fmtEuro(p.seuilCAImportant)}) sans visite depuis plus de ${p.couvertureJours} jours.`
              : `Prospects en cours sans visite, échange ni changement d'étape depuis plus de ${p.seuilProspectInactifJours} jours.`}
          </p>
          <ul className="divide-y divide-slate-100">
            {liste.map((i) => {
              const j = joursDepuis(onglet === 'clients' ? i.derniereVisite : i.derniereActivite, derived.today);
              return (
                <li key={i.compte.id}>
                  <button onClick={() => setSelected(i.compte.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-slate-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{i.compte.raisonSociale}</span>
                      <span className="block text-sm text-slate-600">
                        {TYPE_LABEL[i.compte.type]} · {i.compte.commune} · {nomCommercial(i.compte.commercialId)}
                      </span>
                    </span>
                    {onglet === 'clients' && <span className="text-sm tabular-nums text-slate-700">CA {fmtEuro(i.ca12m)}</span>}
                    <Badge tone="red">{j === Infinity ? 'Jamais' : `${j} j`}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        </div>
        <EstimationNote className="mt-4" />
      </div>

      {selected && (
        <aside className="fixed inset-0 z-[1100] overflow-y-auto bg-white p-4 md:static md:z-auto md:w-96 md:shrink-0 md:border-l md:border-slate-200">
          <CompteFiche compteId={selected} onClose={() => setSelected(null)} maxHistorique={10} />
        </aside>
      )}
    </div>
  );
}
