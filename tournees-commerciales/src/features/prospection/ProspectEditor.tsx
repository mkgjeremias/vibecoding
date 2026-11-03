import { useState } from 'react';
import { Button, Field, inputCls } from '../../components/ui';
import { CANAL_LABEL, ETAPE_LABEL, ETAPES } from '../../domain/labels';
import type { CanalEchange, Compte, EtapePipeline } from '../../domain/types';
import { isoDay } from '../../lib/format';
import { uid } from '../../lib/random';
import { MOTIFS_PERTE } from '../../seed/names';
import { useData } from '../../state/DataContext';

/** Mise à jour d'un prospect : étape, score, prochaine action, nouvel échange. */
export function ProspectEditor({ compte }: { compte: Compte }) {
  const { saveCompte, saveEchange } = useData();
  const [canal, setCanal] = useState<CanalEchange>('appel');
  const [resume, setResume] = useState('');
  const [action, setAction] = useState(compte.prochaineAction?.libelle ?? '');
  const [dateAction, setDateAction] = useState(compte.prochaineAction?.date ?? '');

  const maj = (patch: Partial<Compte>) => saveCompte({ ...compte, ...patch });

  const changerEtape = (etape: EtapePipeline) =>
    maj({
      etape,
      etapeModifieeLe: isoDay(new Date()),
      motifPerte: etape === 'perdu' ? (compte.motifPerte ?? MOTIFS_PERTE[0]) : undefined,
      prochaineAction: etape === 'gagne' || etape === 'perdu' ? undefined : compte.prochaineAction,
    });

  const ajouterEchange = async () => {
    if (!resume.trim()) return;
    await saveEchange({
      id: uid('e'),
      compteId: compte.id,
      commercialId: compte.commercialId,
      date: isoDay(new Date()),
      canal,
      resume: resume.trim(),
    });
    setResume('');
  };

  return (
    <div className="space-y-4 rounded-xl border-2 border-marine-100 bg-marine-50 p-3">
      <div className="grid gap-3">
        <Field label="Étape du pipeline">
          <select className={inputCls} value={compte.etape} onChange={(e) => changerEtape(e.target.value as EtapePipeline)}>
            {ETAPES.map((e) => (
              <option key={e} value={e}>
                {ETAPE_LABEL[e]}
              </option>
            ))}
          </select>
        </Field>
        {compte.etape === 'perdu' ? (
          <Field label="Motif de perte">
            <select className={inputCls} value={compte.motifPerte} onChange={(e) => maj({ motifPerte: e.target.value })}>
              {MOTIFS_PERTE.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label={`Score de potentiel : ${compte.score ?? 0}/100`}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              className="h-11 w-full"
              value={compte.score ?? 0}
              onChange={(e) => maj({ score: Number(e.target.value) })}
            />
          </Field>
        )}
      </div>

      {compte.etape !== 'gagne' && compte.etape !== 'perdu' && (
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <div className="col-span-2">
          <Field label="Prochaine action">
            <input className={inputCls} value={action} onChange={(e) => setAction(e.target.value)} placeholder="Ex. : rappeler pour fixer un rendez-vous" />
          </Field>
          </div>
          <Field label="Pour le">
            <input type="date" className={inputCls} value={dateAction} onChange={(e) => setDateAction(e.target.value)} />
          </Field>
          <Button
            variant="secondary"
            disabled={!action.trim() || !dateAction}
            onClick={() => maj({ prochaineAction: { libelle: action.trim(), date: dateAction } })}
          >
            Enregistrer
          </Button>
        </div>
      )}

      <div className="grid grid-cols-[auto_1fr] items-end gap-2">
        <Field label="Nouvel échange">
          <select className={inputCls} value={canal} onChange={(e) => setCanal(e.target.value as CanalEchange)}>
            {(Object.keys(CANAL_LABEL) as CanalEchange[]).map((c) => (
              <option key={c} value={c}>
                {CANAL_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Résumé">
          <input className={inputCls} value={resume} onChange={(e) => setResume(e.target.value)} placeholder="Ce qui a été dit, décidé…" />
        </Field>
        <Button variant="secondary" className="col-span-2" disabled={!resume.trim()} onClick={ajouterEchange}>
          Ajouter l'échange
        </Button>
      </div>
    </div>
  );
}
