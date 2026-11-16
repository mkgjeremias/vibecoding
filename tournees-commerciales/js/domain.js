/*
 * Règles métier : libellés, paramètres, statuts calculés, comptes « à voir », priorité, indicateurs du pilotage.
 * Fonctions pures, sans accès au stockage.
 *
 * Modèle de données (objets simples) :
 *   Secteur     { id, nom, departements[], couleur, type }
 *   Commercial  { id, prenom, nom, secteurId, couleur, domicile: { adresse, commune, lat, lng } }
 *   Compte      { id, nature: client|prospect, raisonSociale, type, activites[], adresse, codePostal, commune,
 *                 departement, lat, lng, contact{}, commercialId, secteurId, potentiel: A|B|C, important,
 *                 prochaineAction?, creeLe, etape? (prospect), score? (prospect 0-100), etapeModifieeLe? }
 *   Visite      { id, compteId, commercialId, debut, dureeMin, resultat? (absent = visite sans compte-rendu),
 *                 prochaineAction?, dateRelance?, note?, tourneeId? }
 *   Echange     { id, compteId, commercialId, date, canal: appel|email|salon|autre, resume }
 *   Devis       { id, compteId, commercialId, date, montantHT, statut: en_cours|accepte|refuse, objet }
 *   Commande    { id, compteId, date, montantHT, devisId? }
 *   Tournee     { id, commercialId, date (1er jour), departements[], multiJours, decoupageRefuse,
 *                 prospection: [n° de jour], etapes: [{ compteId, dureeMin?, confirme?, visiteId? }], creeLe, modifieeLe }
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
    // fréquence de visite par potentiel (jours) : A 6 semaines, B 3 mois, C 6 mois
    frequenceAJours: 42,
    frequenceBJours: 91,
    frequenceCJours: 182,
    // prospection
    dureeProspectionMin: 60,
    rayonProspectionKm: 15,
    // pilotage
    objectifVisitesSemaine: 10,
    // statuts
    seuilRisqueJours: 120,
    seuilBaisseCAPct: 30,
    seuilCAReferenceBaisse: 3000,
    seuilScoreChaud: 60,
    seuilCAImportant: 40000,
  };

  D.TYPE_LABEL = { installateur: 'Installateur', fumiste: 'Fumiste', bureau_etudes: "Bureau d'études", distributeur: 'Distributeur' };
  D.TYPES = Object.keys(D.TYPE_LABEL);
  D.ACTIVITES = ['fumisterie_individuelle', 'fumisterie_tertiaire', 'ventilation', 'industrie'];
  D.ACTIVITE_LABEL = { fumisterie_individuelle: 'Fumisterie individuelle', fumisterie_tertiaire: 'Fumisterie tertiaire', ventilation: 'Ventilation', industrie: 'Industrie' };
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

  D.DEPARTEMENTS = {
    '01': 'Ain', '02': 'Aisne', '03': 'Allier', '04': 'Alpes-de-Haute-Provence', '05': 'Hautes-Alpes', '06': 'Alpes-Maritimes',
    '07': 'Ardèche', '08': 'Ardennes', '09': 'Ariège', '10': 'Aube', '11': 'Aude', '12': 'Aveyron', '13': 'Bouches-du-Rhône',
    '14': 'Calvados', '15': 'Cantal', '16': 'Charente', '17': 'Charente-Maritime', '18': 'Cher', '19': 'Corrèze',
    '2A': 'Corse-du-Sud', '2B': 'Haute-Corse', '21': "Côte-d'Or", '22': "Côtes-d'Armor", '23': 'Creuse', '24': 'Dordogne',
    '25': 'Doubs', '26': 'Drôme', '27': 'Eure', '28': 'Eure-et-Loir', '29': 'Finistère', '30': 'Gard', '31': 'Haute-Garonne',
    '32': 'Gers', '33': 'Gironde', '34': 'Hérault', '35': 'Ille-et-Vilaine', '36': 'Indre', '37': 'Indre-et-Loire',
    '38': 'Isère', '39': 'Jura', '40': 'Landes', '41': 'Loir-et-Cher', '42': 'Loire', '43': 'Haute-Loire',
    '44': 'Loire-Atlantique', '45': 'Loiret', '46': 'Lot', '47': 'Lot-et-Garonne', '48': 'Lozère', '49': 'Maine-et-Loire',
    '50': 'Manche', '51': 'Marne', '52': 'Haute-Marne', '53': 'Mayenne', '54': 'Meurthe-et-Moselle', '55': 'Meuse',
    '56': 'Morbihan', '57': 'Moselle', '58': 'Nièvre', '59': 'Nord', '60': 'Oise', '61': 'Orne', '62': 'Pas-de-Calais',
    '63': 'Puy-de-Dôme', '64': 'Pyrénées-Atlantiques', '65': 'Hautes-Pyrénées', '66': 'Pyrénées-Orientales', '67': 'Bas-Rhin',
    '68': 'Haut-Rhin', '69': 'Rhône', '70': 'Haute-Saône', '71': 'Saône-et-Loire', '72': 'Sarthe', '73': 'Savoie',
    '74': 'Haute-Savoie', '75': 'Paris', '76': 'Seine-Maritime', '77': 'Seine-et-Marne', '78': 'Yvelines', '79': 'Deux-Sèvres',
    '80': 'Somme', '81': 'Tarn', '82': 'Tarn-et-Garonne', '83': 'Var', '84': 'Vaucluse', '85': 'Vendée', '86': 'Vienne',
    '87': 'Haute-Vienne', '88': 'Vosges', '89': 'Yonne', '90': 'Territoire de Belfort', '91': 'Essonne', '92': 'Hauts-de-Seine',
    '93': 'Seine-Saint-Denis', '94': 'Val-de-Marne', '95': "Val-d'Oise",
  };

  /** Statut calculé, jamais saisi. */
  D.computeStatut = function (c, info, p, today) {
    if (c.nature === 'prospect') {
      if (c.etape === 'gagne') return 'client_actif';
      const chaud = (c.score || 0) >= p.seuilScoreChaud || c.etape === 'rdv_obtenu' || c.etape === 'devis_envoye';
      return chaud ? 'prospect_chaud' : 'prospect_froid';
    }
    const jours = U.joursDepuis(info.derniereVisite, today);
    if (jours > p.seuilRisqueJours || D.baisseCA(info, p) > p.seuilBaisseCAPct / 100) return 'client_risque';
    return 'client_actif';
  };

  /** Baisse du CA des 6 derniers mois par rapport aux 6 précédents (0 si la référence est trop faible). */
  D.baisseCA = (info, p) => (info.caPrec6m >= p.seuilCAReferenceBaisse ? (info.caPrec6m - info.ca6m) / info.caPrec6m : 0);

  /** Informations dérivées de chaque compte (dernière visite, CA, devis en cours, statut, important, à voir). */
  D.derive = function (data, today) {
    const p = data.parametres;
    const d12 = U.isoDay(U.addDays(today, -365));
    const d6 = U.isoDay(U.addDays(today, -182));
    const auj = U.isoDay(today);

    const visitesParCompte = new Map();
    for (const v of data.visites) {
      if (v.debut.slice(0, 10) > auj) continue; // une visite future n'est pas encore faite
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
      info.aVoir = D.aVoir(info, p, today);
      infos.set(c.id, info);
    }
    return { today, infos, visitesParCompte };
  };

  // ---------- fréquence de visite et comptes « à voir »
  D.frequenceJours = (c, p) => p['frequence' + c.potentiel + 'Jours'];

  /** "3 semaines", "5 mois". */
  D.dureeEnClair = function (jours) {
    if (jours < 60) return Math.max(1, Math.round(jours / 7)) + ' semaine' + (Math.round(jours / 7) > 1 ? 's' : '');
    return Math.round(jours / 30.4) + ' mois';
  };

  /**
   * Pourquoi aller voir ce compte, en clair.
   * À voir si : client en retard sur sa fréquence, client à risque, devis en attente ou prospect chaud.
   */
  D.aVoir = function (info, p, today) {
    const c = info.compte;
    const r = { retard: false, risque: false, devis: false, chaud: false, raisons: [] };
    const actif = c.etape !== 'perdu' && c.etape !== 'gagne';
    if (!actif) return Object.assign(r, { est: false });
    const j = U.joursDepuis(info.derniereVisite, today);
    if (c.nature === 'client') {
      if (j > D.frequenceJours(c, p)) {
        r.retard = true;
        r.raisons.push(j === Infinity ? 'jamais vu' : 'pas vu depuis ' + D.dureeEnClair(j));
      }
      if (info.statut === 'client_risque') {
        r.risque = true;
        const b = D.baisseCA(info, p);
        if (b > p.seuilBaisseCAPct / 100) r.raisons.push('CA en baisse de ' + Math.round(b * 100) + ' %');
        else if (!r.retard) r.raisons.push('client à risque');
      }
    }
    if (info.devisEnCours.length) {
      r.devis = true;
      const total = info.devisEnCours.reduce((s, d) => s + d.montantHT, 0);
      r.raisons.push((info.devisEnCours.length > 1 ? info.devisEnCours.length + ' devis' : 'devis') + ' de ' + U.fmtEuro(total) + ' en attente');
    }
    if (info.statut === 'prospect_chaud') {
      r.chaud = true;
      r.raisons.push(c.etape === 'rdv_obtenu' ? 'prospect chaud, rendez-vous obtenu' : 'prospect chaud');
    }
    r.est = r.retard || r.risque || r.devis || r.chaud;
    return r;
  };

  // ---------- priorité interne (non affichée) : somme de quatre critères
  D.POIDS = {
    anciennete: 40, // proportionnel à l'ancienneté de la dernière visite, plafonné à 180 jours
    devisEnCours: 30,
    potentiel: { A: 25, B: 12, C: 0 },
    statutAlerte: 10, // client à risque ou prospect chaud
  };
  D.prioriser = function (info, today) {
    const c = info.compte;
    const j = U.joursDepuis(info.derniereVisite, today);
    let score = Math.min(1, (j === Infinity ? 180 : j) / 180) * D.POIDS.anciennete;
    if (info.devisEnCours.length) score += D.POIDS.devisEnCours;
    score += c.nature === 'client' ? D.POIDS.potentiel[c.potentiel] : ((c.score || 0) / 100) * D.POIDS.potentiel.A;
    if (info.statut === 'client_risque' || info.statut === 'prospect_chaud') score += D.POIDS.statutAlerte;
    return { score: Math.round(score) };
  };
  /** Clé de tri : les comptes à voir d'abord, puis la priorité. */
  D.priorite = (info, today) => (info.aVoir && info.aVoir.est ? 1000 : 0) + D.prioriser(info, today).score;
  D.trierParPriorite = (infos, today) => infos.slice().sort((a, b) => D.priorite(b, today) - D.priorite(a, today) || a.compte.raisonSociale.localeCompare(b.compte.raisonSociale));

  /** Comptes à voir par département pour une liste de comptes. */
  D.chargeParDepartement = function (infos) {
    const out = new Map();
    for (const i of infos) {
      const d = i.compte.departement;
      if (!out.has(d)) out.set(d, { departement: d, comptes: 0, aVoir: 0, retard: 0, risque: 0, devis: 0, chaud: 0 });
      const e = out.get(d);
      e.comptes += 1;
      const a = i.aVoir;
      if (!a || !a.est) continue;
      e.aVoir += 1;
      if (a.retard) e.retard += 1;
      if (a.risque) e.risque += 1;
      if (a.devis) e.devis += 1;
      if (a.chaud) e.chaud += 1;
    }
    return [...out.values()].sort((a, b) => b.aVoir - a.aVoir || a.departement.localeCompare(b.departement));
  };

  /** Prospects proches d'un point (fin de journée), les plus prioritaires d'abord. */
  D.prospectsProches = function (a) {
    const out = [];
    for (const info of a.candidats) {
      const c = info.compte;
      if (c.nature !== 'prospect' || c.etape === 'perdu' || c.etape === 'gagne' || a.exclus.has(c.id)) continue;
      const d = TC.geo.haversineKm(a.point, c);
      if (d > a.rayonKm) continue;
      out.push({ info, distanceKm: d * (a.coefRoutier || 1.3), score: D.prioriser(info, a.today).score });
    }
    return out.sort((x, y) => y.score - x.score || x.distanceKm - y.distanceKm).slice(0, a.max || 5);
  };

  // ---------- indicateurs du pilotage (direction)
  /**
   * Calcule les indicateurs à partir des visites déclarées et des tournées prévues uniquement.
   * @param a { data, der, today, periodeJours, secteurId ('tous' ou id), activite ('toutes' ou id) }
   */
  D.pilotage = function (a) {
    const { data, der, today } = a;
    const p = data.parametres;
    const debut = U.isoDay(U.addDays(today, -a.periodeJours));
    const auj = U.isoDay(today);
    const semaines = a.periodeJours / 7;
    const commerciaux = data.commerciaux.filter((c) => a.secteurId === 'tous' || c.secteurId === a.secteurId);
    const comptes = new Map(data.comptes.map((c) => [c.id, c]));
    const okActivite = (c) => a.activite === 'toutes' || (c.activites || []).includes(a.activite);
    const visites = data.visites.filter((v) => {
      const d = v.debut.slice(0, 10);
      const c = comptes.get(v.compteId);
      return d >= debut && d < auj && c && okActivite(c) && commerciaux.some((m) => m.id === v.commercialId);
    });

    // comptes prévus dans une tournée à venir
    const prevus = new Set();
    for (const t of data.tournees) {
      if (t.date >= auj || (t.multiJours && U.daysBetween(U.parseDay(t.date), today) < 7)) t.etapes.forEach((e) => prevus.add(e.compteId));
    }

    // km estimés : chaque journée = domicile → visites dans l'ordre de l'heure → domicile
    const kmParCommercial = new Map();
    const jours = new Map();
    for (const v of visites) {
      const k = v.commercialId + '|' + v.debut.slice(0, 10);
      if (!jours.has(k)) jours.set(k, []);
      jours.get(k).push(v);
    }
    for (const [k, vs] of jours) {
      const com = data.commerciaux.find((c) => c.id === k.split('|')[0]);
      vs.sort((x, y) => x.debut.localeCompare(y.debut));
      const pts = [com.domicile, ...vs.map((v) => comptes.get(v.compteId)), com.domicile];
      let km = 0;
      for (let i = 0; i < pts.length - 1; i++) km += TC.geo.haversineKm(pts[i], pts[i + 1]) * p.coefRoutier;
      kmParCommercial.set(com.id, (kmParCommercial.get(com.id) || 0) + km);
    }

    const lignes = commerciaux.map((com) => {
      const vs = visites.filter((v) => v.commercialId === com.id);
      const km = kmParCommercial.get(com.id) || 0;
      const clientsAB = [...der.infos.values()].filter((i) => i.compte.commercialId === com.id && i.compte.nature === 'client' && ['A', 'B'].includes(i.compte.potentiel) && okActivite(i.compte));
      const dansFreq = clientsAB.filter((i) => U.joursDepuis(i.derniereVisite, today) <= D.frequenceJours(i.compte, p)).length;
      const risques = [...der.infos.values()].filter((i) => i.compte.commercialId === com.id && i.statut === 'client_risque' && okActivite(i.compte));
      const visitesSemaine = vs.length / semaines;
      return {
        commercial: com,
        visites: vs.length,
        visitesSemaine,
        alerteVisites: visitesSemaine < p.objectifVisitesSemaine,
        kmParVisite: vs.length ? km / vs.length : 0,
        partABDansFrequence: clientsAB.length ? dansFreq / clientsAB.length : 0,
        risquesSansVisitePrevue: risques.filter((i) => !prevus.has(i.compte.id)).length,
        partCompteRendu: vs.length ? vs.filter((v) => v.resultat).length / vs.length : 0,
        devis: vs.filter((v) => v.resultat === 'devis_demande').length,
        commandes: vs.filter((v) => v.resultat === 'commande').length,
      };
    });

    const kmTotal = [...kmParCommercial.values()].reduce((s, x) => s + x, 0);
    const parActivite = {};
    for (const act of D.ACTIVITES) parActivite[act] = 0;
    for (const v of visites) for (const act of comptes.get(v.compteId).activites || []) parActivite[act] += 1;

    const parSecteur = data.secteurs.map((s) => {
      const infos = [...der.infos.values()].filter((i) => i.compte.secteurId === s.id && okActivite(i.compte) && i.compte.etape !== 'perdu' && i.compte.etape !== 'gagne');
      const n = infos.length || 1;
      return {
        secteur: s,
        comptes: infos.length,
        aVoir: infos.filter((i) => i.aVoir.est).length,
        partAVoir: infos.filter((i) => i.aVoir.est).length / n,
        lat: infos.reduce((x, i) => x + i.compte.lat, 0) / n,
        lng: infos.reduce((x, i) => x + i.compte.lng, 0) / n,
      };
    });

    return {
      synthese: {
        visites: visites.length,
        visitesSemaineParCommercial: commerciaux.length ? visites.length / semaines / commerciaux.length : 0,
        kmParVisite: visites.length ? kmTotal / visites.length : 0,
        devis: visites.filter((v) => v.resultat === 'devis_demande').length,
        commandes: visites.filter((v) => v.resultat === 'commande').length,
        partCompteRendu: visites.length ? visites.filter((v) => v.resultat).length / visites.length : 0,
      },
      lignes,
      parActivite,
      parSecteur,
    };
  };

  TC.domain = D;
})(window.TC);
