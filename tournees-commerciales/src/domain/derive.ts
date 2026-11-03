/**
 * Calculs dérivés (statut, CA, dernière visite…) à partir de l'instantané de données.
 * Fonctions pures : aucune dépendance au stockage.
 */
import { subDays } from 'date-fns';
import type { DataSnapshot } from '../services/DataService';
import { isoDay, joursDepuis } from '../lib/format';
import type { Compte, Devis, Parametres, StatutCompte, Visite } from './types';

export interface CompteInfo {
  compte: Compte;
  derniereVisite?: string; // ISO date
  nbVisites12m: number;
  ca12m: number;
  ca6m: number;
  caPrec6m: number;
  devisEnCours: Devis[];
  statut: StatutCompte;
  important: boolean;
  /** Dernière activité (visite, échange, changement d'étape), pour les prospects. */
  derniereActivite?: string;
}

export interface Derived {
  today: Date;
  infos: Map<string, CompteInfo>;
  visitesParCompte: Map<string, Visite[]>;
}

export function computeStatut(
  c: Compte,
  info: Pick<CompteInfo, 'derniereVisite' | 'ca6m' | 'caPrec6m'>,
  p: Parametres,
  today: Date,
): StatutCompte {
  if (c.nature === 'prospect') {
    if (c.etape === 'gagne') return 'client_actif';
    const chaud = (c.score ?? 0) >= p.seuilScoreChaud || c.etape === 'rdv_obtenu' || c.etape === 'devis_envoye';
    return chaud ? 'prospect_chaud' : 'prospect_froid';
  }
  const jours = joursDepuis(info.derniereVisite, today);
  // baisse évaluée seulement si le CA de référence est significatif (évite le bruit des petits comptes)
  const baisse = info.caPrec6m >= 3000 ? (info.caPrec6m - info.ca6m) / info.caPrec6m : 0;
  if (jours > p.seuilRisqueJours || baisse > p.seuilBaisseCA) return 'client_risque';
  return 'client_actif';
}

export function derive(data: DataSnapshot, today: Date = new Date()): Derived {
  const p = data.parametres;
  const d12 = isoDay(subDays(today, 365));
  const d6 = isoDay(subDays(today, 182));

  const visitesParCompte = new Map<string, Visite[]>();
  for (const v of data.visites) {
    const list = visitesParCompte.get(v.compteId);
    if (list) list.push(v);
    else visitesParCompte.set(v.compteId, [v]);
  }
  for (const list of visitesParCompte.values()) list.sort((a, b) => a.debut.localeCompare(b.debut));

  const ca = new Map<string, { a12: number; a6: number; p6: number }>();
  for (const o of data.commandes) {
    if (o.date < d12) continue;
    const e = ca.get(o.compteId) ?? { a12: 0, a6: 0, p6: 0 };
    e.a12 += o.montantHT;
    if (o.date >= d6) e.a6 += o.montantHT;
    else e.p6 += o.montantHT;
    ca.set(o.compteId, e);
  }

  const devisEnCours = new Map<string, Devis[]>();
  for (const dv of data.devis) {
    if (dv.statut !== 'en_cours') continue;
    const l = devisEnCours.get(dv.compteId) ?? [];
    l.push(dv);
    devisEnCours.set(dv.compteId, l);
  }

  const lastEchange = new Map<string, string>();
  for (const e of data.echanges) {
    const prev = lastEchange.get(e.compteId);
    if (!prev || e.date > prev) lastEchange.set(e.compteId, e.date);
  }

  const infos = new Map<string, CompteInfo>();
  for (const c of data.comptes) {
    const vs = visitesParCompte.get(c.id) ?? [];
    const last = vs.length ? vs[vs.length - 1].debut.slice(0, 10) : undefined;
    const caE = ca.get(c.id) ?? { a12: 0, a6: 0, p6: 0 };
    const partial = { derniereVisite: last, ca6m: caE.a6, caPrec6m: caE.p6 };
    const activites = [last, lastEchange.get(c.id), c.etapeModifieeLe, c.creeLe].filter(Boolean) as string[];
    infos.set(c.id, {
      compte: c,
      derniereVisite: last,
      nbVisites12m: vs.filter((v) => v.debut >= d12).length,
      ca12m: caE.a12,
      ca6m: caE.a6,
      caPrec6m: caE.p6,
      devisEnCours: devisEnCours.get(c.id) ?? [],
      statut: computeStatut(c, partial, p, today),
      important: c.nature === 'client' && (c.important || caE.a12 >= p.seuilCAImportant),
      derniereActivite: activites.sort().at(-1),
    });
  }
  return { today, infos, visitesParCompte };
}
