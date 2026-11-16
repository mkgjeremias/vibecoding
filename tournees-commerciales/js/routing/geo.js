/* Géométrie : distances à vol d'oiseau et détection des traversées d'estuaire. */
window.TC = window.TC || {};
(function (TC) {
  'use strict';
  const R = 6371; // rayon terrestre moyen (km)
  const rad = (d) => (d * Math.PI) / 180;
  const G = {};

  /** Distance orthodromique (vol d'oiseau) en km. */
  G.haversineKm = function (a, b) {
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  /** Distance (km) d'un point au segment [a, b], projection plane locale. */
  G.distancePointSegmentKm = function (p, a, b) {
    const lat0 = rad((a.lat + b.lat + p.lat) / 3);
    const xy = (q) => ({ x: rad(q.lng) * Math.cos(lat0) * R, y: rad(q.lat) * R });
    const P = xy(p), A = xy(a), B = xy(b);
    const dx = B.x - A.x, dy = B.y - A.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(P.x - (A.x + t * dx), P.y - (A.y + t * dy));
  };

  /** Distance minimale (km) d'un point à une polyligne. */
  G.distancePointPolylineKm = function (p, line) {
    if (line.length === 0) return Infinity;
    if (line.length === 1) return G.haversineKm(p, line[0]);
    let best = Infinity;
    for (let i = 0; i < line.length - 1; i++) best = Math.min(best, G.distancePointSegmentKm(p, line[i], line[i + 1]));
    return best;
  };

  /** true si les segments [a,b] et [c,d] se croisent (plan lat/lng, suffisant à cette échelle). */
  G.segmentsSeCroisent = function (a, b, c, d) {
    const o = (p, q, r) => Math.sign((q.lng - p.lng) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lng - p.lng));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  };

  /**
   * Estuaires sans pont sur une longue distance : le vol d'oiseau y sous-estime fortement le trajet réel
   * (bac ou grand détour). Tracés simplifiés le long du lit, de l'embouchure au premier pont routier.
   */
  G.ESTUAIRES = [
    {
      nom: 'estuaire de la Gironde',
      trace: [
        { lat: 45.6, lng: -1.07 },
        { lat: 45.42, lng: -0.93 },
        { lat: 45.2, lng: -0.75 },
        { lat: 45.03, lng: -0.58 },
      ],
    },
    {
      // en aval du pont de Saint-Nazaire jusqu'au pont de Cheviré (Nantes)
      nom: 'estuaire de la Loire',
      trace: [
        { lat: 47.27, lng: -2.15 },
        { lat: 47.31, lng: -2.05 },
        { lat: 47.27, lng: -1.88 },
        { lat: 47.2, lng: -1.76 },
        { lat: 47.19, lng: -1.62 },
      ],
    },
  ];

  /** Nom de l'estuaire traversé par le trajet a → b, ou null. */
  G.estuaireTraverse = function (a, b) {
    for (const e of G.ESTUAIRES) {
      for (let i = 0; i < e.trace.length - 1; i++) {
        if (G.segmentsSeCroisent(a, b, e.trace[i], e.trace[i + 1])) return e.nom;
      }
    }
    return null;
  };

  /** Point situé en Corse (rectangle englobant l'île). */
  G.estCorse = (p) => p.lat > 41.3 && p.lat < 43.1 && p.lng > 8.5 && p.lng < 9.65;

  TC.geo = G;
})(window.TC);
