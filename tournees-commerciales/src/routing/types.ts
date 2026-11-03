import type { LatLng } from '../domain/types';

/** Matrice de coûts entre points : km[i][j] et minutes[i][j]. */
export interface CostMatrix {
  km: number[][];
  minutes: number[][];
}

/**
 * Contrat d'un fournisseur de calcul d'itinéraire.
 * L'implémentation actuelle (HaversineProvider) est une estimation locale.
 * Une implémentation future (OSRM, GraphHopper, API commerciale…) doit seulement respecter cette interface.
 */
export interface RoutingProvider {
  readonly id: string;
  readonly label: string;
  /** true si les valeurs sont des estimations (à signaler dans l'interface). */
  readonly isEstimate: boolean;
  /** Matrice complète des distances / temps entre tous les points. */
  matrix(points: LatLng[]): Promise<CostMatrix>;
  /** Tracé d'un trajet complet (pour la carte). Par défaut : lignes droites entre les points. */
  geometry(points: LatLng[]): Promise<LatLng[]>;
}

export interface RoutingOptions {
  coefRoutier: number;
  vitesseMoyenneKmh: number;
}
