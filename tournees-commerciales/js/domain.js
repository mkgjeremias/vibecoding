/*
 * Règles métier : libellés, paramètres par défaut, statuts calculés, score des suggestions.
 * Fonctions pures, sans accès au stockage.
 *
 * Modèle de données (objets simples) :
 *   Secteur     { id, nom, departements[], couleur, type }
 *   Commercial  { id, prenom, nom, secteurId, couleur, domicile: { adresse, commune, lat, lng } }
 *   Compte      { id, nature: client|prospect, raisonSociale, type, adresse, codePostal, commune, departement,
 *                 lat, lng, contact{}, commercialId, secteurId, potentiel: A|B|C, important, prochaineAction?,
 *                 creeLe, etape? (prospect), score? (prospect 0-100), etapeModifieeLe? }
 *   Visite      { id, compteId, commercialId, debut, dureeMin, resultat, prochaineAction?, dateRelance?, note?, tourneeId? }
 *   Echange     { id, compteId, commercialId, date, canal: appel|email|salon|autre, resume }
 *   Devis       { id, compteId, commercialId, date, montantHT, statut: en_cours|accepte|refuse, objet }
 *   Commande    { id, compteId, date, montantHT, devisId? }
 *   Tournee     { id, commercialId, date (1er jour), multiJours, decoupageRefuse, prospection: [n° de jour],
 *                 etapes: [{ compteId, dureeMin?, visiteId? }], creeLe, modifieeLe }
 */
