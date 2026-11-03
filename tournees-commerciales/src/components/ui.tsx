import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { STATUT_COULEUR, STATUT_LABEL } from '../domain/labels';
import type { StatutCompte } from '../domain/types';
import { getRoutingProvider } from '../routing';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-marine-700 text-white hover:bg-marine-800 disabled:bg-slate-400',
  secondary: 'bg-white text-marine-800 border-2 border-marine-700 hover:bg-marine-50 disabled:opacity-50',
  ghost: 'bg-transparent text-marine-800 hover:bg-marine-100',
  danger: 'bg-red-700 text-white hover:bg-red-800',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'min-h-14 px-5 text-lg' : size === 'sm' ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-4';
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed ${s} ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-marine-900">{children}</h1>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatutBadge({ statut }: { statut: StatutCompte }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUT_COULEUR[statut] }} />
      {STATUT_LABEL[statut]}
    </span>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'amber' | 'red' | 'green' | 'blue' }) {
  const t = {
    slate: 'bg-slate-100 text-slate-800',
    amber: 'bg-amber-100 text-amber-900',
    red: 'bg-red-100 text-red-800',
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
  }[tone];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

/** Mention obligatoire sur tout écran affichant des distances ou des horaires. */
export function EstimationNote({ className = '' }: { className?: string }) {
  const p = getRoutingProvider();
  if (!p.isEstimate) return null;
  return (
    <p className={`rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 ${className}`}>
      <strong>Estimations.</strong> Distances calculées à vol d'oiseau × coefficient routier, temps à vitesse moyenne
      constante. Ni trafic, ni réseau routier réel.
    </p>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-600">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full min-h-11 rounded-lg border-2 border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-marine-600 focus:outline-none';

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-600">{children}</p>;
}
