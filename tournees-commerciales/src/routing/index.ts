/**
 * Point d'entrée unique du calcul d'itinéraire.
 * Pour brancher une vraie API : créer une classe qui implémente RoutingProvider
 * et la retourner dans getRoutingProvider(). Rien d'autre à modifier dans les écrans.
 */
import type { LatLng } from '../domain/types';
import { HaversineProvider, haversineMatrix } from './haversineProvider';
import { haversineKm as haversineKmLocal } from './geo';
import { optimizeOrder } from './optimizer';
import { computeSchedule, type Schedule, type ScheduleParams } from './schedule';
import type { CostMatrix, RoutingOptions, RoutingProvider } from './types';

export type { CostMatrix, RoutingOptions, RoutingProvider, Schedule, ScheduleParams };
export { computeSchedule, optimizeOrder };
export { haversineKm, distancePointPolylineKm } from './geo';

let optionsGetter: () => RoutingOptions = () => ({ coefRoutier: 1.3, vitesseMoyenneKmh: 60 });
let provider: RoutingProvider = new HaversineProvider(() => optionsGetter());

export function configureRouting(getOptions: () => RoutingOptions) {
  optionsGetter = getOptions;
}

export function getRoutingProvider(): RoutingProvider {
  return provider;
}

/** Permet de remplacer le fournisseur (tests, future API). */
export function setRoutingProvider(p: RoutingProvider) {
  provider = p;
}

/**
 * Estimation synchrone, utilisée pour les indicateurs historiques (km des journées passées).
 * Volontairement locale : appeler une API pour des milliers de journées passées n'aurait pas de sens.
 */
export function estimateCircuitKm(points: LatLng[]): number {
  if (points.length < 2) return 0;
  const m = haversineMatrix(points, optionsGetter());
  let km = 0;
  for (let i = 0; i < points.length - 1; i++) km += m.km[i][i + 1];
  return km;
}

export interface OptimizedTour {
  /** Indices des étapes (0-based dans le tableau `stops` fourni) dans l'ordre optimisé. */
  order: number[];
  matrix: CostMatrix;
}

/** Calcule l'ordre de passage optimisé depuis `depot` avec retour. */
export async function optimizeTour(depot: LatLng, stops: LatLng[]): Promise<OptimizedTour> {
  const matrix = await provider.matrix([depot, ...stops]);
  const order = optimizeOrder(matrix.km).map((i) => i - 1);
  return { order, matrix };
}

/**
 * Détour (km estimés) pour insérer `p` au meilleur endroit d'un circuit `route` (premier et dernier point = domicile).
 * Insertion la moins coûteuse : min sur les segments de d(a,p) + d(p,b) − d(a,b).
 */
export function estimateDetourKm(route: LatLng[], p: LatLng): number {
  const { coefRoutier } = optionsGetter();
  if (route.length < 2) return 0;
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const d = haversineKmLocal(a, p) + haversineKmLocal(p, b) - haversineKmLocal(a, b);
    if (d < best) best = d;
  }
  return Math.max(0, best * coefRoutier);
}
