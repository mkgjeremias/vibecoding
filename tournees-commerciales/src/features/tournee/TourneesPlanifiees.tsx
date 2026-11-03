import { useState } from 'react';
import type { Compte, Tournee } from '../../domain/types';
import { fmtDateLongue, isoDay } from '../../lib/format';

interface Props {
  tournees: Tournee[];
  commercialId: string;
  dateActive: string;
  comptes: Map<string, { compte: Compte }>;
  onOuvrir(date: string): void;
}

/** Tournées à venir du commercial (au moins une étape), pour les rouvrir d'un clic. */
export function TourneesPlanifiees({ tournees, commercialId, dateActive, comptes, onOuvrir }: Props) {
  const [ouvert, setOuvert] = useState(true);
  const today = isoDay(new Date());
  const aVenir = tournees
    .filter((t) => t.commercialId === commercialId && t.date >= today && t.etapes.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white">
      <button
        className="flex min-h-11 w-full items-center justify-between px-3 text-left font-semibold text-marine-900"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
      >
        <span>Tournées planifiées ({aVenir.length})</span>
        <span aria-hidden className="text-slate-500">{ouvert ? '▲' : '▼'}</span>
      </button>
      {ouvert &&
        (aVenir.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-slate-600">Aucune tournée à venir. Choisis une date et ajoute des étapes.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {aVenir.map((t) => {
              const communes = [...new Set(t.etapes.map((e) => comptes.get(e.compteId)?.compte.commune).filter(Boolean))];
              const active = t.date === dateActive;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => onOuvrir(t.date)}
                    aria-current={active ? 'true' : undefined}
                    className={`block w-full px-3 py-2 text-left ${active ? 'bg-marine-50 border-l-4 border-marine-700' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold first-letter:uppercase">
                        {t.date === today ? "Aujourd'hui" : fmtDateLongue(t.date)}
                      </span>
                      <span className="shrink-0 text-sm text-slate-600">
                        {t.etapes.length} étape{t.etapes.length > 1 ? 's' : ''} · {t.heureDepart.replace(':', 'h')}
                      </span>
                    </div>
                    <div className="truncate text-sm text-slate-600">{communes.join(', ')}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
