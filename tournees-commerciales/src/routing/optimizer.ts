/**
 * Optimisation d'un circuit fermé partant et revenant au dépôt (index 0 de la matrice).
 * Indépendant du fournisseur de distances : ne travaille que sur une matrice de coûts.
 *
 * 1. Plus proche voisin : construction gloutonne d'un premier ordre.
 * 2. 2-opt : on inverse des sous-séquences tant que cela raccourcit le circuit.
 */

export function tourCost(order: number[], cost: number[][]): number {
  // order ne contient pas le dépôt ; circuit = 0 -> order... -> 0
  let total = 0;
  let prev = 0;
  for (const i of order) {
    total += cost[prev][i];
    prev = i;
  }
  return total + cost[prev][0];
}

export function nearestNeighbor(cost: number[][]): number[] {
  const n = cost.length;
  const visited = new Array(n).fill(false);
  visited[0] = true;
  const order: number[] = [];
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
}

/** Améliore un ordre par 2-opt (première amélioration trouvée, jusqu'à stabilité). */
export function twoOpt(initial: number[], cost: number[][], maxIterations = 1000): number[] {
  // Travaille sur le circuit complet [0, ...order, 0]
  const route = [0, ...initial, 0];
  const n = route.length;
  let improved = true;
  let iter = 0;
  const EPS = 1e-9;
  while (improved && iter < maxIterations) {
    improved = false;
    iter++;
    for (let i = 1; i < n - 2; i++) {
      for (let k = i + 1; k < n - 1; k++) {
        const a = route[i - 1];
        const b = route[i];
        const c = route[k];
        const d = route[k + 1];
        const delta = cost[a][c] + cost[b][d] - cost[a][b] - cost[c][d];
        if (delta < -EPS) {
          // inversion du segment [i..k]
          for (let l = i, r = k; l < r; l++, r--) {
            [route[l], route[r]] = [route[r], route[l]];
          }
          improved = true;
        }
      }
    }
  }
  return route.slice(1, -1);
}

/** Ordre optimisé des points 1..n-1 (le 0 est le dépôt). */
export function optimizeOrder(cost: number[][]): number[] {
  if (cost.length <= 2) return cost.length === 2 ? [1] : [];
  return twoOpt(nearestNeighbor(cost), cost);
}
