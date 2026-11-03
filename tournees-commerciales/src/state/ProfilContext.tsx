import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Commercial, Profil } from '../domain/types';
import { isoDay } from '../lib/format';
import { prochainJourOuvre } from '../features/tournee/tourneeUtils';
import { useData } from './DataContext';

const KEY = 'tournees-commerciales:profil';

interface ProfilValue {
  profil: Profil;
  setProfil(p: Profil): void;
  /** Commercial courant, ou undefined pour le responsable. */
  commercial?: Commercial;
  isManager: boolean;
  /** Date de la tournée en préparation (écran Planifier, bouton « ajouter à la tournée »). */
  datePlanif: string;
  setDatePlanif(d: string): void;
}

const Ctx = createContext<ProfilValue | null>(null);

function readProfil(): Profil | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profil) : null;
  } catch {
    return null;
  }
}

export function ProfilProvider({ children }: { children: ReactNode }) {
  const { data } = useData();
  const [profil, setProfil] = useState<Profil>(
    () => readProfil() ?? { kind: 'commercial', commercialId: data.commerciaux[0].id },
  );

  const [datePlanif, setDatePlanif] = useState(() => isoDay(prochainJourOuvre()));

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(profil));
    } catch {
      /* préférence non essentielle */
    }
  }, [profil]);

  const value = useMemo<ProfilValue>(() => {
    const commercial =
      profil.kind === 'commercial' ? data.commerciaux.find((c) => c.id === profil.commercialId) : undefined;
    // profil invalide après réinitialisation : retour au premier commercial
    if (profil.kind === 'commercial' && !commercial) {
      return { profil, setProfil, commercial: data.commerciaux[0], isManager: false, datePlanif, setDatePlanif };
    }
    return { profil, setProfil, commercial, isManager: profil.kind === 'manager', datePlanif, setDatePlanif };
  }, [profil, data.commerciaux, datePlanif]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfil(): ProfilValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProfil hors ProfilProvider');
  return v;
}
