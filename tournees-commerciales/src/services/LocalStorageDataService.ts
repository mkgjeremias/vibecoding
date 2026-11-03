import type { Parametres } from '../domain/types';
import { generateSeed } from '../seed/generate';
import { PARAMETRES_DEFAUT } from './defaults';
import type { DataService, DataSnapshot } from './DataService';

const KEY = 'tournees-commerciales:v1';

type Collection = 'comptes' | 'visites' | 'echanges' | 'devis' | 'tournees';

export class LocalStorageDataService implements DataService {
  private cache: DataSnapshot | null = null;

  private read(): DataSnapshot | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as DataSnapshot;
      // Paramètres ajoutés après coup : on complète avec les valeurs par défaut.
      data.parametres = { ...PARAMETRES_DEFAUT, ...data.parametres };
      return data;
    } catch {
      return null;
    }
  }

  private write(data: DataSnapshot) {
    this.cache = data;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      // Stockage plein ou bloqué (navigation privée…) : l'application continue en mémoire.
      console.warn('Écriture localStorage impossible, données conservées en mémoire seulement', e);
    }
  }

  async load(): Promise<DataSnapshot> {
    if (this.cache) return this.cache;
    const existing = this.read();
    if (existing) {
      this.cache = existing;
      return existing;
    }
    return this.reset();
  }

  private async upsert<T extends { id: string }>(col: Collection, item: T): Promise<T> {
    const data = await this.load();
    const list = data[col] as unknown as T[];
    const i = list.findIndex((x) => x.id === item.id);
    const next = i >= 0 ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
    this.write({ ...data, [col]: next });
    return item;
  }

  saveCompte = (c: DataSnapshot['comptes'][number]) => this.upsert('comptes', c);
  saveVisite = (v: DataSnapshot['visites'][number]) => this.upsert('visites', v);
  saveEchange = (e: DataSnapshot['echanges'][number]) => this.upsert('echanges', e);
  saveDevis = (d: DataSnapshot['devis'][number]) => this.upsert('devis', d);
  saveTournee = (t: DataSnapshot['tournees'][number]) => this.upsert('tournees', t);

  async deleteTournee(id: string): Promise<void> {
    const data = await this.load();
    this.write({ ...data, tournees: data.tournees.filter((t) => t.id !== id) });
  }

  async saveParametres(p: Parametres): Promise<Parametres> {
    const data = await this.load();
    this.write({ ...data, parametres: p });
    return p;
  }

  async reset(): Promise<DataSnapshot> {
    const params = this.cache?.parametres ?? PARAMETRES_DEFAUT;
    const data = generateSeed(new Date(), { ...PARAMETRES_DEFAUT, coefRoutier: params.coefRoutier });
    this.write(data);
    return data;
  }
}
