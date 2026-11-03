import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useData } from '../state/DataContext';
import { useProfil } from '../state/ProfilContext';
import { IconChart, IconFunnel, IconMap, IconRoute, IconSettings, IconTeam, IconToday } from './icons';

interface NavItem {
  to: string;
  label: string;
  court: string;
  icon: (p: { className?: string }) => JSX.Element;
}

const NAV_COMMERCIAL: NavItem[] = [
  { to: '/aujourdhui', label: "Tournée du jour", court: "Aujourd'hui", icon: IconToday },
  { to: '/carte', label: 'Carte', court: 'Carte', icon: IconMap },
  { to: '/planifier', label: 'Planifier', court: 'Planifier', icon: IconRoute },
  { to: '/prospection', label: 'Prospection', court: 'Prospects', icon: IconFunnel },
  { to: '/indicateurs', label: 'Indicateurs', court: 'Chiffres', icon: IconChart },
];

const NAV_MANAGER: NavItem[] = [
  { to: '/manager', label: 'Vue manager', court: 'Équipe', icon: IconTeam },
  { to: '/carte', label: 'Carte', court: 'Carte', icon: IconMap },
  { to: '/prospection', label: 'Prospection', court: 'Prospects', icon: IconFunnel },
  { to: '/indicateurs', label: 'Indicateurs', court: 'Chiffres', icon: IconChart },
];

function ProfilSelect() {
  const { data } = useData();
  const { profil, setProfil, commercial } = useProfil();
  const value = profil.kind === 'manager' ? 'manager' : (commercial?.id ?? '');
  return (
    <label className="flex items-center gap-2">
      <span className="hidden text-sm text-marine-100 sm:inline">Profil</span>
      <select
        aria-label="Profil"
        value={value}
        onChange={(e) =>
          setProfil(e.target.value === 'manager' ? { kind: 'manager' } : { kind: 'commercial', commercialId: e.target.value })
        }
        className="min-h-11 max-w-[60vw] rounded-lg border-2 border-white/30 bg-marine-800 px-2 font-semibold text-white"
      >
        <optgroup label="Commerciaux">
          {data.commerciaux.map((c) => {
            const s = data.secteurs.find((x) => x.id === c.secteurId);
            return (
              <option key={c.id} value={c.id}>
                {c.prenom} {c.nom} · {s?.nom}
              </option>
            );
          })}
        </optgroup>
        <option value="manager">Responsable commercial</option>
      </select>
    </label>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { isManager } = useProfil();
  const nav = isManager ? NAV_MANAGER : NAV_COMMERCIAL;
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 font-semibold ${isActive ? 'bg-marine-700 text-white' : 'text-slate-700 hover:bg-slate-200'}`;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 bg-marine-700 px-3 py-2 text-white shadow md:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-lg font-bold">Tournées</span>
          <span className="hidden rounded bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-marine-900 sm:inline">
            Prototype · données fictives
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ProfilSelect />
          <NavLink
            to="/parametres"
            aria-label="Paramètres"
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-marine-800"
          >
            <IconSettings />
          </NavLink>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-3 md:flex" aria-label="Navigation principale">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={linkCls}>
              <n.icon className="shrink-0" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-[1000] grid border-t border-slate-300 bg-white md:hidden"
        style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))`, paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navigation principale"
      >
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-marine-700' : 'text-slate-600'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`rounded-full px-4 py-1 ${isActive ? 'bg-marine-100' : ''}`}>
                  <n.icon />
                </span>
                {n.court}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
