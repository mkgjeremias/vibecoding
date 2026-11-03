import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nombre1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nombre0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });

export const fmtEuro = (n: number) => euro.format(n);
export const fmtKm = (n: number) => `${n < 10 ? nombre1.format(n) : nombre0.format(n)} km`;
export const fmtNombre = (n: number) => nombre0.format(n);
export const fmtPct = (n: number) => pct.format(n);

const toDate = (d: string | Date) => (typeof d === 'string' ? parseISO(d) : d);

export const fmtDate = (d: string | Date) => format(toDate(d), 'dd/MM/yyyy', { locale: fr });
export const fmtDateCourte = (d: string | Date) => format(toDate(d), 'd MMM', { locale: fr });
export const fmtDateLongue = (d: string | Date) => format(toDate(d), 'EEEE d MMMM yyyy', { locale: fr });
export const fmtHeure = (d: string | Date) => format(toDate(d), "HH'h'mm", { locale: fr });

export function fmtDuree(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, '0')}`;
}

/** "il y a 12 j", "aujourd'hui", "jamais". */
export function fmtAnciennete(d: string | undefined, today: Date = new Date()): string {
  if (!d) return 'jamais';
  const n = differenceInCalendarDays(today, toDate(d));
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  if (n < 60) return `il y a ${n} j`;
  return `il y a ${Math.round(n / 30)} mois`;
}

export function joursDepuis(d: string | undefined, today: Date = new Date()): number {
  if (!d) return Infinity;
  return differenceInCalendarDays(today, toDate(d));
}

/** Date locale au format ISO "yyyy-MM-dd" (sans décalage UTC). */
export const isoDay = (d: Date) => format(d, 'yyyy-MM-dd');
export const isoDateTime = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss");

/** "08:30" -> minutes depuis minuit. */
export function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}
export function minToHhmm(min: number): string {
  const m = Math.round(min);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export const fmtHeureMin = (min: number) => minToHhmm(min).replace(':', 'h');
