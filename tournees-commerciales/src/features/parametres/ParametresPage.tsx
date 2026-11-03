import { useState } from 'react';
import { Button, Card, Field, PageTitle, inputCls } from '../../components/ui';
import type { Parametres } from '../../domain/types';
import { fmtDate, fmtNombre } from '../../lib/format';
import { PARAMETRES_DEFAUT } from '../../services';
import { useData } from '../../state/DataContext';

export default function ParametresPage() {
  const { data, saveParametres, reset } = useData();
  const [p, setP] = useState<Parametres>(data.parametres);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const num = (k: keyof Parametres, step = 1, min = 0) => (
    <input
      type="number"
      step={step}
      min={min}
      className={inputCls}
      value={p[k] as number}
      onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })}
    />
  );

  const onSave = async () => {
    await saveParametres(p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const [confirmReset, setConfirmReset] = useState(false);
  const onReset = async () => {
    setBusy(true);
    await reset();
    setBusy(false);
    setConfirmReset(false);
  };

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <PageTitle>Paramètres</PageTitle>

      <Card className="mb-4 p-4">
        <h2 className="mb-3 text-lg font-bold">Calcul des tournées</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coefficient routier" hint="Multiplie la distance à vol d'oiseau. 1,3 par défaut.">
            {num('coefRoutier', 0.05, 1)}
          </Field>
          <Field label="Vitesse moyenne (km/h)">{num('vitesseMoyenneKmh', 5, 10)}</Field>
          <Field label="Durée de rendez-vous par défaut (min)">{num('dureeRdvMin', 15, 15)}</Field>
          <Field label="Heure de départ par défaut">
            <input type="time" className={inputCls} value={p.heureDepart} onChange={(e) => setP({ ...p, heureDepart: e.target.value })} />
          </Field>
          <Field label="Heure limite de retour" hint="Au-delà, la tournée est signalée.">
            <input type="time" className={inputCls} value={p.heureLimiteRetour} onChange={(e) => setP({ ...p, heureLimiteRetour: e.target.value })} />
          </Field>
          <Field label="Rayon des suggestions (km)">{num('rayonSuggestionKm', 1, 1)}</Field>
          <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              className="h-6 w-6"
              checked={p.pauseDejeuner.active}
              onChange={(e) => setP({ ...p, pauseDejeuner: { ...p.pauseDejeuner, active: e.target.checked } })}
            />
            <span className="font-semibold">Intégrer une pause déjeuner</span>
          </label>
          {p.pauseDejeuner.active && (
            <>
              <Field label="Pause à partir de">
                <input
                  type="time"
                  className={inputCls}
                  value={p.pauseDejeuner.debut}
                  onChange={(e) => setP({ ...p, pauseDejeuner: { ...p.pauseDejeuner, debut: e.target.value } })}
                />
              </Field>
              <Field label="Durée de la pause (min)">
                <input
                  type="number"
                  step={15}
                  min={0}
                  className={inputCls}
                  value={p.pauseDejeuner.dureeMin}
                  onChange={(e) => setP({ ...p, pauseDejeuner: { ...p.pauseDejeuner, dureeMin: Number(e.target.value) } })}
                />
              </Field>
            </>
          )}
        </div>
      </Card>

      <Card className="mb-4 p-4">
        <h2 className="mb-3 text-lg font-bold">Règles de statut et d'alerte</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client à risque : sans visite depuis (jours)">{num('seuilRisqueJours', 10, 1)}</Field>
          <Field label="Client à risque : baisse de CA (6 mois vs 6 précédents)" hint="0,3 = baisse de 30 %">
            {num('seuilBaisseCA', 0.05, 0)}
          </Field>
          <Field label="Prospect chaud : score minimal">{num('seuilScoreChaud', 5, 0)}</Field>
          <Field label="Client important : CA 12 mois à partir de (€)">{num('seuilCAImportant', 1000, 0)}</Field>
          <Field label="Prospect sans action : alerte après (jours)">{num('seuilProspectInactifJours', 5, 1)}</Field>
          <Field label="Couverture portefeuille : fenêtre (jours)">{num('couvertureJours', 10, 1)}</Field>
        </div>
      </Card>

      <div className="mb-8 flex flex-wrap gap-2">
        <Button onClick={onSave}>{saved ? 'Enregistré' : 'Enregistrer'}</Button>
        <Button variant="secondary" onClick={() => setP(PARAMETRES_DEFAUT)}>
          Valeurs par défaut
        </Button>
      </div>

      <Card className="border-red-200 p-4">
        <h2 className="mb-1 text-lg font-bold">Données de démonstration</h2>
        <p className="mb-3 text-sm text-slate-700">
          Jeu généré le {fmtDate(data.genereLe)} : {data.commerciaux.length} commerciaux,{' '}
          {fmtNombre(data.comptes.filter((c) => c.nature === 'client').length)} clients,{' '}
          {fmtNombre(data.comptes.filter((c) => c.nature === 'prospect').length)} prospects,{' '}
          {fmtNombre(data.visites.length)} visites. Tous les noms sont fictifs, les communes et leurs coordonnées sont réelles.
        </p>
        {confirmReset ? (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3">
            <p className="mb-2 text-sm font-semibold text-red-900">
              Les tournées, comptes-rendus et modifications seront perdus. Confirmer ?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={onReset} disabled={busy}>
                {busy ? 'Réinitialisation…' : 'Oui, réinitialiser'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmReset(false)} disabled={busy}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            Réinitialiser les données
          </Button>
        )}
      </Card>
    </div>
  );
}
