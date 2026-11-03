import { describe, expect, it } from 'vitest';
import { nearestNeighbor, optimizeOrder, tourCost, twoOpt } from './optimizer';
import { computeSchedule } from './schedule';
import { haversineKm, distancePointSegmentKm } from './geo';

function euclid(points: [number, number][]) {
  return points.map((a) => points.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1])));
}

describe('optimiseur', () => {
  it('visite chaque point une seule fois', () => {
    const pts: [number, number][] = [[0, 0], [5, 1], [1, 4], [6, 6], [2, 2], [8, 3], [3, 7]];
    const order = optimizeOrder(euclid(pts));
    expect([...order].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('2-opt ne dégrade jamais le plus proche voisin', () => {
    for (let seed = 1; seed < 30; seed++) {
      let s = seed;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const pts: [number, number][] = Array.from({ length: 12 }, () => [rnd() * 100, rnd() * 100]);
      const c = euclid(pts);
      const nn = nearestNeighbor(c);
      const opt = twoOpt(nn, c);
      expect(tourCost(opt, c)).toBeLessThanOrEqual(tourCost(nn, c) + 1e-9);
    }
  });

  it('trouve le tour optimal sur un carré', () => {
    // dépôt en (0,0), points aux coins : le tour optimal est le périmètre (40)
    const pts: [number, number][] = [[0, 0], [10, 10], [0, 10], [10, 0]];
    const c = euclid(pts);
    expect(tourCost(optimizeOrder(c), c)).toBeCloseTo(40);
  });
});

describe('géométrie', () => {
  it('Haversine Paris-Lyon ≈ 392 km', () => {
    const d = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 });
    expect(d).toBeGreaterThan(385);
    expect(d).toBeLessThan(400);
  });
  it('distance point-segment nulle sur le segment', () => {
    const a = { lat: 48, lng: -1.5 };
    const b = { lat: 48, lng: -1.0 };
    expect(distancePointSegmentKm({ lat: 48, lng: -1.25 }, a, b)).toBeLessThan(0.01);
  });
});

describe('planning', () => {
  it('insère la pause déjeuner et calcule le retour', () => {
    const m = { km: [[0, 60, 60], [60, 0, 30], [60, 30, 0]], minutes: [[0, 60, 60], [60, 0, 30], [60, 30, 0]] };
    const s = computeSchedule(m, [{ index: 1, dureeMin: 120 }, { index: 2, dureeMin: 60 }], {
      departMin: 8 * 60,
      pause: { debutMin: 12 * 60, dureeMin: 60 },
    });
    // 8h + 60 -> 9h, rdv jusqu'à 11h, +30 -> 11h30 (pas de pause), rdv -> 12h30, retour +60 -> 13h30
    expect(s.stops[1].arriveeMin).toBe(11 * 60 + 30);
    expect(s.stops[1].pauseAvantMin).toBe(0);
    expect(s.retour.arriveeMin).toBe(13 * 60 + 30);
    expect(s.totalKm).toBe(150);
  });
});
