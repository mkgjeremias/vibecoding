/*
 * Ordre de passage d'un circuit partant du domicile (index 0 de la matrice) et y revenant.
 * 1. Plus proche voisin : premier ordre glouton.
 * 2. 2-opt : on inverse des portions du circuit tant que cela le raccourcit.
 * Ne dépend que d'une matrice de coûts : indépendant du fournisseur de distances.
 */
window.TC = window.TC || {};
(function (TC) {
  'use strict';
  const routing = TC.routing || {};

  routing.tourCost = function (order, cost) {
    let total = 0;
    let prev = 0;
    for (const i of order) {
      total += cost[prev][i];
      prev = i;
    }
    return total + cost[prev][0];
  };

  routing.nearestNeighbor = function (cost) {
    const n = cost.length;
    const visited = new Array(n).fill(false);
    visited[0] = true;
    const order = [];
    let current = 0;
    for (let step = 1; step < n; step++) {
      let best = -1;
      let bestCost = Infinity;
      for (let j = 1; j < n; j++) {
        if (!visited[j] && cost[current][j] < bestCost) {
          best = j;
          bestCost = cost[current][j];
        }
      }
      visited[best] = true;
      order.push(best);
      current = best;
    }
    return order;
  };

  routing.twoOpt = function (initial, cost, maxIterations) {
    const route = [0, ...initial, 0];
    const n = route.length;
    let improved = true;
    let iter = 0;
    while (improved && iter < (maxIterations || 1000)) {
      improved = false;
      iter++;
      for (let i = 1; i < n - 2; i++) {
        for (let k = i + 1; k < n - 1; k++) {
          const a = route[i - 1], b = route[i], c = route[k], d = route[k + 1];
          if (cost[a][c] + cost[b][d] - cost[a][b] - cost[c][d] < -1e-9) {
            for (let l = i, r = k; l < r; l++, r--) [route[l], route[r]] = [route[r], route[l]];
            improved = true;
          }
        }
      }
    }
    return route.slice(1, -1);
  };

  /** Ordre optimisé des points 1..n-1 (0 = domicile). */
  routing.optimizeOrder = function (cost) {
    if (cost.length <= 2) return cost.length === 2 ? [1] : [];
    return routing.twoOpt(routing.nearestNeighbor(cost), cost);
  };

  /** Position (dans `ordre`, liste d'indices de matrice) où insérer `p` au moindre détour, circuit fermé sur 0. */
  routing.meilleureInsertion = function (ordre, p, cost) {
    const route = [0, ...ordre, 0];
    let best = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < route.length - 1; i++) {
      const delta = cost[route[i]][p] + cost[p][route[i + 1]] - cost[route[i]][route[i + 1]];
      if (delta < bestDelta) {
        bestDelta = delta;
        best = i;
      }
    }
    return best;
  };

  TC.routing = routing;
})(window.TC);
