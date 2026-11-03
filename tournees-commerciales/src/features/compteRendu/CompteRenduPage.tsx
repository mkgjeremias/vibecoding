import { addDays, addMonths } from 'date-fns';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Empty, inputCls } from '../../components/ui';
import { RESULTAT_LABEL } from '../../domain/labels';
import type { ResultatVisite, Visite } from '../../domain/types';
import { fmtDateCourte, hhmmToMin, isoDateTime, isoDay, minToHhmm } from '../../lib/format';
import { uid } from '../../lib/random';
import { useData } from '../../state/DataContext';
import { useProfil } from '../../state/ProfilContext';
import { tourneeDuJour } from '../tournee/tourneeUtils';
import { useTourneeCalc } from '../tournee/useTourneeCalc';

const RESULTATS: { v: ResultatVisite; cls: string }[] = [
  { v: 'positif', cls: 'border-green-700 bg-green-700' },
  { v: 'neutre', cls: 'border-slate-600 bg-slate-600' },
  { v: 'devis_demande', cls: 'border-amber-600 bg-amber-600' },
  { v: 'commande', cls: 'border-blue-700 bg-blue-700' },
  { v: 'negatif', cls: 'border-red-700 bg-red-700' },
  { v: 'absent', cls: 'border-slate-800 bg-slate-800' },
];

const ACTIONS_RAPIDES = ['Envoyer le chiffrage', 'Relancer le devis', 'Envoyer la documentation', 'Planifier une démo'];

export default function CompteRenduPage() {
  const { compteId = '' } = useParams();
  const navigate = useNavigate();
  const { data, derived, saveVisite, saveTournee, saveCompte } = useData();
  const { commercial } = useProfil();
  const info = derived.infos.get(compteId);
  const tournee = commercial ? tourneeDuJour(data.tournees, commercial.id) : undefined;
  const calc = useTourneeCalc(tournee, commercial);
  const etapeIdx = tournee?.etapes.findIndex((e) => e.compteId === compteId) ?? -1;
  const etape = etapeIdx >= 0 ? tournee!.etapes[etapeIdx] : undefined;
  const existante = etape?.visiteId ? data.visites.find((v) => v.id === etape.visiteId) : undefined;

  const today = new Date();
  const [resultat, setResultat] = useState<ResultatVisite | null>(existante?.resultat ?? null);
  const [action, setAction] = useState(existante?.prochaineAction ?? '');
  const [relance, setRelance] = useState(existante?.dateRelance ?? '');
  const [note, setNote] = useState(existante?.note ?? '');
  const [saving, setSaving] = useState(false);

  if (!info || !commercial) return <Empty>Compte introuvable.</Empty>;
  const c = info.compte;

  const relances = [
    { label: '1 sem.', d: addDays(today, 7) },
    { label: '2 sem.', d: addDays(today, 14) },
    { label: '1 mois', d: addMonths(today, 1) },
    { label: '3 mois', d: addMonths(today, 3) },
  ];

  const enregistrer = async () => {
    if (!resultat) return;
    setSaving(true);
    const st = calc?.schedule.stops[etapeIdx];
    const heure = st ? minToHhmm(st.debutRdvMin) : minToHhmm(hhmmToMin(`${today.getHours()}:${today.getMinutes()}`));
    const v: Visite = {
      id: existante?.id ?? uid('v'),
      compteId: c.id,
      commercialId: commercial.id,
      debut: existante?.debut ?? `${isoDay(today)}T${heure}:00`,
      dureeMin: existante?.dureeMin ?? etape?.dureeMin ?? tournee?.dureeRdvMin ?? data.parametres.dureeRdvMin,
      resultat,
      prochaineAction: action.trim() || undefined,
      dateRelance: relance || undefined,
      note: note.trim() || undefined,
      tourneeId: tournee?.id,
    };
    await saveVisite(v);
    if (tournee && etape && !etape.visiteId) {
      await saveTournee({
        ...tournee,
        etapes: tournee.etapes.map((e) => (e.compteId === c.id ? { ...e, visiteId: v.id } : e)),
        modifieeLe: isoDateTime(new Date()),
      });
    }
    if (v.prochaineAction && v.dateRelance) {
      await saveCompte({ ...c, prochaineAction: { libelle: v.prochaineAction, date: v.dateRelance } });
    }
    navigate('/aujourdhui', { state: { flash: `Compte-rendu enregistré pour ${c.raisonSociale}.` } });
  };

  return (
    <div className="mx-auto max-w-xl p-3 pb-6 md:p-6">
      <button onClick={() => navigate(-1)} className="mb-2 min-h-11 font-semibold text-marine-700">
        ← Retour
      </button>
      <h1 className="text-2xl font-bold leading-tight text-marine-900">Compte-rendu</h1>
      <p className="mb-4 text-lg text-slate-800">
        {c.raisonSociale} · {c.commune}
      </p>

      <fieldset className="mb-5">
        <legend className="mb-2 text-lg font-bold">Résultat</legend>
        <div className="grid grid-cols-2 gap-2">
          {RESULTATS.map(({ v, cls }) => (
            <button
              key={v}
              type="button"
              aria-pressed={resultat === v}
              onClick={() => setResultat(v)}
              className={`min-h-16 rounded-xl border-2 text-lg font-bold ${resultat === v ? `${cls} text-white` : 'border-slate-300 bg-white text-slate-900'}`}
            >
              {RESULTAT_LABEL[v]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mb-5">
        <label htmlFor="action" className="mb-2 block text-lg font-bold">
          Prochaine action
        </label>
        <div className="mb-2 flex flex-wrap gap-2">
          {ACTIONS_RAPIDES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAction(a)}
              className={`min-h-11 rounded-full border-2 px-3 font-semibold ${action === a ? 'border-marine-700 bg-marine-700 text-white' : 'border-slate-300 bg-white'}`}
            >
              {a}
            </button>
          ))}
        </div>
        <input id="action" className={inputCls} value={action} onChange={(e) => setAction(e.target.value)} placeholder="Ou saisir une action…" />
      </div>

      <div className="mb-5">
        <label htmlFor="relance" className="mb-2 block text-lg font-bold">
          Date de relance
        </label>
        <div className="mb-2 grid grid-cols-4 gap-2">
          {relances.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRelance(isoDay(r.d))}
              className={`min-h-12 rounded-lg border-2 font-semibold ${relance === isoDay(r.d) ? 'border-marine-700 bg-marine-700 text-white' : 'border-slate-300 bg-white'}`}
            >
              {r.label}
              <span className="block text-xs font-normal">{fmtDateCourte(r.d)}</span>
            </button>
          ))}
        </div>
        <input id="relance" type="date" className={inputCls} value={relance} onChange={(e) => setRelance(e.target.value)} />
      </div>

      <div className="mb-6">
        <label htmlFor="note" className="mb-2 block text-lg font-bold">
          Note libre
        </label>
        <textarea id="note" rows={3} className={`${inputCls} py-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" />
      </div>

      <Button size="lg" className="w-full" disabled={!resultat || saving} onClick={enregistrer}>
        {saving ? 'Enregistrement…' : resultat ? 'Enregistrer' : 'Choisis un résultat'}
      </Button>
    </div>
  );
}
