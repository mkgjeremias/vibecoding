import type { LatLng } from '../domain/types';
import { haversineKm } from './geo';
import type { CostMatrix, RoutingOptions, RoutingProvider } from './types';

/** Estimation hors ligne : vol d'oiseau × coefficient routier, temps = distance / vitesse moyenne. */
export function haversineMatrix(points: LatLng[], opts: RoutingOptions): CostMatrix {
  const n = points.length;
  const km: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const minutes: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineKm(points[i], points[j]) * opts.coefRoutier;
      const t = (d / opts.vitesseMoyenneKmh) * 60;
      km[i][j] = km[j][i] = d;
      minutes[i][j] = minutes[j][i] = t;
    }
  }
  return { km, minutes };
}

export class HaversineProvider implements RoutingProvider {
  readonly id = 'haversine';
  readonly label = "Estimation à vol d'oiseau corrigée";
  readonly isEstimate = true;

  constructor(private readonly getOptions: () => RoutingOptions) {}

  async matrix(points: LatLng[]): Promise<CostMatrix> {
    return haversineMatrix(points, this.getOptions());
  }

  async geometry(points: LatLng[]): Promise<LatLng[]> {
    return points;
  }
}
