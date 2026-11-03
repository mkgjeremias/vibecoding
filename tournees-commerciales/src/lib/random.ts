/** Générateur pseudo-aléatoire déterministe (mulberry32) pour un seed reproductible. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    float: (min: number, max: number) => next() * (max - min) + min,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    weighted: <T>(items: readonly T[], weight: (t: T) => number): T => {
      const total = items.reduce((s, i) => s + weight(i), 0);
      let r = next() * total;
      for (const i of items) {
        r -= weight(i);
        if (r <= 0) return i;
      }
      return items[items.length - 1];
    },
    shuffle: <T>(arr: T[]): T[] => {
      const a2 = [...arr];
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    },
  };
}
export type Rng = ReturnType<typeof createRng>;

let counter = 0;
/** Identifiant unique côté navigateur. */
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
