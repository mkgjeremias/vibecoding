import type { CompteInfo } from '../../domain/derive';
import { POTENTIEL_LABEL, STATUT_COULEUR, STATUT_LABEL, TYPE_LABEL } from '../../domain/labels';
import type { Potentiel, StatutCompte, TypeCompte } from '../../domain/types';
import { joursDepuis } from '../../lib/format';
import { inputCls } from '../../components/ui';

export type FiltreVisite = 'toutes' | 'moins30' | 'plus60' | 'plus90' | 'plus180' | 'jamais';

export interface Filtres {
  statuts: StatutCompte[];
  types: TypeCompte[];
  potentiels: Potentiel[];
  visite: FiltreVisite;
  recherche: string;
  secteurId: string; // '' = tous
}

export const FILTRES_DEFAUT: Filtres = {
  statuts: ['client_actif', 'client_risque', 'prospect_chaud', 'prospect_froid'],
  types: ['installateur', 'fumiste', 'bureau_etudes', 'distributeur'],
  potentiels: ['A', 'B', 'C'],
  visite: 'toutes',
  recherche: '',
  secteurId: '',
};

const VISITE_LABEL: Record<FiltreVisite, string> = {
  toutes: 'Toutes',
  moins30: 'Visités il y a moins de 30 j',
  plus60: 'Non visités depuis 60 j',
  plus90: 'Non visités depuis 90 j',
  plus180: 'Non visités depuis 180 j',
  jamais: 'Jamais visités',
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function appliquerFiltres(infos: CompteInfo[], f: Filtres, today = new Date()): CompteInfo[] {
  const q = norm(f.recherche.trim());
  return infos.filter((i) => {
    const c = i.compte;
    if (!f.statuts.includes(i.statut)) return false;
    if (!f.types.includes(c.type)) return false;
    if (!f.potentiels.includes(c.potentiel)) return false;
    if (f.secteurId && c.secteurId !== f.secteurId) return false;
    const j = joursDepuis(i.derniereVisite, today);
    if (f.visite === 'moins30' && !(j < 30)) return false;
    if (f.visite === 'plus60' && !(j >= 60)) return false;
    if (f.visite === 'plus90' && !(j >= 90)) return false;
    if (f.visite === 'plus180' && !(j >= 180)) return false;
    if (f.visite === 'jamais' && i.derniereVisite) return false;
    if (q && !norm(`${c.raisonSociale} ${c.commune} ${c.contact.nom} ${c.codePostal}`).includes(q)) return false;
    return true;
  });
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-semibold ${
        active ? 'border-marine-700 bg-marine-700 text-white' : 'border-slate-300 bg-white text-slate-700'
      }`}
    >
      {color && <span className="h-3 w-3 rounded-full border border-white" style={{ background: color }} />}
      {children}
    </button>
  );
}

export function FiltresPanel({
  f,
  setF,
  secteurs,
}: {
  f: Filtres;
  setF: (f: Filtres) => void;
  secteurs?: { id: string; nom: string }[];
}) {
  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Rechercher un compte, une commune…"
        className={inputCls}
        value={f.recherche}
        onChange={(e) => setF({ ...f, recherche: e.target.value })}
      />
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-600">Statut</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUT_LABEL) as StatutCompte[]).map((s) => (
            <Chip key={s} active={f.statuts.includes(s)} onClick={() => setF({ ...f, statuts: toggle(f.statuts, s) })} color={STATUT_COULEUR[s]}>
              {STATUT_LABEL[s]}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-600">Type de client</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TYPE_LABEL) as TypeCompte[]).map((t) => (
            <Chip key={t} active={f.types.includes(t)} onClick={() => setF({ ...f, types: toggle(f.types, t) })}>
              {TYPE_LABEL[t]}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-600">Potentiel</div>
        <div className="flex flex-wrap gap-1.5">
          {(['A', 'B', 'C'] as Potentiel[]).map((p) => (
            <Chip key={p} active={f.potentiels.includes(p)} onClick={() => setF({ ...f, potentiels: toggle(f.potentiels, p) })}>
              {POTENTIEL_LABEL[p]}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Dernière visite</span>
          <select className={inputCls} value={f.visite} onChange={(e) => setF({ ...f, visite: e.target.value as FiltreVisite })}>
            {(Object.keys(VISITE_LABEL) as FiltreVisite[]).map((v) => (
              <option key={v} value={v}>
                {VISITE_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
        {secteurs && (
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Secteur</span>
            <select className={inputCls} value={f.secteurId} onChange={(e) => setF({ ...f, secteurId: e.target.value })}>
              <option value="">Tous les secteurs</option>
              {secteurs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
