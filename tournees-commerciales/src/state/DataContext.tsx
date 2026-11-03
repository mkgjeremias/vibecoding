import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { derive, type Derived } from '../domain/derive';
import type { Compte, Devis, Echange, Parametres, Tournee, Visite } from '../domain/types';
import { configureRouting } from '../routing';
import { dataService, type DataSnapshot } from '../services';

interface DataContextValue {
  data: DataSnapshot;
  derived: Derived;
  saveCompte(c: Compte): Promise<void>;
  saveVisite(v: Visite): Promise<void>;
  saveEchange(e: Echange): Promise<void>;
  saveDevis(d: Devis): Promise<void>;
  saveTournee(t: Tournee): Promise<void>;
  deleteTournee(id: string): Promise<void>;
  saveParametres(p: Parametres): Promise<void>;
  reset(): Promise<void>;
}

const Ctx = createContext<DataContextValue | null>(null);

/**
 * Charge les données via la couche de services et les expose aux écrans.
 * Les écrans n'accèdent jamais directement au stockage.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paramsRef = useRef<Parametres | null>(null);

  useEffect(() => {
    configureRouting(() => ({
      coefRoutier: paramsRef.current?.coefRoutier ?? 1.3,
      vitesseMoyenneKmh: paramsRef.current?.vitesseMoyenneKmh ?? 60,
    }));
    dataService.load().then(setData, (e) => setError(String(e)));
  }, []);

  if (data) paramsRef.current = data.parametres;

  const refresh = useCallback(async () => setData({ ...(await dataService.load()) }), []);
  const wrap = useCallback(
    <A,>(fn: (a: A) => Promise<unknown>) =>
      async (a: A) => {
        try {
          await fn(a);
          await refresh();
        } catch (e) {
          console.error(e);
        }
      },
    [refresh],
  );

  const derived = useMemo(() => (data ? derive(data) : null), [data]);

  const value = useMemo<DataContextValue | null>(() => {
    if (!data || !derived) return null;
    return {
      data,
      derived,
      saveCompte: wrap((c: Compte) => dataService.saveCompte(c)),
      saveVisite: wrap((v: Visite) => dataService.saveVisite(v)),
      saveEchange: wrap((e: Echange) => dataService.saveEchange(e)),
      saveDevis: wrap((d: Devis) => dataService.saveDevis(d)),
      saveTournee: wrap((t: Tournee) => dataService.saveTournee(t)),
      deleteTournee: wrap((id: string) => dataService.deleteTournee(id)),
      saveParametres: wrap((p: Parametres) => dataService.saveParametres(p)),
      reset: async () => setData({ ...(await dataService.reset()) }),
    };
  }, [data, derived, wrap]);

  if (error) return <div className="p-6 text-red-700">Erreur de chargement des données : {error}</div>;
  if (!value) return <div className="p-6 text-slate-600">Chargement des données…</div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData hors DataProvider');
  return v;
}
