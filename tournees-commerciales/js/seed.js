/*
 * Génération déterministe des données fictives (même graine et même date = mêmes données).
 * - 12 commerciaux, 12 secteurs couvrant la France métropolitaine (hors Corse), de tailles différentes :
 *   un secteur urbain dense (Île-de-France), un secteur rural étendu (Limousin – Auvergne, avec la Creuse).
 * - Par commercial : 60 clients et 40 prospects placés dans de vraies communes (centre de la commune, légèrement décalé).
 * - 12 mois d'historique simulés jour par jour (tournées du mardi au vendredi) : visites, devis, commandes, échanges.
 * - Chaque secteur contient des cas visibles de chaque statut.
 * Noms d'entreprises et de personnes inventés, montants fictifs.
 */
window.TC = window.TC || {};
(function (TC) {
  'use strict';
  const U = TC.util;
  const S = {};

  S.SEED = 20261116;
  S.NB_CLIENTS = 60;
  S.NB_PROSPECTS = 40;

  S.SECTEURS = [
    { id: 'idf', nom: 'Île-de-France', type: 'urbain', departements: ['75', '92', '93', '94', '78', '91', '95', '77'], couleur: '#1d4ed8', domicile: 'Vincennes', comPrenom: 'Karim', comNom: 'Maquetton', tel: '01' },
    { id: 'nord', nom: 'Hauts-de-France', type: 'standard', departements: ['59', '62', '80', '02', '60'], couleur: '#7c3aed', domicile: 'Arras', comPrenom: 'Sandrine', comNom: 'Exemplier', tel: '03' },
    { id: 'normandie', nom: 'Normandie – Eure-et-Loir', type: 'standard', departements: ['14', '27', '50', '61', '76', '28'], couleur: '#0369a1', domicile: 'Caen', comPrenom: 'Hugo', comNom: 'Prototel', tel: '02' },
    { id: 'bretagne', nom: 'Bretagne', type: 'standard', departements: ['22', '29', '35', '56'], couleur: '#0f766e', domicile: 'Cesson-Sévigné', comPrenom: 'Julien', comNom: 'Testard', tel: '02' },
    { id: 'loire', nom: 'Pays de la Loire – Touraine', type: 'standard', departements: ['44', '49', '53', '72', '85', '37', '41'], couleur: '#15803d', domicile: 'Angers', comPrenom: 'Claire', comNom: 'Démonval', tel: '02' },
    { id: 'est', nom: 'Grand Est', type: 'standard', departements: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'], couleur: '#a16207', domicile: 'Nancy', comPrenom: 'Mathieu', comNom: 'Simulard', tel: '03' },
    { id: 'bourgogne', nom: 'Bourgogne – Franche-Comté – Loiret', type: 'standard', departements: ['21', '25', '39', '58', '70', '71', '89', '90', '18', '45'], couleur: '#9f1239', domicile: 'Dijon', comPrenom: 'Inès', comNom: 'Essayan', tel: '03' },
    { id: 'rhone', nom: 'Rhône-Alpes', type: 'standard', departements: ['01', '07', '26', '38', '42', '69', '73', '74'], couleur: '#b45309', domicile: 'Saint-Priest', comPrenom: 'Romain', comNom: 'Pilotier', tel: '04' },
    { id: 'limousin', nom: 'Limousin – Auvergne', type: 'rural', departements: ['23', '87', '19', '36', '03', '63', '15', '43'], renfort: { '23': 8 }, couleur: '#4d7c0f', domicile: 'Guéret', comPrenom: 'Aurélie', comNom: 'Modelin', tel: '05' },
    { id: 'sudouest', nom: 'Sud-Ouest Atlantique', type: 'standard', departements: ['33', '17', '16', '24', '40', '47', '64', '79', '86'], couleur: '#be185d', domicile: 'Libourne', comPrenom: 'Élodie', comNom: 'Fictelle', tel: '05' },
    { id: 'midi', nom: 'Midi-Pyrénées', type: 'standard', departements: ['31', '09', '12', '32', '46', '65', '81', '82'], couleur: '#c2410c', domicile: 'Muret', comPrenom: 'Yann', comNom: 'Croquerel', tel: '05' },
    { id: 'med', nom: 'Méditerranée', type: 'standard', departements: ['30', '34', '11', '66', '48', '13', '84', '83', '04', '05', '06'], couleur: '#0e7490', domicile: 'Nîmes', comPrenom: 'Fatima', comNom: 'Esquissot', tel: '04' },
  ];

  /** Poids de tirage d'une commune selon sa population et sa distance au domicile. */
  const POIDS_DISTANCE = {
    urbain: (pop, d) => Math.sqrt(pop) * (d < 20 ? 1 : d < 40 ? 0.35 : 0.04),
    rural: (pop, d) => Math.pow(pop, 0.35) * (d < 150 ? 1 : 0.6),
    standard: (pop, d) => Math.sqrt(pop) * (d < 60 ? 1 : d < 110 ? 0.55 : 0.15),
  };
  /** Rayon (km) d'une journée de tournée simulée dans l'historique. */
  const RAYON_JOURNEE = { urbain: 12, rural: 60, standard: 35 };
  /** Intervalle cible entre deux visites (jours) selon le potentiel. */
  const INTERVALLE = { A: 35, B: 60, C: 110 };

  const NOMS = ['Testard', 'Exemplier', 'Fictelle', 'Maquetton', 'Prototel', 'Démonval', 'Simulard', 'Essayan', 'Brouillon', 'Pilotier', 'Modelin', 'Ébauchet', 'Esquissot', 'Croquerel', 'Factisse', 'Imaginel', 'Supposin', 'Hypothès', 'Virtuelle', 'Placebois', 'Fantômat', 'Chimérand', 'Inventin', 'Fabulier', 'Factotum', 'Lambdin', 'Quidamet', 'Untelier', 'Duponsard', 'Martinval', 'Durandel', 'Machinet', 'Trucheau', 'Bidulon', 'Chosier', 'Tartempion', 'Pseudonel', 'Anonymat', 'Gabarit', 'Patronel', 'Calquin', 'Mockeret', 'Dummard', 'Samplet', 'Fakenval', 'Postichet', 'Leurrier', 'Mirageot'];
  const PRENOMS = ['Thomas', 'Nicolas', 'Julien', 'Sébastien', 'Mathieu', 'Antoine', 'Pierre', 'Romain', 'Laurent', 'Olivier', 'David', 'Stéphane', 'Christophe', 'Frédéric', 'Jérôme', 'Yann', 'Kevin', 'Mehdi', 'Sophie', 'Nathalie', 'Isabelle', 'Céline', 'Aurélie', 'Émilie', 'Claire', 'Camille', 'Laura', 'Sandrine', 'Karine', 'Virginie', 'Hélène', 'Marion', 'Inès', 'Léa', 'Amandine', 'Fatima'];
  const FORMES = {
    installateur: ['Chauffage {n}', '{n} Thermique', '{n} Énergies', 'SARL {n} Chauffage', 'Ets {n}', '{n} Confort Habitat'],
    fumiste: ['Fumisterie {n}', '{n} Ramonage', 'Atelier {n} Fumisterie', '{n} Cheminées', 'Âtre {n}'],
    bureau_etudes: ['BET {n}', '{n} Ingénierie', 'Fluides {n} Conseil', '{n} Études Thermiques'],
    distributeur: ['{n} Distribution', 'Négoce {n}', 'Comptoir {n}', '{n} Matériaux Pro'],
  };
  const FONCTIONS = {
    installateur: ['Gérant', 'Chef d’entreprise', 'Responsable technique', 'Conducteur de travaux'],
    fumiste: ['Gérant', 'Artisan fumiste', 'Chef d’atelier'],
    bureau_etudes: ['Ingénieur fluides', 'Chargé d’affaires', 'Directeur technique'],
    distributeur: ['Chef d’agence', 'Responsable achats', 'Vendeur comptoir', 'Chef de rayon chauffage'],
  };
  const RUES = ['rue des Artisans', 'zone artisanale des Prés', 'rue de l’Industrie', 'avenue de la Gare', 'rue du Moulin', 'impasse des Forges', 'ZA du Bois Joli', 'rue Pasteur', 'route de la Vallée', 'parc d’activités des Landes', 'rue des Tanneurs', 'chemin des Vignes', 'rue Ampère', 'allée des Érables', 'rue Gustave Eiffel'];
  const NOTES = ['Intéressé par la gamme conduits double paroi pour un chantier de rénovation.', 'Stock à revoir, rupture sur les raccords inox en début de mois.', 'Questions sur la mise en conformité des conduits pour poêle à granulés.', 'Présentation de la gamme ventilation, à recontacter pour un chiffrage.', 'Client satisfait des délais de livraison, souhaite une formation pour ses équipes.', 'Concurrence agressive sur les prix, demande un geste commercial.', 'Projet de chaufferie collective en cours, besoin d’une étude de dimensionnement.', 'RAS, visite de courtoisie.', 'Remise de documentation technique et catalogue tarifs.', 'Problème de SAV réglé, relation apaisée.', 'Gros chantier prévu au printemps, à suivre de près.', 'Contact absent, échange rapide avec l’assistante.'];
  S.PROCHAINES_ACTIONS = ['Envoyer le chiffrage', 'Relancer le devis', 'Envoyer la documentation technique', 'Planifier une démonstration', 'Proposer une formation', 'Rappeler pour le chantier', 'Organiser une visite de l’usine', 'Faire un point sur le stock'];
  const OBJETS_DEVIS = ['Conduits double paroi inox', 'Kit de tubage flexible', 'Système ventouse concentrique', 'Conduit de cheminée modulaire', 'Gaines et bouches de ventilation', 'Chaufferie collective : conduits et accessoires', 'Raccordement poêle à granulés', 'Rénovation de conduit collectif'];
  const MOTIFS_PERTE = ['Prix', 'Délais', 'Fidélité à un concurrent', 'Projet abandonné', 'Pas de réponse'];

  /** Communes du référentiel : [nom, dep, lat, lng, pop, cp]. */
  function communes() {
    return (window.TC_COMMUNES || []).map((x) => ({ nom: x[0], dep: x[1], lat: x[2], lng: x[3], pop: x[4], cp: x[5] }));
  }

  const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const arrondi = (n, pas) => Math.round(n / pas) * pas;
  const at = (day, minutes) => {
    const d = U.startOfDay(day);
    d.setMinutes(Math.round(minutes));
    return d;
  };
  function joursOuvres(d) {
    if (!U.estJourTournee(d)) return false;
    const m = d.getMonth(), j = d.getDate();
    if (m === 7 && j >= 4 && j <= 24) return false; // congés d'été
    if (m === 11 && j >= 24) return false; // fin d'année
    if (m === 0 && j === 1) return false;
    return true;
  }
  function montantDevis(r, type) {
    const [min, max] = { installateur: [800, 9000], fumiste: [600, 6000], bureau_etudes: [5000, 40000], distributeur: [3000, 25000] }[type];
    return arrondi(r.float(min, max), 50);
  }
  function montantCommande(r, type, p) {
    const f = { A: 1.6, B: 1, C: 0.6 }[p];
    const moyenne = { installateur: 1600, fumiste: 1200, bureau_etudes: 2500, distributeur: 6000 }[type];
    return arrondi(moyenne * f * r.float(0.6, 1.4), 10);
  }

  const OPTS_SIM = { coefRoutier: 1.3, vitesseMoyenneKmh: 60 };
  function ordonner(depart, comptes) {
    const m = TC.routing.haversineProvider.matrix([depart, ...comptes], OPTS_SIM);
    return { m, order: TC.routing.optimizeOrder(m.km) };
  }

  /**
   * @param today date de référence (les 12 mois d'historique la précèdent)
   * @param parametres paramètres à embarquer dans l'instantané
   */
  S.generer = function (today, parametres) {
    const r = U.rng(S.SEED);
    const t0 = U.startOfDay(today);
    const debut = U.addDays(t0, -365);
    const ref = communes();

    const secteurs = S.SECTEURS.map((s) => ({ id: s.id, nom: s.nom, type: s.type, departements: s.departements, couleur: s.couleur }));
    const commerciaux = S.SECTEURS.map((s, i) => {
      const c = ref.find((x) => x.nom === s.domicile && s.departements.includes(x.dep));
      return {
        id: 'c' + (i + 1),
        prenom: s.comPrenom,
        nom: s.comNom,
        secteurId: s.id,
        couleur: s.couleur,
        domicile: { adresse: r.int(1, 40) + ' ' + r.pick(RUES), commune: c.nom, lat: c.lat, lng: c.lng },
      };
    });

    // ---------- Comptes
    const comptes = [];
    const etats = new Map();
    const noms = new Set();
    let seq = 0;
    commerciaux.forEach((com, ci) => {
      const sec = S.SECTEURS[ci];
      const pool = ref
        .filter((c) => sec.departements.includes(c.dep))
        .map((c) => ({ c, w: POIDS_DISTANCE[sec.type](c.pop, TC.geo.haversineKm(com.domicile, c)) * ((sec.renfort && sec.renfort[c.dep]) || 1) }));
      const creer = (nature, rang) => {
        const c = r.weighted(pool, (x) => x.w).c;
        const prospect = nature === 'prospect';
        const type = r.weighted(['installateur', 'fumiste', 'bureau_etudes', 'distributeur'], (t) =>
          (prospect ? { installateur: 50, fumiste: 25, bureau_etudes: 15, distributeur: 10 } : { installateur: 45, fumiste: 25, bureau_etudes: 12, distributeur: 18 })[t],
        );
        let raison = '';
        for (let k = 0; k < 20; k++) {
          raison = r.pick(FORMES[type]).replace('{n}', r.pick(NOMS));
          if (!noms.has(raison)) break;
          raison = raison + ' ' + c.nom;
          if (!noms.has(raison)) break;
        }
        noms.add(raison);
        const prenom = r.pick(PRENOMS);
        const nomC = r.pick(NOMS);
        let potentiel = r.weighted(['A', 'B', 'C'], (p) => ({ A: 20, B: 45, C: 35 })[p]);
        const jitter = c.pop > 200000 ? 0.04 : c.pop > 50000 ? 0.025 : c.pop > 10000 ? 0.012 : 0.006;
        seq += 1;
        const etat = { nbVisites: 0, enBaisse: false, visitesMax: 999 };
        if (!prospect) {
          // cas garantis dans chaque secteur : 6 clients délaissés, 4 clients en baisse de CA
          if (rang < 6 || r.chance(0.04)) etat.delaisseApres = U.addDays(t0, -r.int(125, 260));
          else if (rang < 10 || r.chance(0.04)) {
            etat.enBaisse = true;
            if (potentiel === 'C') potentiel = 'B';
          }
        }
        const compte = {
          id: (prospect ? 'pr' : 'cl') + String(seq).padStart(4, '0'),
          nature,
          raisonSociale: raison,
          type,
          adresse: r.int(1, 120) + ' ' + r.pick(RUES),
          codePostal: c.cp,
          commune: c.nom,
          departement: c.dep,
          lat: +(c.lat + r.float(-jitter, jitter)).toFixed(5),
          lng: +(c.lng + r.float(-jitter, jitter) * 1.4).toFixed(5),
          contact: {
            prenom,
            nom: nomC,
            fonction: r.pick(FONCTIONS[type]),
            telephone: sec.tel + ' ' + r.int(10, 99) + ' ' + r.int(10, 99) + ' ' + r.int(10, 99) + ' ' + r.int(10, 99),
            email: slug(prenom) + '.' + slug(nomC) + '@exemple-fictif.fr',
          },
          commercialId: com.id,
          secteurId: com.secteurId,
          potentiel,
          important: !prospect && potentiel === 'A' && r.chance(0.5),
          creeLe: U.isoDay(prospect ? U.addDays(t0, -r.int(20, 330)) : U.addDays(t0, -r.int(400, 3000))),
        };
        etat.compte = compte;
        comptes.push(compte);
        etats.set(compte.id, etat);
      };
      for (let i = 0; i < S.NB_CLIENTS; i++) creer('client', i);
      for (let i = 0; i < S.NB_PROSPECTS; i++) creer('prospect', i);
    });

    // ---------- Prospects : étape et score (4 cas garantis par secteur : 2 chauds, 2 froids)
    const tirage = [['identifie', 24], ['contacte', 24], ['rdv_obtenu', 20], ['devis_envoye', 15], ['gagne', 9], ['perdu', 8]];
    const rangProspect = new Map();
    for (const e of etats.values()) {
      const c = e.compte;
      if (c.nature !== 'prospect') continue;
      const rang = rangProspect.get(c.commercialId) || 0;
      rangProspect.set(c.commercialId, rang + 1);
      const forcee = ['rdv_obtenu', 'devis_envoye', 'identifie', 'contacte'][rang];
      const etape = forcee || r.weighted(tirage, (x) => x[1])[0];
      c.etape = etape;
      const base = { A: 70, B: 50, C: 30 }[c.potentiel];
      c.score = Math.max(5, Math.min(98, Math.round(base + r.float(-20, 25) + (etape === 'devis_envoye' ? 10 : 0))));
      if (rang === 2 || rang === 3) c.score = r.int(20, 45);
      if (etape === 'identifie') c.creeLe = U.isoDay(U.addDays(t0, -r.int(3, 75)));
      if (['rdv_obtenu', 'devis_envoye', 'gagne', 'perdu'].includes(etape)) {
        e.visitesDes = U.addDays(U.parseDay(c.creeLe), r.int(10, 40));
        e.visitesMax = etape === 'rdv_obtenu' ? 1 : r.int(1, 3);
      } else e.visitesMax = 0;
    }

    // ---------- Simulation jour par jour
    const visites = [], devis = [], commandes = [], echanges = [];
    let vseq = 0, dseq = 0, oseq = 0, eseq = 0;
    const eligible = (e, day) => {
      const c = e.compte;
      if (U.parseDay(c.creeLe) > day) return false;
      if (c.nature === 'client') return !(e.delaisseApres && day > e.delaisseApres);
      return !!e.visitesDes && day >= e.visitesDes && e.nbVisites < e.visitesMax;
    };
    const urgence = (e, day) => {
      if (e.compte.nature === 'prospect') return 2.5;
      if (!e.derniereVisite) e.derniereVisite = U.addDays(debut, -r.int(0, 60));
      return U.daysBetween(e.derniereVisite, day) / INTERVALLE[e.compte.potentiel];
    };

    commerciaux.forEach((com, ci) => {
      const sec = S.SECTEURS[ci];
      const mine = [...etats.values()].filter((e) => e.compte.commercialId === com.id);
      for (let day = new Date(debut); day < t0; day = U.addDays(day, 1)) {
        if (!joursOuvres(day) || !r.chance(0.85)) continue;
        const cands = mine
          .filter((e) => eligible(e, day))
          .map((e) => ({ e, u: urgence(e, day) }))
          .filter((x) => x.u >= 0.6)
          .sort((a, b) => b.u - a.u);
        if (!cands.length) continue;
        const ancre = r.pick(cands.slice(0, 8)).e;
        const n = r.int(3, 5);
        const groupe = [ancre, ...cands.filter((x) => x.e !== ancre && TC.geo.haversineKm(x.e.compte, ancre.compte) < RAYON_JOURNEE[sec.type]).slice(0, n - 1).map((x) => x.e)];
        const { m, order } = ordonner(com.domicile, groupe.map((g) => g.compte));
        let clock = 8 * 60 + r.int(0, 30);
        let prev = 0;
        let pause = false;
        for (const idx of order) {
          const e = groupe[idx - 1];
          clock += m.minutes[prev][idx];
          if (!pause && clock >= 12 * 60) {
            clock += 60;
            pause = true;
          }
          if (clock > 17 * 60 + 30) break;
          const duree = r.pick([45, 60, 60, 60, 75, 90]);
          const c = e.compte;
          const resultat = r.weighted(['positif', 'neutre', 'devis_demande', 'commande', 'negatif', 'absent'], (x) =>
            (c.nature === 'client'
              ? { positif: 34, neutre: 30, devis_demande: 15, commande: 12, negatif: 4, absent: 5 }
              : { positif: 35, neutre: 25, devis_demande: 25, commande: 0, negatif: 10, absent: 5 })[x],
          );
          vseq += 1;
          const v = { id: 'v' + String(vseq).padStart(5, '0'), compteId: c.id, commercialId: com.id, debut: U.isoDateTime(at(day, clock)), dureeMin: duree, resultat };
          if (r.chance(0.7)) v.note = r.pick(NOTES);
          if (resultat !== 'absent' && r.chance(0.6)) {
            v.prochaineAction = r.pick(S.PROCHAINES_ACTIONS);
            v.dateRelance = U.isoDay(U.addDays(day, r.int(7, 45)));
          }
          visites.push(v);
          e.derniereVisite = new Date(day);
          e.nbVisites += 1;
          clock += duree;
          prev = idx;
          if (resultat === 'devis_demande' && c.nature === 'client') {
            const dDate = U.addDays(day, r.int(2, 7));
            if (dDate < t0) {
              dseq += 1;
              const age = U.daysBetween(dDate, t0);
              const statut = age > 45 ? (r.chance(0.55) ? 'accepte' : 'refuse') : 'en_cours';
              const montant = montantDevis(r, c.type);
              const dv = { id: 'd' + String(dseq).padStart(5, '0'), compteId: c.id, commercialId: com.id, date: U.isoDay(dDate), montantHT: montant, statut, objet: r.pick(OBJETS_DEVIS) };
              devis.push(dv);
              if (statut === 'accepte') {
                oseq += 1;
                commandes.push({ id: 'o' + String(oseq).padStart(5, '0'), compteId: c.id, date: U.isoDay(U.addDays(dDate, r.int(5, 20))), montantHT: montant, devisId: dv.id });
              }
            }
          }
        }
      }
    });

    // ---------- Commandes récurrentes des clients et devis en cours récents
    for (const e of etats.values()) {
      const c = e.compte;
      if (c.nature !== 'client') continue;
      const cadence = c.type === 'bureau_etudes' ? 3 : { A: 1, B: 1, C: 2 }[c.potentiel];
      const offset = r.int(0, cadence - 1);
      for (let mo = 12; mo >= 1; mo--) {
        const recent = mo <= 6;
        if ((mo + offset) % cadence !== 0) continue;
        if (e.enBaisse && recent && !r.chance(0.3)) continue;
        if (e.delaisseApres && recent && !r.chance(0.5)) continue;
        const nb = c.type === 'distributeur' ? r.int(1, 3) : 1;
        for (let k = 0; k < nb; k++) {
          const date = U.addDays(t0, -(mo * 30 - r.int(0, 28)));
          if (date >= t0) continue;
          oseq += 1;
          commandes.push({ id: 'o' + String(oseq).padStart(5, '0'), compteId: c.id, date: U.isoDay(date), montantHT: montantCommande(r, c.type, c.potentiel) });
        }
      }
      if (r.chance(0.12)) {
        dseq += 1;
        devis.push({ id: 'd' + String(dseq).padStart(5, '0'), compteId: c.id, commercialId: c.commercialId, date: U.isoDay(U.addDays(t0, -r.int(3, 40))), montantHT: montantDevis(r, c.type), statut: 'en_cours', objet: r.pick(OBJETS_DEVIS) });
      }
    }

    // ---------- Prospects : échanges, devis, prochaine action
    for (const e of etats.values()) {
      const c = e.compte;
      if (c.nature !== 'prospect') continue;
      const cree = U.parseDay(c.creeLe);
      const ajouterEchange = (date, canal, resume) => {
        if (date >= t0) date = U.addDays(t0, -1);
        eseq += 1;
        echanges.push({ id: 'e' + String(eseq).padStart(5, '0'), compteId: c.id, commercialId: c.commercialId, date: U.isoDay(date), canal, resume });
        return date;
      };
      let derniere = cree;
      if (c.etape !== 'identifie') {
        derniere = ajouterEchange(U.addDays(cree, r.int(2, 10)), r.pick(['appel', 'email', 'salon']), 'Premier contact, présentation de l’entreprise et de la gamme.');
        if (r.chance(0.5)) derniere = ajouterEchange(U.addDays(derniere, r.int(5, 20)), 'email', 'Envoi de la documentation et des références chantiers.');
      }
      if (e.derniereVisite && e.derniereVisite > derniere) derniere = e.derniereVisite;
      const enCours = c.etape !== 'gagne' && c.etape !== 'perdu';
      if (enCours && c.etape !== 'identifie' && r.chance(0.75)) {
        const d = U.addDays(t0, -r.int(1, 25));
        if (d > derniere) derniere = ajouterEchange(d, r.pick(['appel', 'email']), r.pick(['Relance téléphonique, projet toujours d’actualité.', 'Échange sur le calendrier du chantier.', 'Questions techniques sur le dimensionnement, réponse envoyée.', 'Point sur la proposition, en attente de décision.']));
      }
      if (['devis_envoye', 'gagne', 'perdu'].includes(c.etape)) {
        const dDate = U.addDays(derniere, r.int(2, 10));
        const dateDevis = dDate < t0 ? dDate : U.addDays(t0, -r.int(1, 10));
        const montant = montantDevis(r, c.type);
        const statut = c.etape === 'gagne' ? 'accepte' : c.etape === 'perdu' ? 'refuse' : 'en_cours';
        dseq += 1;
        const dv = { id: 'd' + String(dseq).padStart(5, '0'), compteId: c.id, commercialId: c.commercialId, date: U.isoDay(dateDevis), montantHT: montant, statut, objet: r.pick(OBJETS_DEVIS) };
        devis.push(dv);
        derniere = dateDevis;
        if (c.etape === 'gagne') {
          const od = U.addDays(dateDevis, r.int(5, 15));
          oseq += 1;
          commandes.push({ id: 'o' + String(oseq).padStart(5, '0'), compteId: c.id, date: U.isoDay(od < t0 ? od : U.addDays(t0, -1)), montantHT: montant, devisId: dv.id });
        }
        if (c.etape === 'perdu') c.motifPerte = r.pick(MOTIFS_PERTE);
      }
      c.etapeModifieeLe = U.isoDay(derniere);
      if (enCours) {
        c.prochaineAction = {
          libelle: { identifie: 'Premier appel de qualification', contacte: 'Obtenir un rendez-vous', rdv_obtenu: 'Envoyer une proposition', devis_envoye: 'Relancer le devis' }[c.etape],
          date: U.isoDay(U.addDays(t0, r.int(-10, 21))),
        };
      }
    }

    // ---------- Prochaine action des clients : issue de la dernière visite
    const derniereParCompte = new Map();
    for (const v of visites) {
      const p = derniereParCompte.get(v.compteId);
      if (!p || v.debut > p.debut) derniereParCompte.set(v.compteId, v);
    }
    for (const c of comptes) {
      if (c.nature !== 'client') continue;
      const v = derniereParCompte.get(c.id);
      if (v && v.prochaineAction && v.dateRelance) c.prochaineAction = { libelle: v.prochaineAction, date: v.dateRelance };
    }

    // ---------- Tournées de démonstration
    const tournees = [];
    const jour1 = U.prochainJourTournee(t0, true);
    const jourSemaineSuivante = U.addDays(jour1, 7);
    const creeLe = U.isoDateTime(t0);
    const nouvelleTournee = (com, date, groupe, extra) => {
      const { order } = ordonner(com.domicile, groupe.map((g) => g.compte));
      tournees.push(Object.assign({
        id: 't_' + com.id + '_' + U.isoDay(date),
        commercialId: com.id,
        date: U.isoDay(date),
        multiJours: false,
        decoupageRefuse: false,
        prospection: [],
        etapes: order.map((i) => ({ compteId: groupe[i - 1].compte.id })),
        creeLe,
        modifieeLe: creeLe,
      }, extra || {}));
    };
    commerciaux.forEach((com, ci) => {
      const sec = S.SECTEURS[ci];
      const mine = [...etats.values()].filter((e) => e.compte.commercialId === com.id && e.compte.nature === 'client' && !e.delaisseApres);
      const classes = mine.map((e) => ({ e, u: urgence(e, t0) })).sort((a, b) => b.u - a.u);
      const pris = new Set();
      const grappe = (ancre, rayon, n) => {
        const g = [ancre, ...classes.filter((x) => x.e !== ancre && !pris.has(x.e) && TC.geo.haversineKm(x.e.compte, ancre.compte) < rayon).slice(0, n - 1).map((x) => x.e)];
        g.forEach((x) => pris.add(x));
        return g;
      };
      if (sec.type === 'rural') {
        // 1) tournée lointaine sur plusieurs jours, déjà acceptée (nuit sur place)
        // 2) tournée mêlant visites proches et lointaines : l'outil propose un découpage
        const loin = classes.filter((x) => TC.geo.haversineKm(com.domicile, x.e.compte) > 100);
        const proche = classes.filter((x) => TC.geo.haversineKm(com.domicile, x.e.compte) <= 60);
        nouvelleTournee(com, jour1, grappe(loin[0].e, 60, 7), { multiJours: true });
        const reste = loin.filter((x) => !pris.has(x.e));
        nouvelleTournee(com, jourSemaineSuivante, [...grappe(proche[0].e, 50, 3), ...grappe(reste[0].e, 60, 3)]);
      } else {
        const r1 = RAYON_JOURNEE[sec.type];
        nouvelleTournee(com, jour1, grappe(classes[0].e, r1, 5));
        const suivant = classes.find((x) => !pris.has(x.e));
        nouvelleTournee(com, jourSemaineSuivante, grappe(suivant.e, r1, 5));
      }
    });

    return {
      secteurs,
      commerciaux,
      comptes,
      visites: visites.sort((a, b) => a.debut.localeCompare(b.debut)),
      echanges,
      devis,
      commandes: commandes.sort((a, b) => a.date.localeCompare(b.date)),
      tournees,
      parametres,
      genereLe: U.isoDay(t0),
    };
  };

  TC.seed = S;
})(window.TC);
