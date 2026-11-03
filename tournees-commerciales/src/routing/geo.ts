import type { LatLng } from '../domain/types';

const R = 6371; // rayon terrestre moyen en km

const rad = (d: number) => (d * Math.PI) / 180;

/** Distance orthodromique (vol d'oiseau) en km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distance (km, vol d'oiseau) d'un point à un segment [a, b].
 * Projection équirectangulaire locale : précise à quelques mètres près sur les échelles d'une tournée.
 */
export function distancePointSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  const lat0 = rad((a.lat + b.lat + p.lat) / 3);
  const toXY = (q: LatLng) => ({ x: rad(q.lng) * Math.cos(lat0) * R, y: rad(q.lat) * R });
  const P = toXY(p);
  const A = toXY(a);
  const B = toXY(b);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = A.x + t * dx;
  const cy = A.y + t * dy;
  return Math.hypot(P.x - cx, P.y - cy);
}

/** Distance minimale (km) d'un point à une polyligne. */
export function distancePointPolylineKm(p: LatLng, line: LatLng[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return haversineKm(p, line[0]);
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    best = Math.min(best, distancePointSegmentKm(p, line[i], line[i + 1]));
  }
  return best;
}
