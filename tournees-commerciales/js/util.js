/* Outils communs : dates, formats, aléatoire déterministe. Aucune dépendance. */
window.TC = window.TC || {};
(function (TC) {
  'use strict';
  const U = {};

  /** Générateur pseudo-aléatoire déterministe (mulberry32) : même graine = mêmes données. */
  U.rng = function (seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const r = {
      next,
      int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
      float: (min, max) => next() * (max - min) + min,
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      weighted: (items, weight) => {
        const total = items.reduce((s, i) => s + weight(i), 0);
        let x = next() * total;
        for (const i of items) {
          x -= weight(i);
          if (x <= 0) return i;
        }
        return items[items.length - 1];
      },
    };
    return r;
  };

  let counter = 0;
  U.uid = (prefix) => {
    counter += 1;
    return prefix + '_' + Date.now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 6);
  };

  // ---------- Dates (toujours en heure locale, format ISO "AAAA-MM-JJ")
  const pad = (n) => String(n).padStart(2, '0');
  U.isoDay = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  U.isoDateTime = (d) => U.isoDay(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00';
  U.parseDay = (s) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  U.addDays = (d, n) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  };
  U.startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  /** Nombre de jours calendaires de a à b. */
  U.daysBetween = (a, b) =>
    Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  U.joursDepuis = (iso, today) => (iso ? U.daysBetween(U.parseDay(iso), today) : Infinity);
  /** Jours de tournée : du mardi au vendredi (le lundi est au bureau). */
  U.estJourTournee = (d) => d.getDay() >= 2 && d.getDay() <= 5;
  U.prochainJourTournee = (d, inclus) => {
    let x = inclus ? U.startOfDay(d) : U.addDays(d, 1);
    while (!U.estJourTournee(x)) x = U.addDays(x, 1);
    return x;
  };

  U.hhmmToMin = (s) => {
    const [h, m] = String(s).split(':').map(Number);
    return h * 60 + (m || 0);
  };
  U.minToHhmm = (min) => {
    const m = Math.round(min);
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  };

  // ---------- Formats d'affichage
  const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const n0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const n1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  U.fmtEuro = (n) => euro.format(n);
  U.fmtKm = (n) => (n < 10 ? n1.format(n) : n0.format(n)) + ' km';
  U.fmtNombre = (n) => n0.format(n);
  U.fmtHeure = (min) => {
    const m = Math.round(min);
    return Math.floor(m / 60) + 'h' + pad(m % 60);
  };
  U.fmtDuree = (min) => {
    const m = Math.round(min);
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r === 0 ? h + ' h' : h + ' h ' + pad(r);
  };
  U.fmtDate = (iso) => {
    const d = U.parseDay(iso);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  };
  U.fmtDateLongue = (iso) =>
    U.parseDay(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  U.fmtDateCourte = (iso) => U.parseDay(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  U.fmtAnciennete = (iso, today) => {
    if (!iso) return 'jamais';
    const n = U.joursDepuis(iso, today);
    if (n <= 0) return "aujourd'hui";
    if (n === 1) return 'hier';
    if (n < 60) return 'il y a ' + n + ' j';
    return 'il y a ' + Math.round(n / 30) + ' mois';
  };

  /** "1 visite", "3 visites". */
  U.nb = (n, mot, pluriel) => n + ' ' + (n > 1 ? pluriel || mot + 's' : mot);

  /** Échappement HTML pour les gabarits. */
  U.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  TC.util = U;
})(window.TC);
