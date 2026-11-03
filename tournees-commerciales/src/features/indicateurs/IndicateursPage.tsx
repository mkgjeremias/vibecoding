import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { Card, EstimationNote, inputCls, PageTitle } from '../../components/ui';
import { fmtDuree, fmtKm, fmtNombre, fmtPct } from '../../lib/format';
import { useData } from '../../state/DataContext';
import { useProfil } from '../../state/ProfilContext';
import { calculerKpis } from './kpis';

/** Couleurs de séries (palette catégorielle validée, emplacements 1 et 2). */
export const SERIE = { clients: '#2a78d6', prospects: '#eb6834' };
const AXE = { fontSize: 12, fill: '#52514e' };

export function Tile({ label, valeur, detail }: { label: string; valeur: string; detail?: string }) {
  return (
    <Card className="p-4">
      <div className="text-sm font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{valeur}</div>
      {detail && <div className="mt-1 text-sm text-slate-600">{detail}</div>}
    </Card>
  );
}

function TooltipBox({ active, payload, label, unite }: TooltipProps<number, string> & { unite?: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <div className="mb-1 font-semibold">Semaine du {label}</div>
      {payload.map((p) => (
        <div key={p.dataKey as string} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="text-slate-700">{p.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{unite ? unite(p.value as number) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
      <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

const PERIODES = [4, 12, 26, 52];

export default function IndicateursPage() {
  const { data, derived } = useData();
  const { commercial, isManager } = useProfil();
  const [nbSemaines, setNbSemaines] = useState(12);
  const [filtre, setFiltre] = useState('');

  const cibles = useMemo(() => {
    if (!isManager) return commercial ? [commercial] : [];
    return filtre ? data.commerciaux.filter((c) => c.id === filtre) : data.commerciaux;
  }, [isManager, commercial, filtre, data.commerciaux]);

  const k = useMemo(() => calculerKpis(data, derived, cibles, nbSemaines), [data, derived, cibles, nbSemaines]);
  const [tableau, setTableau] = useState(false);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <PageTitle
        actions={
          <>
            {isManager && (
              <select className={`${inputCls} !w-auto`} value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Commercial">
                <option value="">Toute l'équipe</option>
                {data.commerciaux.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.prenom} {c.nom}
                  </option>
                ))}
              </select>
            )}
            <div className="inline-flex rounded-lg border-2 border-slate-300 bg-white p-0.5" role="group" aria-label="Période">
              {PERIODES.map((p) => (
                <button
                  key={p}
                  aria-pressed={nbSemaines === p}
                  onClick={() => setNbSemaines(p)}
                  className={`min-h-10 rounded-md px-3 text-sm font-semibold ${nbSemaines === p ? 'bg-marine-700 text-white' : 'text-slate-700'}`}
                >
                  {p} sem.
                </button>
              ))}
            </div>
          </>
        }
      >
        Indicateurs
      </PageTitle>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Visites par semaine" valeur={fmtNombre(Math.round(k.visitesParSemaine * 10) / 10)} detail={`${fmtNombre(k.visites)} visites sur ${k.nbSemaines} semaines`} />
        <Tile label="Km parcourus (estimés)" valeur={fmtNombre(k.km)} detail={`≈ ${fmtKm(k.kmParSemaine)} par semaine`} />
        <Tile
          label="Part du temps client"
          valeur={fmtPct(k.partClient)}
          detail={`Prospects ${fmtPct(1 - k.partClient)} · ${fmtDuree(k.minutesClients)} clients, ${fmtDuree(k.minutesProspects)} prospects`}
        />
        <Tile
          label="Conversion des prospects"
          valeur={k.tauxConversion === null ? 'n.d.' : fmtPct(k.tauxConversion)}
          detail={`${k.prospectsGagnes} gagné${k.prospectsGagnes > 1 ? 's' : ''} · ${k.prospectsPerdus} perdu${k.prospectsPerdus > 1 ? 's' : ''} sur la période`}
        />
        <Tile
          label={`Couverture (${data.parametres.couvertureJours} j)`}
          valeur={fmtPct(k.couverture)}
          detail={`${k.clientsCouverts} clients visités sur ${k.clients}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-bold">Visites par semaine</h2>
          <div className="mb-2 flex gap-4">
            <LegendItem color={SERIE.clients} label="Clients" />
            <LegendItem color={SERIE.prospects} label="Prospects" />
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={k.semaines} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={AXE} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={AXE} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(15,23,42,0.06)' }} />
                <Bar dataKey="visitesClients" name="Clients" stackId="v" fill={SERIE.clients} stroke="#fff" strokeWidth={1} />
                <Bar dataKey="visitesProspects" name="Prospects" stackId="v" fill={SERIE.prospects} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-bold">Kilomètres estimés par semaine</h2>
          <div className="h-[17.5rem]">
            <ResponsiveContainer>
              <BarChart data={k.semaines} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={AXE} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={AXE} tickLine={false} axisLine={false} />
                <Tooltip content={<TooltipBox unite={(n) => fmtKm(n)} />} cursor={{ fill: 'rgba(15,23,42,0.06)' }} />
                <Bar dataKey="km" name="Km" fill={SERIE.clients} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <button className="mt-3 min-h-11 font-semibold text-marine-700 underline" onClick={() => setTableau((t) => !t)}>
        {tableau ? 'Masquer le tableau' : 'Voir les données en tableau'}
      </button>
      {tableau && (
        <Card className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Semaine du</th>
                <th className="px-3 py-2 text-right">Visites clients</th>
                <th className="px-3 py-2 text-right">Visites prospects</th>
                <th className="px-3 py-2 text-right">Km estimés</th>
              </tr>
            </thead>
            <tbody>
              {k.semaines.map((s) => (
                <tr key={s.debut} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{s.label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{s.visitesClients}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{s.visitesProspects}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtNombre(s.km)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-4 space-y-1 text-sm text-slate-600">
        <p>
          <strong>Temps client / prospect</strong> : durée des rendez-vous uniquement, hors trajets. <strong>Conversion</strong> : gagnés ÷ (gagnés + perdus),
          prospects clôturés pendant la période. <strong>Couverture</strong> : part des clients visités dans les {data.parametres.couvertureJours} derniers
          jours, à date.
        </p>
      </div>
      <EstimationNote className="mt-3" />
    </div>
  );
}
