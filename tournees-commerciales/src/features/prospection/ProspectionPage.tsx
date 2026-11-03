import { useMemo, useState } from 'react';
import { Badge, Button, inputCls } from '../../components/ui';
import { IconPlus } from '../../components/icons';
import type { CompteInfo } from '../../domain/derive';
import { ETAPE_LABEL, ETAPES, TYPE_LABEL } from '../../domain/labels';
import type { EtapePipeline } from '../../domain/types';
import { fmtDate, fmtEuro, joursDepuis } from '../../lib/format';
import { useData } from '../../state/DataContext';
import { useProfil } from '../../state/ProfilContext';
import { CompteFiche } from '../comptes/CompteFiche';
import { NouveauProspect } from './NouveauProspect';
import { ProspectEditor } from './ProspectEditor';

const ETAPE_COULEUR: Record<EtapePipeline, string> = {
  identifie: 'border-t-slate-400',
  contacte: 'border-t-sky-500',
  rdv_obtenu: 'border-t-indigo-500',
  devis_envoye: 'border-t-amber-500',
  gagne: 'border-t-green-600',
  perdu: 'border-t-red-600',
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 60 ? 'bg-orange-600' : score >= 40 ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div className="flex items-center gap-2" aria-label={`Score ${score} sur 100`}>
      <div className="h-2 flex-1 rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-7 text-right text-xs font-bold">{score}</span>
    </div>
  );
}

