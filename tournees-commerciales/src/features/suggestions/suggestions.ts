/**
 * Suggestions de comptes à ajouter à une tournée.
 * Critère géographique : distance (vol d'oiseau) au tracé de la tournée ≤ rayon X.
 * Classement : score de priorité transparent, détaillé en motifs lisibles.
 */
import type { CompteInfo } from '../../domain/derive';
import type { LatLng } from '../../domain/types';
import { fmtEuro, joursDepuis } from '../../lib/format';
import { distancePointPolylineKm, estimateDetourKm } from '../../routing';

export interface Suggestion {
  info: CompteInfo;
  distanceTraceKm: number;
  detourKm: number;
  score: number;
  motifs: string[];
}

export const POIDS = {
  /** Jusqu'à 40 points selon l'ancienneté de la dernière visite (plafond à 180 jours). */
  anciennete: 40,
  devisEnCours: 30,
  potentiel: { A: 25, B: 12, C: 0 },
  statutAlerte: 10,
};

export function prioriser(info: CompteInfo, today: Date): { score: number; motifs: string[] } {
  const c = info.compte;
  const motifs: string[] = [];
  let score = 0;

  const j = joursDepuis(info.derniereVisite, today);
  const ratio = Math.min(1, (j === Infinity ? 180 : j) / 180);
  score += ratio * POIDS.anciennete;
  if (j === Infinity) motifs.push('Jamais visité');
  else if (j >= 60) motifs.push(`Non visité depuis ${j} j`);

  if (info.devisEnCours.length > 0) {
    score += POIDS.devisEnCours;
    const total = info.devisEnCours.reduce((s, d) => s + d.montantHT, 0);
    motifs.push(`Devis en cours (${fmtEuro(total)})`);
  }

  if (c.nature === 'client') {
    score += POIDS.potentiel[c.potentiel];
    if (c.potentiel === 'A') motifs.push('Fort potentiel');
  } else {
    score += ((c.score ?? 0) / 100) * POIDS.potentiel.A;
    if ((c.score ?? 0) >= 60) motifs.push(`Score prospect ${c.score}`);
  }

  if (info.statut === 'client_risque' || info.statut === 'prospect_chaud') {
    score += POIDS.statutAlerte;
    motifs.push(info.statut === 'client_risque' ? 'Client à risque' : 'Prospect chaud');
  }

  return { score: Math.round(score), motifs };
}

export function suggerer(params: {
  route: LatLng[]; // domicile, étapes…, domicile
  candidats: CompteInfo[];
  exclus: Set<string>;
  rayonKm: number;
  today: Date;
}): Suggestion[] {
  const { route, candidats, exclus, rayonKm, today } = params;
  if (route.length < 2) return [];
  const out: Suggestion[] = [];
  for (const info of candidats) {
    const c = info.compte;
    if (exclus.has(c.id)) continue;
    if (c.etape === 'perdu' || c.etape === 'gagne') continue;
    const d = distancePointPolylineKm(c, route);
    if (d > rayonKm) continue;
    const { score, motifs } = prioriser(info, today);
    out.push({ info, distanceTraceKm: d, detourKm: estimateDetourKm(route, c), score, motifs });
  }
  return out.sort((a, b) => b.score - a.score || a.detourKm - b.detourKm);
}