window.TC = window.TC || {};
(function (TC) {
  'use strict';
  const U = TC.util;
  const D = {};

  D.PARAMETRES_DEFAUT = {
    // calcul des trajets
    coefRoutier: 1.3,
    vitesseMoyenneKmh: 60,
    margeTrajetPct: 15,
    // journée type
    heureDepart: '08:00',
    dureeRdvMin: 60,
    pauseActive: true,
    pauseDebut: '12:00',
    pauseDureeMin: 60,
    heureLimiteRetour: '18:30',
    tempsLibreMin: 60,
    // tournées sur plusieurs jours
    seuilAllerMultiJoursMin: 120,
    // suggestions et prospection
    rayonSuggestionKm: 10,
    dureeProspectionMin: 60,
    rayonProspectionKm: 15,
    // statuts
    seuilRisqueJours: 120,
    seuilBaisseCAPct: 30,
    seuilCAReferenceBaisse: 3000,
    seuilScoreChaud: 60,
    seuilCAImportant: 40000,
  };

  D.TYPE_LABEL = { installateur: 'Installateur', fumiste: 'Fumiste', bureau_etudes: "Bureau d'études", distributeur: 'Distributeur' };
  D.POTENTIEL_LABEL = { A: 'A · fort', B: 'B · moyen', C: 'C · faible' };
  D.ETAPES = ['identifie', 'contacte', 'rdv_obtenu', 'devis_envoye', 'gagne', 'perdu'];
  D.ETAPE_LABEL = { identifie: 'Identifié', contacte: 'Contacté', rdv_obtenu: 'Rendez-vous obtenu', devis_envoye: 'Devis envoyé', gagne: 'Gagné', perdu: 'Perdu' };
  D.RESULTATS = ['positif', 'neutre', 'devis_demande', 'commande', 'negatif', 'absent'];
  D.RESULTAT_LABEL = { positif: 'Positif', neutre: 'Neutre', negatif: 'Négatif', devis_demande: 'Devis demandé', commande: 'Commande', absent: 'Absent' };
  D.CANAL_LABEL = { appel: 'Appel', email: 'E-mail', salon: 'Salon', autre: 'Autre' };
  D.STATUT_DEVIS_LABEL = { en_cours: 'En cours', accepte: 'Accepté', refuse: 'Refusé' };
  D.STATUTS = ['client_actif', 'client_risque', 'prospect_chaud', 'prospect_froid'];
  D.STATUT_LABEL = { client_actif: 'Client actif', client_risque: 'Client à risque', prospect_chaud: 'Prospect chaud', prospect_froid: 'Prospect froid' };
  /** Bleu / rouge / orange / gris : distinguables en extérieur et pour les daltoniens. */
  D.STATUT_COULEUR = { client_actif: '#1d4ed8', client_risque: '#dc2626', prospect_chaud: '#ea580c', prospect_froid: '#64748b' };

  /** Statut calculé, jamais saisi. */
  D.computeStatut = function (c, info, p, today) {
    if (c.nature === 'prospect') {
      if (c.etape === 'gagne') return 'client_actif';
      const chaud = (c.score || 0) >= p.seuilScoreChaud || c.etape === 'rdv_obtenu' || c.etape === 'devis_envoye';
      return chaud ? 'prospect_chaud' : 'prospect_froid';
    }
    const jours = U.joursDepuis(info.derniereVisite, today);
    const baisse = info.caPrec6m >= p.seuilCAReferenceBaisse ? (info.caPrec6m - info.ca6m) / info.caPrec6m : 0;
    if (jours > p.seuilRisqueJours || baisse > p.seuilBaisseCAPct / 100) return 'client_risque';
    return 'client_actif';
  };

  /** Informations dérivées de chaque compte (dernière visite, CA, devis en cours, statut, important). */
  D.derive = function (data, today) {
    const p = data.parametres;
    const d12 = U.isoDay(U.addDays(today, -365));
    const d6 = U.isoDay(U.addDays(today, -182));

    const visitesParCompte = new Map();
    for (const v of data.visites) {
      if (!visitesParCompte.has(v.compteId)) visitesParCompte.set(v.compteId, []);
      visitesParCompte.get(v.compteId).push(v);
    }
    for (const l of visitesParCompte.values()) l.sort((a, b) => a.debut.localeCompare(b.debut));

    const ca = new Map();
    for (const o of data.commandes) {
      if (o.date < d12) continue;
      const e = ca.get(o.compteId) || { a12: 0, a6: 0, p6: 0 };
      e.a12 += o.montantHT;
      if (o.date >= d6) e.a6 += o.montantHT;
      else e.p6 += o.montantHT;
      ca.set(o.compteId, e);
    }
    const devisEnCours = new Map();
    for (const dv of data.devis) {
      if (dv.statut !== 'en_cours') continue;
      if (!devisEnCours.has(dv.compteId)) devisEnCours.set(dv.compteId, []);
      devisEnCours.get(dv.compteId).push(dv);
    }

    const infos = new Map();
    for (const c of data.comptes) {
      const vs = visitesParCompte.get(c.id) || [];
      const last = vs.length ? vs[vs.length - 1].debut.slice(0, 10) : undefined;
      const e = ca.get(c.id) || { a12: 0, a6: 0, p6: 0 };
      const info = {
        compte: c,
        derniereVisite: last,
        nbVisites12m: vs.filter((v) => v.debut >= d12).length,
        ca12m: e.a12,
        ca6m: e.a6,
        caPrec6m: e.p6,
        devisEnCours: devisEnCours.get(c.id) || [],
      };
      info.statut = D.computeStatut(c, info, p, today);
      info.important = c.nature === 'client' && (c.important || e.a12 >= p.seuilCAImportant);
      infos.set(c.id, info);
    }
    return { today, infos, visitesParCompte };
  };

  // ---------- Score des suggestions : somme lisible de quatre critères
  D.POIDS = {
    anciennete: 40, // proportionnel à l'ancienneté de la dernière visite, plafonné à 180 jours
    devisEnCours: 30,
    potentiel: { A: 25, B: 12, C: 0 },
    statutAlerte: 10, // client à risque ou prospect chaud
  };

  D.prioriser = function (info, today) {
    const c = info.compte;
    const motifs = [];
    const detail = {};
    const j = U.joursDepuis(info.derniereVisite, today);
    detail.anciennete = Math.min(1, (j === Infinity ? 180 : j) / 180) * D.POIDS.anciennete;
    if (j === Infinity) motifs.push('Jamais visité');
    else if (j >= 60) motifs.push('Non visité depuis ' + j + ' j');

    detail.devis = 0;
    if (info.devisEnCours.length) {
      detail.devis = D.POIDS.devisEnCours;
      motifs.push('Devis en cours (' + U.fmtEuro(info.devisEnCours.reduce((s, d) => s + d.montantHT, 0)) + ')');
    }
    if (c.nature === 'client') {
      detail.potentiel = D.POIDS.potentiel[c.potentiel];
      if (c.potentiel === 'A') motifs.push('Fort potentiel');
    } else {
      detail.potentiel = ((c.score || 0) / 100) * D.POIDS.potentiel.A;
      if ((c.score || 0) >= 60) motifs.push('Score prospect ' + c.score);
    }
    detail.statut = 0;
    if (info.statut === 'client_risque' || info.statut === 'prospect_chaud') {
      detail.statut = D.POIDS.statutAlerte;
      motifs.push(D.STATUT_LABEL[info.statut]);
    }
    const score = Math.round(detail.anciennete + detail.devis + detail.potentiel + detail.statut);
    return { score, motifs, detail };
  };

  const actif = (c) => c.etape !== 'perdu' && c.etape !== 'gagne';

  /**
   * Suggestions : comptes à moins de `rayonKm` du tracé, classés par score, avec détour estimé.
   * @param route [domicile, étapes…, domicile] (tous jours confondus)
   */
  D.suggerer = function (a) {
    if (a.route.length < 2) return [];
    const coef = a.coefRoutier || 1.3;
    const out = [];
    for (const info of a.candidats) {
      const c = info.compte;
      if (a.exclus.has(c.id) || !actif(c)) continue;
      const d = TC.geo.distancePointPolylineKm(c, a.route);
      if (d > a.rayonKm) continue;
      let detour = Infinity;
      for (let i = 0; i < a.route.length - 1; i++) {
        const x = TC.geo.haversineKm(a.route[i], c) + TC.geo.haversineKm(c, a.route[i + 1]) - TC.geo.haversineKm(a.route[i], a.route[i + 1]);
        detour = Math.min(detour, x);
      }
      const pr = D.prioriser(info, a.today);
      out.push({ info, distanceTraceKm: d, detourKm: Math.max(0, detour * coef), score: pr.score, motifs: pr.motifs });
    }
    return out.sort((x, y) => y.score - x.score || x.detourKm - y.detourKm);
  };

  /** Prospects proches d'un point (fin de journée), classés par score. */
  D.prospectsProches = function (a) {
    const out = [];
    for (const info of a.candidats) {
      const c = info.compte;
      if (c.nature !== 'prospect' || !actif(c) || a.exclus.has(c.id)) continue;
      const d = TC.geo.haversineKm(a.point, c);
      if (d > a.rayonKm) continue;
      out.push({ info, distanceKm: d * (a.coefRoutier || 1.3), score: D.prioriser(info, a.today).score });
    }
    return out.sort((x, y) => y.score - x.score || x.distanceKm - y.distanceKm).slice(0, a.max || 5);
  };

  TC.domain = D;
})(window.TC);