function ProspectCard({ info, onOpen, seuilInactif, selected }: { info: CompteInfo; onOpen: () => void; seuilInactif: number; selected: boolean }) {
  const c = info.compte;
  const pa = c.prochaineAction;
  const enRetard = pa && joursDepuis(pa.date) > 0;
  const inactif = c.etape !== 'gagne' && c.etape !== 'perdu' && joursDepuis(info.derniereActivite) > seuilInactif;
  const montantDevis = info.devisEnCours.reduce((s, d) => s + d.montantHT, 0);
  return (
    <button
      onClick={onOpen}
      className={`w-full rounded-lg border bg-white p-2.5 text-left shadow-sm hover:border-marine-600 ${selected ? 'border-2 border-marine-700' : 'border-slate-200'}`}
    >
      <div className="font-semibold leading-tight">{c.raisonSociale}</div>
      <div className="mb-1.5 text-xs text-slate-600">
        {TYPE_LABEL[c.type]} · {c.commune}
      </div>
      <ScoreBar score={c.score ?? 0} />
      {pa && (
        <div className={`mt-1.5 text-xs ${enRetard ? 'font-bold text-red-700' : 'text-slate-700'}`}>
          {enRetard ? 'En retard · ' : ''}
          {fmtDate(pa.date)} · {pa.libelle}
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-1">
        {montantDevis > 0 && <Badge tone="amber">Devis {fmtEuro(montantDevis)}</Badge>}
        {inactif && <Badge tone="red">Sans action depuis {joursDepuis(info.derniereActivite)} j</Badge>}
        {c.etape === 'perdu' && c.motifPerte && <Badge>{c.motifPerte}</Badge>}
      </div>
    </button>
  );
}

export default function ProspectionPage() {
  const { data, derived } = useData();
  const { commercial, isManager } = useProfil();
  const [selected, setSelected] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [commercialFiltre, setCommercialFiltre] = useState('');
  const [etapeMobile, setEtapeMobile] = useState<EtapePipeline>('contacte');
  const seuil = data.parametres.seuilProspectInactifJours;

  const prospects = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return [...derived.infos.values()]
      .filter((i) => i.compte.nature === 'prospect')
      .filter((i) => (isManager ? !commercialFiltre || i.compte.commercialId === commercialFiltre : i.compte.commercialId === commercial?.id))
      .filter((i) => !q || `${i.compte.raisonSociale} ${i.compte.commune}`.toLowerCase().includes(q))
      .sort((a, b) => (b.compte.score ?? 0) - (a.compte.score ?? 0));
  }, [derived, isManager, commercial, commercialFiltre, recherche]);

  const parEtape = useMemo(() => {
    const m = new Map<EtapePipeline, CompteInfo[]>(ETAPES.map((e) => [e, []]));
    for (const p of prospects) m.get(p.compte.etape ?? 'identifie')!.push(p);
    return m;
  }, [prospects]);

  const sel = selected ? derived.infos.get(selected) : undefined;
  const inactifs = prospects.filter(
    (i) => i.compte.etape !== 'gagne' && i.compte.etape !== 'perdu' && joursDepuis(i.derniereActivite) > seuil,
  ).length;

  const colonne = (e: EtapePipeline) => {
    const list = parEtape.get(e)!;
    const devis = list.reduce((s, i) => s + i.devisEnCours.reduce((t, d) => t + d.montantHT, 0), 0);
    return (
      <div key={e} className={`flex min-h-0 flex-col rounded-xl border-t-4 bg-slate-100 ${ETAPE_COULEUR[e]}`}>
        <div className="flex items-baseline justify-between px-2.5 pb-1 pt-2">
          <h2 className="font-bold">{ETAPE_LABEL[e]}</h2>
          <span className="text-sm font-semibold text-slate-600">{list.length}</span>
        </div>
        {devis > 0 && <div className="px-2.5 pb-1 text-xs text-slate-600">{fmtEuro(devis)} de devis en cours</div>}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          {list.map((i) => (
            <ProspectCard
              key={i.compte.id}
              info={i}
              seuilInactif={seuil}
              selected={i.compte.id === selected}
              onOpen={() => {
                setCreation(false);
                setSelected(i.compte.id);
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col p-3 md:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-2xl font-bold text-marine-900">Prospection</h1>
          {inactifs > 0 && <Badge tone="red">{inactifs} sans action depuis plus de {seuil} j</Badge>}
          {commercial && !isManager && (
            <Button
              size="sm"
              onClick={() => {
                setSelected(null);
                setCreation(true);
              }}
            >
              <IconPlus width={18} height={18} /> Nouveau prospect
            </Button>
          )}
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <input type="search" className={`${inputCls} max-w-xs`} placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          {isManager && (
            <select className={`${inputCls} max-w-xs`} value={commercialFiltre} onChange={(e) => setCommercialFiltre(e.target.value)}>
              <option value="">Tous les commerciaux</option>
              {data.commerciaux.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.prenom} {c.nom}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Mobile : une étape à la fois */}
        <div className="md:hidden">
          <select className={`${inputCls} mb-2`} value={etapeMobile} onChange={(e) => setEtapeMobile(e.target.value as EtapePipeline)} aria-label="Étape affichée">
            {ETAPES.map((e) => (
              <option key={e} value={e}>
                {ETAPE_LABEL[e]} ({parEtape.get(e)!.length})
              </option>
            ))}
          </select>
          {colonne(etapeMobile)}
        </div>

        {/* Ordinateur : pipeline complet */}
        <div className="hidden min-h-0 flex-1 gap-2 overflow-x-auto md:grid md:grid-cols-[repeat(6,minmax(13rem,1fr))]">{ETAPES.map(colonne)}</div>
      </div>

      {(sel || creation) && (
        <aside className="fixed inset-0 z-[1100] overflow-y-auto bg-white p-4 md:static md:z-auto md:w-[26rem] md:shrink-0 md:border-l md:border-slate-200">
          {creation && commercial ? (
            <NouveauProspect
              commercial={commercial}
              onClose={() => setCreation(false)}
              onCreated={(id) => {
                setCreation(false);
                setSelected(id);
              }}
            />
          ) : (
            sel && (
              <CompteFiche
                compteId={sel.compte.id}
                onClose={() => setSelected(null)}
                maxHistorique={12}
                actions={<ProspectEditor key={sel.compte.id + (sel.compte.etape ?? '')} compte={sel.compte} />}
              />
            )
          )}
        </aside>
      )}
    </div>
  );
}
