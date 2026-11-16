/*
 * Fournisseur de distances et de temps de trajet.
 *
 * Point de branchement : pour utiliser une vraie API routière (OSRM, GraphHopper…),
 * écrire un objet qui respecte le même contrat que TC.routing.haversineProvider
 * puis appeler TC.routing.setProvider(monFournisseur). Rien d'autre à modifier.
 *
 * Contrat :
 *   id, label        identifiant et libellé affiché
 *   isEstimate       true si les valeurs sont des estimations (mention affichée dans l'interface)
 *   matrix(points, { coefRoutier, vitesseMoyenneKmh })
 *                    -> { km: number[][], minutes: number[][] } (temps de conduite SANS marge)
 *
 * Le contrat est synchrone pour garder l'application simple. Une API distante devra précalculer
 * ses matrices (ou rendre ce contrat asynchrone).
 */
window.TC = window.TC || {};
(function (TC) {
  'use strict';
  const routing = TC.routing || {};

  routing.haversineProvider = {
    id: 'haversine',
    label: "vol d'oiseau corrigé",
    isEstimate: true,
    matrix(points, opts) {
      const n = points.length;
      const km = Array.from({ length: n }, () => new Array(n).fill(0));
      const minutes = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const d = TC.geo.haversineKm(points[i], points[j]) * opts.coefRoutier;
          km[i][j] = km[j][i] = d;
          minutes[i][j] = minutes[j][i] = (d / opts.vitesseMoyenneKmh) * 60;
        }
      }
      return { km, minutes };
    },
  };

  let provider = routing.haversineProvider;
  routing.getProvider = () => provider;
  routing.setProvider = (p) => {
    provider = p;
  };

  /**
   * Matrice utilisée par le planning : km du fournisseur, et temps de trajet majorés de la marge (%).
   * minutesBrutes conserve le temps sans marge.
   */
  routing.matrix = function (points, params) {
    const m = provider.matrix(points, { coefRoutier: params.coefRoutier, vitesseMoyenneKmh: params.vitesseMoyenneKmh });
    const f = 1 + (params.margeTrajetPct || 0) / 100;
    return { km: m.km, minutesBrutes: m.minutes, minutes: m.minutes.map((row) => row.map((t) => t * f)) };
  };

  TC.routing = routing;
})(window.TC);
