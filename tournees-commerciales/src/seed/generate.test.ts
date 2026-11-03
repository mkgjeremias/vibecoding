import { describe, expect, it } from 'vitest';
import { generateSeed } from './generate';
import { PARAMETRES_DEFAUT } from '../services/defaults';

describe('seed', () => {
  const today = new Date('2026-11-03T10:00:00');
  const data = generateSeed(today, PARAMETRES_DEFAUT);
  it('volumes attendus', () => {
    expect(data.commerciaux).toHaveLength(4);
    expect(data.comptes.filter((c) => c.nature === 'client')).toHaveLength(250);
    expect(data.comptes.filter((c) => c.nature === 'prospect')).toHaveLength(150);
    expect(data.visites.length).toBeGreaterThan(1500);
  });
  it('déterministe', () => {
    const b = generateSeed(today, PARAMETRES_DEFAUT);
    expect(JSON.stringify(b.comptes)).toBe(JSON.stringify(data.comptes));
  });
});
