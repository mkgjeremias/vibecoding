/*
 * Planning d'une tournée : horaires proposés, pause déjeuner, marges, découpage sur plusieurs jours.
 * Fonctions pures : elles ne travaillent que sur une matrice { km, minutes } (minutes = trajet + marge).
 */
window.TC = window.TC || {};
(function (TC) {
  'use strict';
  const routing = TC.routing || {};
  const U = TC.util;

  /**
   * Horaires d'une journée.
   * @param m        matrice { km, minutes }
   * @param depuis   index du point de départ (0 = domicile, sinon lieu de la nuit précédente)
   * @param stops    [{ index, dureeMin }] dans l'ordre de passage
   * @param o        { departMin, pause: { debutMin, dureeMin } | null, retourDomicile: bool,
   *                   prospectionMin: number, arrondiMin: number }
   * Heures de rendez-vous arrondies au multiple supérieur de `arrondiMin` (prise de rendez-vous).
   * Pause : prise à l'arrivée chez le premier client atteint après l'heure de début de pause.
   */
  routing.planifierJournee = function (m, depuis, stops, o) {
    const arrondi = o.arrondiMin || 1;
    let clock = o.departMin;
    let prev = depuis;
    let pausePrise = !o.pause;
    let totalKm = 0, totalRouteMin = 0, totalRdvMin = 0;
    const out = [];
    for (const s of stops) {
      const legKm = m.km[prev][s.index];
      const legMin = m.minutes[prev][s.index];
      clock += legMin;
      const arrivee = clock;
      let pauseAvant = 0;
      if (!pausePrise && clock >= o.pause.debutMin) {
        pauseAvant = o.pause.dureeMin;
        clock += pauseAvant;
        pausePrise = true;
      }
      clock = Math.ceil(clock / arrondi - 1e-9) * arrondi;
      const debut = clock;
      clock += s.dureeMin;
      out.push({ index: s.index, legKm, legMin, arriveeMin: arrivee, pauseAvantMin: pauseAvant, debutRdvMin: debut, finRdvMin: clock });
      totalKm += legKm;
      totalRouteMin += legMin;
      totalRdvMin += s.dureeMin;
      prev = s.index;
    }
    let prospection = null;
    if (o.prospectionMin > 0 && stops.length) {
      prospection = { debutMin: clock, finMin: clock + o.prospectionMin };
      clock += o.prospectionMin;
    }
    let retour = null;
    if (o.retourDomicile) {
      const legKm = stops.length ? m.km[prev][0] : 0;
      const legMin = stops.length ? m.minutes[prev][0] : 0;
      clock += legMin;
      totalKm += legKm;
      totalRouteMin += legMin;
      retour = { legKm, legMin, arriveeMin: clock };
    }
    return { depuis, stops: out, prospection, retour, finMin: clock, totalKm, totalRouteMin, totalRdvMin };
  };

  function optionsJournee(params, prospection, retourDomicile) {
    return {
      departMin: U.hhmmToMin(params.heureDepart),
      pause: params.pauseActive ? { debutMin: U.hhmmToMin(params.pauseDebut), dureeMin: params.pauseDureeMin } : null,
      retourDomicile,
      prospectionMin: prospection ? params.dureeProspectionMin : 0,
      arrondiMin: 5,
    };
  }

  /** Heure de fin à ne pas dépasser pour garder le temps libre réservé. */
  routing.finUtileMin = (params) => U.hhmmToMin(params.heureLimiteRetour) - (params.tempsLibreMin || 0);

  /**
   * Découpe une liste ordonnée d'étapes en journées.
   * Glouton : on remplit chaque jour tant que la fin reste avant (heure limite − temps libre).
   * Jour intermédiaire : la journée s'arrête à la dernière visite (nuit sur place).
   * Dernier jour : retour au domicile compris.
   * @param prospection fonction (numéro de jour) -> bool
   */
  routing.decouperEnJours = function (m, stops, params, prospection) {
    const limite = routing.finUtileMin(params);
    const pros = prospection || (() => false);
    const jours = [];
    let cur = [];
    let depuis = 0;
    stops.forEach((s, i) => {
      const dernier = i === stops.length - 1;
      const essai = routing.planifierJournee(m, depuis, [...cur, s], optionsJournee(params, pros(jours.length), dernier));
      if (cur.length === 0 || essai.finMin <= limite) {
        cur.push(s);
      } else {
        jours.push(cur);
        depuis = cur[cur.length - 1].index;
        cur = [s];
      }
    });
    if (cur.length) jours.push(cur);
    return jours;
  };

  /**
   * Plan complet d'une tournée.
   * @param a { m, stops: [{ index, dureeMin }] (ordre de passage), params, multiJours, prospection: (jour) -> bool }
   * @returns { jours: [{ stops, planning }], totalKm, totalRouteMin, nbVisites }
   */
  routing.planifierTournee = function (a) {
    const pros = a.prospection || (() => false);
    const groupes = a.multiJours ? routing.decouperEnJours(a.m, a.stops, a.params, pros) : [a.stops];
    let depuis = 0;
    const jours = groupes.map((g, j) => {
      const dernier = j === groupes.length - 1;
      const planning = routing.planifierJournee(a.m, depuis, g, optionsJournee(a.params, pros(j), dernier));
      if (g.length) depuis = g[g.length - 1].index;
      return { stops: g, planning };
    });
    return {
      jours,
      totalKm: jours.reduce((s, j) => s + j.planning.totalKm, 0),
      totalRouteMin: jours.reduce((s, j) => s + j.planning.totalRouteMin, 0),
      nbVisites: a.stops.length,
    };
  };

  /**
   * Faut-il proposer un découpage sur plusieurs jours ?
   * Oui si une visite est à plus du seuil de route aller depuis le domicile (temps sans marge),
   * ou si la tournée sur une seule journée finit après l'heure limite de retour,
   * et à condition que le découpage donne réellement au moins deux jours.
   */
  routing.analyserDecoupage = function (m, stops, params, prospection) {
    const raisons = [];
    const brutes = m.minutesBrutes || m.minutes;
    const eloignes = stops.filter((s) => brutes[0][s.index] > params.seuilAllerMultiJoursMin);
    if (eloignes.length) {
      raisons.push({ type: 'eloigne', indices: eloignes.map((s) => s.index) });
    }
    const unJour = routing.planifierTournee({ m, stops, params, multiJours: false, prospection });
    const fin = unJour.jours[0].planning.finMin;
    if (stops.length && fin > U.hhmmToMin(params.heureLimiteRetour)) raisons.push({ type: 'retour', finMin: fin });
    const multi = routing.planifierTournee({ m, stops, params, multiJours: true, prospection });
    return { propose: raisons.length > 0 && multi.jours.length >= 2, raisons, nbJours: multi.jours.length, plan: multi };
  };

  /**
   * Alertes d'un plan : retour tardif, temps libre entamé, trajets qui traversent un estuaire.
   * @param points tableau de { lat, lng, nom } aligné sur la matrice (0 = domicile)
   */
  routing.alertes = function (plan, points, params) {
    const out = [];
    const limite = U.hhmmToMin(params.heureLimiteRetour);
    const utile = routing.finUtileMin(params);
    const multi = plan.jours.length > 1;
    plan.jours.forEach((j, n) => {
      const lib = multi ? 'Jour ' + (n + 1) + ' : ' : '';
      const fin = j.planning.finMin;
      const quoi = j.planning.retour ? 'retour au domicile' : 'fin de la dernière visite';
      if (fin > limite) out.push({ niveau: 'alerte', texte: lib + quoi + ' prévu(e) à ' + U.fmtHeure(fin) + ', après ' + U.fmtHeure(limite) + '.' });
      else if (fin > utile) out.push({ niveau: 'info', texte: lib + 'temps libre réduit à ' + U.fmtDuree(Math.max(0, limite - fin)) + ' (objectif ' + U.fmtDuree(params.tempsLibreMin) + ').' });
      // trajets de la journée
      let prev = j.planning.depuis;
      const legs = j.stops.map((s) => s.index);
      if (j.planning.retour) legs.push(0);
      for (const idx of legs) {
        const e = TC.geo.estuaireTraverse(points[prev], points[idx]);
        if (e) out.push({ niveau: 'alerte', texte: lib + 'le trajet ' + points[prev].nom + ' → ' + points[idx].nom + ' traverse l’' + e + ' : distance et durée probablement sous-estimées (bac ou détour).' });
        prev = idx;
      }
      // nuit de l'autre côté d'un estuaire
      if (!j.planning.retour && j.stops.length) {
        const nuit = points[j.stops[j.stops.length - 1].index];
        const e = TC.geo.estuaireTraverse(points[0], nuit);
        if (e) out.push({ niveau: 'alerte', texte: lib + 'nuit à ' + nuit.nom + ', de l’autre côté de l’' + e + ' par rapport au domicile : vérifier le trajet réel.' });
      }
    });
    return out;
  };

  /** Dates des jours d'une tournée : jours de tournée consécutifs (mardi à vendredi). */
  routing.datesJours = function (dateDebut, n) {
    const out = [dateDebut];
    let d = U.parseDay(dateDebut);
    for (let i = 1; i < n; i++) {
      d = U.prochainJourTournee(d, false);
      out.push(U.isoDay(d));
    }
    return out;
  };

  TC.routing = routing;
})(window.TC);
