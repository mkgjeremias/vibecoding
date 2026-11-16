/* Tests automatiques. Ouvrir tests.html dans un navigateur : le résumé s'affiche en haut de la page. */
(function (TC) {
  'use strict';
  const U = TC.util, R = TC.routing, G = TC.geo, D = TC.domain;
  const resultats = [];
  let groupe = '';

  function describe(nom, fn) {
    groupe = nom;
    fn();
  }
  function it(nom, fn) {
    try {
      fn();
      resultats.push({ groupe, nom, ok: true });
    } catch (e) {
      resultats.push({ groupe, nom, ok: false, erreur: e && e.message ? e.message : String(e) });
    }
  }
  function expect(v) {
    const fail = (msg) => {
      throw new Error(msg);
    };
    const s = (x) => JSON.stringify(x);
    return {
      toBe: (x) => v === x || fail('attendu ' + s(x) + ', obtenu ' + s(v)),
      toEqual: (x) => s(v) === s(x) || fail('attendu ' + s(x) + ', obtenu ' + s(v)),
      toBeCloseTo: (x, eps) => Math.abs(v - x) <= (eps || 1e-6) || fail('attendu ≈ ' + x + ', obtenu ' + v),
      toBeGreaterThan: (x) => v > x || fail('attendu > ' + x + ', obtenu ' + v),
      toBeGreaterThanOrEqual: (x) => v >= x || fail('attendu ≥ ' + x + ', obtenu ' + v),
      toBeLessThan: (x) => v < x || fail('attendu < ' + x + ', obtenu ' + v),
      toBeLessThanOrEqual: (x) => v <= x || fail('attendu ≤ ' + x + ', obtenu ' + v),
      toBeTruthy: () => !!v || fail('attendu vrai, obtenu ' + s(v)),
      toBeFalsy: () => !v || fail('attendu faux, obtenu ' + s(v)),
      toContain: (x) => (v && v.indexOf(x) >= 0) || fail(s(v) + ' ne contient pas ' + s(x)),
    };
  }

  const euclid = (pts) => pts.map((a) => pts.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1])));
  const P = Object.assign({}, D.PARAMETRES_DEFAUT);
  const opts = (extra) => Object.assign({ departMin: 480, pause: { debutMin: 720, dureeMin: 60 }, retourDomicile: true, prospectionMin: 0, arrondiMin: 1 }, extra || {});

  // ---------------------------------------------------------------- optimiseur
  describe('Optimiseur', () => {
    it('visite chaque point une seule fois', () => {
      const order = R.optimizeOrder(euclid([[0, 0], [5, 1], [1, 4], [6, 6], [2, 2], [8, 3], [3, 7]]));
      expect([...order].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    });
    it('2-opt ne dégrade jamais le plus proche voisin', () => {
      for (let seed = 1; seed < 30; seed++) {
        const r = U.rng(seed);
        const c = euclid(Array.from({ length: 12 }, () => [r.next() * 100, r.next() * 100]));
        const nn = R.nearestNeighbor(c);
        expect(R.tourCost(R.twoOpt(nn, c), c)).toBeLessThanOrEqual(R.tourCost(nn, c) + 1e-9);
      }
    });
    it('trouve le tour optimal sur un carré', () => {
      const c = euclid([[0, 0], [10, 10], [0, 10], [10, 0]]);
      expect(R.tourCost(R.optimizeOrder(c), c)).toBeCloseTo(40);
    });
    it('cas limites : 0 ou 1 étape', () => {
      expect(R.optimizeOrder([[0]])).toEqual([]);
      expect(R.optimizeOrder([[0, 1], [1, 0]])).toEqual([1]);
    });
    it('insertion au moindre détour', () => {
      // domicile (0,0), étapes (10,0) puis (20,0) ; le point (15,0) s'insère entre les deux
      const c = euclid([[0, 0], [10, 0], [20, 0], [15, 0]]);
      expect(R.meilleureInsertion([1, 2], 3, c)).toBe(1);
    });
  });

  // ---------------------------------------------------------------- géométrie
  describe('Géométrie', () => {
    it('Paris-Lyon ≈ 392 km à vol d’oiseau', () => {
      const d = G.haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 });
      expect(d).toBeGreaterThan(385);
      expect(d).toBeLessThan(400);
    });
    it('distance point-segment nulle sur le segment', () => {
      expect(G.distancePointSegmentKm({ lat: 48, lng: -1.25 }, { lat: 48, lng: -1.5 }, { lat: 48, lng: -1.0 })).toBeLessThan(0.01);
    });
    it('distance point-polyligne = distance au segment le plus proche', () => {
      const line = [{ lat: 48, lng: -1.5 }, { lat: 48, lng: -1 }, { lat: 48.5, lng: -1 }];
      expect(G.distancePointPolylineKm({ lat: 48.25, lng: -1 }, line)).toBeLessThan(0.01);
    });
    it('détecte la traversée de l’estuaire de la Gironde (Royan → Soulac, Blaye → Lamarque)', () => {
      expect(G.estuaireTraverse({ lat: 45.624, lng: -1.029 }, { lat: 45.51, lng: -1.12 })).toContain('Gironde');
      expect(G.estuaireTraverse({ lat: 45.127, lng: -0.662 }, { lat: 45.096, lng: -0.716 })).toContain('Gironde');
    });
    it('détecte la traversée de l’estuaire de la Loire (Cordemais → Frossay)', () => {
      expect(G.estuaireTraverse({ lat: 47.29, lng: -1.88 }, { lat: 47.245, lng: -1.935 })).toContain('Loire');
    });
    it('pas d’alerte quand on ne traverse pas (Bordeaux → Libourne, pont de Saint-Nazaire)', () => {
      expect(G.estuaireTraverse({ lat: 44.84, lng: -0.58 }, { lat: 44.92, lng: -0.24 })).toBe(null);
      expect(G.estuaireTraverse({ lat: 47.273, lng: -2.214 }, { lat: 47.247, lng: -2.166 })).toBe(null);
    });
  });

  // ---------------------------------------------------------------- planning
  describe('Planning', () => {
    const m = { km: [[0, 60, 60], [60, 0, 30], [60, 30, 0]], minutes: [[0, 60, 60], [60, 0, 30], [60, 30, 0]] };
    it('insère la pause déjeuner et calcule le retour', () => {
      const s = R.planifierJournee(m, 0, [{ index: 1, dureeMin: 120 }, { index: 2, dureeMin: 60 }], opts());
      // 8h + 60 -> 9h, rdv jusqu'à 11h, +30 -> 11h30 (avant la pause), rdv -> 12h30, retour +60 -> 13h30
      expect(s.stops[1].arriveeMin).toBe(690);
      expect(s.stops[1].pauseAvantMin).toBe(0);
      expect(s.retour.arriveeMin).toBe(810);
      expect(s.totalKm).toBe(150);
    });
    it('prend la pause à l’arrivée après midi', () => {
      const s = R.planifierJournee(m, 0, [{ index: 1, dureeMin: 200 }, { index: 2, dureeMin: 60 }], opts());
      // fin rdv 1 à 12h20, arrivée 12h50 -> pause, rdv à 13h50
      expect(s.stops[1].pauseAvantMin).toBe(60);
      expect(s.stops[1].debutRdvMin).toBe(830);
    });
    it('heures proposées arrondies aux 5 minutes', () => {
      const m2 = { km: [[0, 13], [13, 0]], minutes: [[0, 13], [13, 0]] };
      const s = R.planifierJournee(m2, 0, [{ index: 1, dureeMin: 60 }], opts({ arrondiMin: 5 }));
      expect(s.stops[0].debutRdvMin).toBe(8 * 60 + 15);
    });
    it('durée de visite modifiable étape par étape', () => {
      const a = R.planifierJournee(m, 0, [{ index: 1, dureeMin: 60 }, { index: 2, dureeMin: 60 }], opts({ pause: null }));
      const b = R.planifierJournee(m, 0, [{ index: 1, dureeMin: 90 }, { index: 2, dureeMin: 60 }], opts({ pause: null }));
      expect(b.stops[1].debutRdvMin - a.stops[1].debutRdvMin).toBe(30);
    });
    it('créneau prospection ajouté après la dernière visite', () => {
      const s = R.planifierJournee(m, 0, [{ index: 1, dureeMin: 60 }], opts({ prospectionMin: 60, pause: null }));
      expect(s.prospection.debutMin).toBe(600);
      expect(s.retour.arriveeMin).toBe(720);
    });
    it('journée intermédiaire : pas de retour au domicile', () => {
      const s = R.planifierJournee(m, 0, [{ index: 1, dureeMin: 60 }], opts({ retourDomicile: false }));
      expect(s.retour).toBe(null);
      expect(s.finMin).toBe(600);
    });
  });

  // ---------------------------------------------------------------- marges
  describe('Marges', () => {
    const pts = [{ lat: 46.17, lng: 1.87 }, { lat: 45.83, lng: 1.26 }];
    it('la marge majore les temps de trajet, pas les km', () => {
      const sans = R.matrix(pts, Object.assign({}, P, { margeTrajetPct: 0 }));
      const avec = R.matrix(pts, Object.assign({}, P, { margeTrajetPct: 15 }));
      expect(avec.km[0][1]).toBeCloseTo(sans.km[0][1]);
      expect(avec.minutes[0][1]).toBeCloseTo(sans.minutes[0][1] * 1.15);
      expect(avec.minutesBrutes[0][1]).toBeCloseTo(sans.minutes[0][1]);
    });
    it('une marge plus forte retarde le retour', () => {
      const plan = (pct) => {
        const p = Object.assign({}, P, { margeTrajetPct: pct });
        return R.planifierTournee({ m: R.matrix(pts, p), stops: [{ index: 1, dureeMin: 60 }], params: p }).jours[0].planning.finMin;
      };
      expect(plan(30)).toBeGreaterThan(plan(0));
    });
    it('le temps libre réservé avance l’heure de fin utile', () => {
      expect(R.finUtileMin(Object.assign({}, P, { tempsLibreMin: 60 }))).toBe(17 * 60 + 30);
      expect(R.finUtileMin(Object.assign({}, P, { tempsLibreMin: 0 }))).toBe(18 * 60 + 30);
    });
  });

  // ---------------------------------------------------------------- multi-jours
  describe('Tournées sur plusieurs jours', () => {
    // domicile à Guéret, 3 visites proches, 4 visites dans le Cantal (plus de 2 h de route)
    const pts = [
      { lat: 46.17, lng: 1.87, nom: 'Guéret' },
      { lat: 46.2, lng: 1.95, nom: 'A' },
      { lat: 46.1, lng: 1.8, nom: 'B' },
      { lat: 46.25, lng: 2.0, nom: 'C' },
      { lat: 44.93, lng: 2.44, nom: 'Aurillac' },
      { lat: 45.03, lng: 3.09, nom: 'Saint-Flour' },
      { lat: 45.22, lng: 2.33, nom: 'Mauriac' },
      { lat: 45.11, lng: 2.87, nom: 'Murat' },
    ];
    const m = R.matrix(pts, P);
    const ordre = R.optimizeOrder(m.km);
    const stops = ordre.map((i) => ({ index: i, dureeMin: 60 }));

    it('propose un découpage quand une visite est à plus de 2 h aller', () => {
      const a = R.analyserDecoupage(m, stops, P);
      expect(a.propose).toBeTruthy();
      expect(a.raisons.map((x) => x.type)).toContain('eloigne');
      expect(a.nbJours).toBeGreaterThanOrEqual(2);
    });
    it('ne propose rien pour une tournée courte et proche', () => {
      const s = [1, 2, 3].map((i) => ({ index: i, dureeMin: 60 }));
      expect(R.analyserDecoupage(m, s, P).propose).toBeFalsy();
    });
    it('chaque jour respecte l’heure limite moins le temps libre', () => {
      const plan = R.planifierTournee({ m, stops, params: P, multiJours: true });
      for (const j of plan.jours) if (j.stops.length > 1) expect(j.planning.finMin).toBeLessThanOrEqual(R.finUtileMin(P));
    });
    it('nuit sur place, départ du lendemain depuis la dernière visite, dernier jour au domicile', () => {
      const plan = R.planifierTournee({ m, stops, params: P, multiJours: true });
      expect(plan.jours.length).toBeGreaterThanOrEqual(2);
      plan.jours.forEach((j, n) => {
        const dernier = n === plan.jours.length - 1;
        expect(!!j.planning.retour).toBe(dernier);
        if (n > 0) expect(j.planning.depuis).toBe(plan.jours[n - 1].stops.at(-1).index);
      });
    });
    it('conserve toutes les étapes dans l’ordre donné', () => {
      const plan = R.planifierTournee({ m, stops, params: P, multiJours: true });
      expect(plan.jours.flatMap((j) => j.stops.map((s) => s.index))).toEqual(ordre);
    });
    it('un temps libre plus long ne réduit jamais le nombre de jours', () => {
      const n = (min) => R.decouperEnJours(m, stops, Object.assign({}, P, { tempsLibreMin: min })).length;
      expect(n(180)).toBeGreaterThanOrEqual(n(0));
    });
    it('un déplacement manuel recalcule km et horaires', () => {
      const p1 = R.planifierTournee({ m, stops, params: P, multiJours: true });
      const inverse = [...stops].reverse();
      const p2 = R.planifierTournee({ m, stops: inverse, params: P, multiJours: true });
      expect(p2.jours[0].stops[0].index).toBe(inverse[0].index);
      expect(p1.totalKm).toBeCloseTo(p2.totalKm, 1e-6); // circuit inversé : même distance
      const melange = [stops[3], stops[0], stops[5], stops[1], stops[6], stops[2], stops[4]];
      expect(R.planifierTournee({ m, stops: melange, params: P, multiJours: true }).totalKm).toBeGreaterThan(p1.totalKm);
    });
    it('dates : jours de tournée consécutifs, sans week-end ni lundi', () => {
      // jeudi 19/11/2026 -> vendredi 20 -> mardi 24
      expect(R.datesJours('2026-11-19', 3)).toEqual(['2026-11-19', '2026-11-20', '2026-11-24']);
    });
    it('alerte quand un trajet traverse l’estuaire de la Gironde', () => {
      const p2 = [{ lat: 44.92, lng: -0.24, nom: 'Libourne' }, { lat: 45.624, lng: -1.029, nom: 'Royan' }, { lat: 45.51, lng: -1.12, nom: 'Soulac-sur-Mer' }];
      const mm = R.matrix(p2, P);
      const plan = R.planifierTournee({ m: mm, stops: [{ index: 1, dureeMin: 60 }, { index: 2, dureeMin: 60 }], params: P });
      expect(R.alertes(plan, p2, P).map((a) => a.texte).join(' ')).toContain('Gironde');
    });
  });

  // ---------------------------------------------------------------- statuts et score
  describe('Statuts et score', () => {
    const today = new Date(2026, 10, 16);
    const client = { nature: 'client', potentiel: 'B' };
    const st = (c, info) => D.computeStatut(c, Object.assign({ ca6m: 0, caPrec6m: 0 }, info), P, today);
    it('client visité il y a 130 jours : à risque', () => {
      expect(st(client, { derniereVisite: '2026-07-09' })).toBe('client_risque');
    });
    it('client visité récemment : actif', () => {
      expect(st(client, { derniereVisite: '2026-10-20', ca6m: 5000, caPrec6m: 5000 })).toBe('client_actif');
    });
    it('baisse de CA de 40 % sur une référence de 5 000 € : à risque', () => {
      expect(st(client, { derniereVisite: '2026-10-20', ca6m: 3000, caPrec6m: 5000 })).toBe('client_risque');
    });
    it('baisse ignorée si la référence est sous 3 000 €', () => {
      expect(st(client, { derniereVisite: '2026-10-20', ca6m: 500, caPrec6m: 2000 })).toBe('client_actif');
    });
    it('prospects chauds et froids', () => {
      expect(st({ nature: 'prospect', score: 65, etape: 'contacte' }, {})).toBe('prospect_chaud');
      expect(st({ nature: 'prospect', score: 10, etape: 'rdv_obtenu' }, {})).toBe('prospect_chaud');
      expect(st({ nature: 'prospect', score: 10, etape: 'devis_envoye' }, {})).toBe('prospect_chaud');
      expect(st({ nature: 'prospect', score: 30, etape: 'contacte' }, {})).toBe('prospect_froid');
    });
    it('score = somme des quatre critères', () => {
      const info = { compte: { nature: 'client', potentiel: 'A' }, derniereVisite: undefined, devisEnCours: [{ montantHT: 1000 }], statut: 'client_risque' };
      const pr = D.prioriser(info, today);
      expect(pr.score).toBe(40 + 30 + 25 + 10);
      const info2 = { compte: { nature: 'client', potentiel: 'C' }, derniereVisite: '2026-08-18', devisEnCours: [], statut: 'client_actif' };
      expect(D.prioriser(info2, today).score).toBe(20); // 90 j / 180 × 40
    });
  });

  // ---------------------------------------------------------------- fréquence de visite
  describe('Fréquence de visite et comptes à voir', () => {
    const today = new Date(2026, 10, 16);
    const jour = (n) => U.isoDay(U.addDays(today, -n));
    const info = (compte, extra) => {
      const i = Object.assign({ compte, derniereVisite: undefined, ca6m: 0, caPrec6m: 0, devisEnCours: [] }, extra);
      i.statut = D.computeStatut(compte, i, P, today);
      i.aVoir = D.aVoir(i, P, today);
      return i;
    };
    it('fréquences par défaut : A 6 semaines, B 3 mois, C 6 mois', () => {
      expect(P.frequenceAJours).toBe(42);
      expect(P.frequenceBJours).toBe(91);
      expect(P.frequenceCJours).toBe(182);
    });
    it('client A vu il y a 50 jours : en retard, « pas vu depuis 7 semaines »', () => {
      const i = info({ nature: 'client', potentiel: 'A' }, { derniereVisite: jour(50) });
      expect(i.aVoir.retard).toBeTruthy();
      expect(i.aVoir.raisons[0]).toBe('pas vu depuis 7 semaines');
    });
    it('client A vu il y a 30 jours : à jour', () => {
      expect(info({ nature: 'client', potentiel: 'A' }, { derniereVisite: jour(30) }).aVoir.est).toBeFalsy();
    });
    it('client C vu il y a 150 jours : pas en retard sur 6 mois, mais à risque', () => {
      const i = info({ nature: 'client', potentiel: 'C' }, { derniereVisite: jour(150) });
      expect(i.aVoir.retard).toBeFalsy();
      expect(i.aVoir.risque).toBeTruthy();
      expect(i.aVoir.raisons).toContain('client à risque');
    });
    it('raisons en clair : devis en attente, CA en baisse, prospect chaud, jamais vu', () => {
      const d = info({ nature: 'client', potentiel: 'B' }, { derniereVisite: jour(10), devisEnCours: [{ montantHT: 8000 }] });
      expect(d.aVoir.raisons[0]).toContain('devis de');
      expect(d.aVoir.raisons[0]).toContain('en attente');
      const b = info({ nature: 'client', potentiel: 'B' }, { derniereVisite: jour(10), ca6m: 3000, caPrec6m: 5000 });
      expect(b.aVoir.raisons).toContain('CA en baisse de 40 %');
      expect(info({ nature: 'prospect', potentiel: 'B', score: 70, etape: 'contacte' }).aVoir.raisons).toContain('prospect chaud');
      expect(info({ nature: 'client', potentiel: 'C' }).aVoir.raisons).toContain('jamais vu');
    });
    it('un prospect perdu n’est jamais à voir', () => {
      expect(info({ nature: 'prospect', potentiel: 'A', score: 90, etape: 'perdu' }, { devisEnCours: [{ montantHT: 1 }] }).aVoir.est).toBeFalsy();
    });
    it('durée en clair', () => {
      expect(D.dureeEnClair(152)).toBe('5 mois');
      expect(D.dureeEnClair(21)).toBe('3 semaines');
    });
  });

  // ---------------------------------------------------------------- priorisation
  describe('Priorisation', () => {
    const today = new Date(2026, 10, 16);
    const mk = (id, dep, aVoir, score) => ({ compte: { id, raisonSociale: id, departement: dep, nature: 'client', potentiel: 'C' }, derniereVisite: U.isoDay(U.addDays(today, -score)), devisEnCours: [], statut: 'client_actif', aVoir });
    it('les comptes à voir passent avant les autres, même avec une priorité plus faible', () => {
      const a = mk('a', '23', { est: false }, 179);
      const b = mk('b', '23', { est: true, retard: true }, 1);
      expect(D.trierParPriorite([a, b], today).map((x) => x.compte.id)).toEqual(['b', 'a']);
    });
    it('à égalité, le compte le plus ancien en visite passe d’abord', () => {
      const a = mk('a', '23', { est: true }, 20);
      const b = mk('b', '23', { est: true }, 150);
      expect(D.trierParPriorite([a, b], today)[0].compte.id).toBe('b');
    });
    it('charge par département : total et détail, département le plus chargé en tête', () => {
      const l = D.chargeParDepartement([
        mk('a', '87', { est: true, retard: true }, 1),
        mk('b', '23', { est: true, retard: true, devis: true }, 1),
        mk('c', '23', { est: true, chaud: true }, 1),
        mk('d', '23', { est: false }, 1),
      ]);
      expect(l[0].departement).toBe('23');
      expect(l[0].aVoir).toBe(2);
      expect(l[0].comptes).toBe(3);
      expect(l[0].devis).toBe(1);
      expect(l[1].aVoir).toBe(1);
    });
  });

  // ---------------------------------------------------------------- pilotage
  describe('Indicateurs du pilotage', () => {
    const today = new Date(2026, 10, 17);
    const jour = (n, h) => U.isoDay(U.addDays(today, -n)) + 'T' + (h || '10:00') + ':00';
    const base = { lat: 46, lng: 2 };
    const fixture = (tournees) => {
      const data = {
        secteurs: [{ id: 'S1', nom: 'S1', departements: ['23'] }],
        commerciaux: [{ id: 'c1', prenom: 'A', nom: 'B', secteurId: 'S1', domicile: Object.assign({ commune: 'X' }, base) }],
        comptes: [
          { id: 'k1', nature: 'client', potentiel: 'A', type: 'installateur', activites: ['ventilation', 'industrie'], commercialId: 'c1', secteurId: 'S1', departement: '23', lat: 46.1, lng: 2, raisonSociale: 'K1' },
          { id: 'k2', nature: 'client', potentiel: 'B', type: 'fumiste', activites: ['fumisterie_individuelle'], commercialId: 'c1', secteurId: 'S1', departement: '23', lat: 46.1, lng: 2, raisonSociale: 'K2' },
        ],
        visites: [
          { id: 'v1', compteId: 'k1', commercialId: 'c1', debut: jour(2), resultat: 'positif' },
          { id: 'v2', compteId: 'k1', commercialId: 'c1', debut: jour(9), resultat: 'devis_demande' },
          { id: 'v3', compteId: 'k1', commercialId: 'c1', debut: jour(16), resultat: 'commande' },
          { id: 'v4', compteId: 'k1', commercialId: 'c1', debut: jour(23) },
          { id: 'v5', compteId: 'k2', commercialId: 'c1', debut: jour(130), resultat: 'neutre' },
        ],
        commandes: [], devis: [], echanges: [], tournees: tournees || [], parametres: P,
      };
      return { data, der: D.derive(data, today) };
    };
    const calculer = (f, extra) => D.pilotage(Object.assign({ data: f.data, der: f.der, today, periodeJours: 28, secteurId: 'tous', activite: 'toutes' }, extra));
    it('visites, visites par semaine, alerte sous 10', () => {
      const r = calculer(fixture());
      expect(r.synthese.visites).toBe(4);
      expect(r.lignes[0].visitesSemaine).toBeCloseTo(1);
      expect(r.lignes[0].alerteVisites).toBeTruthy();
    });
    it('km par visite : aller-retour domicile ↔ client chaque jour', () => {
      const r = calculer(fixture());
      const attendu = 2 * G.haversineKm(base, { lat: 46.1, lng: 2 }) * P.coefRoutier;
      expect(r.synthese.kmParVisite).toBeCloseTo(attendu, 0.01);
    });
    it('compte-rendu, devis et commandes issus des visites déclarées', () => {
      const r = calculer(fixture());
      expect(r.lignes[0].partCompteRendu).toBeCloseTo(0.75);
      expect(r.lignes[0].devis).toBe(1);
      expect(r.lignes[0].commandes).toBe(1);
    });
    it('part des clients A et B vus dans leur fréquence', () => {
      expect(calculer(fixture()).lignes[0].partABDansFrequence).toBeCloseTo(0.5);
    });
    it('clients à risque sans visite prévue, puis avec une tournée prévue', () => {
      expect(calculer(fixture()).lignes[0].risquesSansVisitePrevue).toBe(1);
      const t = { id: 't', commercialId: 'c1', date: U.isoDay(U.addDays(today, 3)), etapes: [{ compteId: 'k2' }] };
      expect(calculer(fixture([t])).lignes[0].risquesSansVisitePrevue).toBe(0);
    });
    it('répartition par activité et filtre par activité', () => {
      const f = fixture();
      const r = calculer(f);
      expect(r.parActivite.ventilation).toBe(4);
      expect(r.parActivite.industrie).toBe(4);
      expect(r.parActivite.fumisterie_individuelle).toBe(0);
      expect(calculer(f, { activite: 'fumisterie_individuelle' }).synthese.visites).toBe(0);
    });
    it('part des comptes à voir par secteur', () => {
      const r = calculer(fixture());
      expect(r.parSecteur[0].partAVoir).toBeCloseTo(0.5);
    });
  });

  // ---------------------------------------------------------------- données
  describe('Données de démonstration', () => {
    const today = new Date(2026, 10, 17);
    const data = TC.seed.generer(today, P);
    const der = D.derive(data, today);
    it('11 secteurs, un commercial par secteur', () => {
      expect(data.secteurs.map((s) => s.id).join(',')).toBe('AA,AB,AC,AE,FB,FC,BA,BB,CA,CB,CD');
      expect(data.commerciaux.length).toBe(11);
      for (const s of data.secteurs) expect(data.commerciaux.filter((c) => c.secteurId === s.id).length).toBe(1);
    });
    it('départements des secteurs conformes au découpage (FC comprend la Corse)', () => {
      const fc = data.secteurs.find((s) => s.id === 'FC');
      expect(fc.departements.length).toBe(18);
      expect(fc.departements).toContain('2A');
      expect(data.secteurs.find((s) => s.id === 'AA').departements.join(',')).toBe('60,75,78,92,93,94,95');
      const tous = data.secteurs.flatMap((s) => s.departements);
      expect(new Set(tous).size).toBe(tous.length); // aucun département dans deux secteurs
    });
    it('domicile de chaque commercial dans son secteur', () => {
      for (const c of data.commerciaux) {
        const s = data.secteurs.find((x) => x.id === c.secteurId);
        expect(window.TC_COMMUNES.some((x) => x[0] === c.domicile.commune && s.departements.includes(x[1]))).toBeTruthy();
      }
    });
    it('chaque secteur contient toutes les activités', () => {
      for (const s of data.secteurs) {
        const acts = new Set(data.comptes.filter((c) => c.secteurId === s.id).flatMap((c) => c.activites));
        for (const a of D.ACTIVITES) expect([...acts]).toContain(a);
      }
    });
    it('des visites sans compte-rendu, avec un taux différent selon les commerciaux', () => {
      const taux = data.commerciaux.map((c) => {
        const vs = data.visites.filter((v) => v.commercialId === c.id);
        return vs.filter((v) => v.resultat).length / vs.length;
      });
      expect(Math.max(...taux) - Math.min(...taux)).toBeGreaterThan(0.2);
    });
    it('60 clients et 40 prospects par commercial', () => {
      for (const c of data.commerciaux) {
        const mine = data.comptes.filter((x) => x.commercialId === c.id);
        expect(mine.filter((x) => x.nature === 'client').length).toBe(60);
        expect(mine.filter((x) => x.nature === 'prospect').length).toBe(40);
      }
    });
    it('chaque compte est dans un département de son secteur', () => {
      const deps = new Map(data.secteurs.map((s) => [s.id, s.departements]));
      for (const c of data.comptes) expect(deps.get(c.secteurId)).toContain(c.departement);
    });
    it('secteur étendu (FC, avec la Creuse) et secteur urbain dense (AA)', () => {
      const fc = data.comptes.filter((c) => c.secteurId === 'FC');
      expect(fc.filter((c) => c.departement === '23').length).toBeGreaterThan(2);
      const dist = (s) => {
        const com = data.commerciaux.find((c) => c.secteurId === s);
        const l = data.comptes.filter((c) => c.secteurId === s).map((c) => G.haversineKm(com.domicile, c)).sort((a, b) => a - b);
        return l[Math.floor(l.length / 2)];
      };
      expect(dist('FC')).toBeGreaterThan(3 * dist('AA'));
    });
    it('chaque secteur contient chaque statut', () => {
      for (const s of data.secteurs) {
        const statuts = new Set([...der.infos.values()].filter((i) => i.compte.secteurId === s.id).map((i) => i.statut));
        for (const x of D.STATUTS) expect([...statuts]).toContain(x);
      }
    });
    it('12 mois d’historique de visites, du mardi au vendredi', () => {
      expect(data.visites.length).toBeGreaterThan(4000);
      expect(U.joursDepuis(data.visites[0].debut.slice(0, 10), today)).toBeGreaterThan(330);
      for (const v of data.visites) expect(U.estJourTournee(U.parseDay(v.debut))).toBeTruthy();
    });
    it('génération déterministe', () => {
      const b = TC.seed.generer(today, P);
      expect(JSON.stringify(b.comptes)).toBe(JSON.stringify(data.comptes));
      expect(b.visites.length).toBe(data.visites.length);
    });
    it('deux tournées prévues par commercial, sur des jours de tournée', () => {
      expect(data.tournees.length).toBe(22);
      for (const t of data.tournees) expect(U.estJourTournee(U.parseDay(t.date))).toBeTruthy();
    });
    it('chaque secteur a des comptes à voir', () => {
      for (const s of data.secteurs) expect([...der.infos.values()].filter((i) => i.compte.secteurId === s.id && i.aVoir.est).length).toBeGreaterThan(10);
    });
    it('FC : une tournée sur plusieurs jours et une tournée à découper', () => {
      const com = data.commerciaux.find((c) => c.secteurId === 'FC');
      const [t1, t2] = data.tournees.filter((t) => t.commercialId === com.id);
      const byId = new Map(data.comptes.map((c) => [c.id, c]));
      const prep = (t) => {
        const pts = [com.domicile, ...t.etapes.map((e) => byId.get(e.compteId))];
        return { m: R.matrix(pts, P), stops: t.etapes.map((e, i) => ({ index: i + 1, dureeMin: 60 })) };
      };
      const a = prep(t1);
      expect(t1.multiJours).toBeTruthy();
      expect(R.planifierTournee({ m: a.m, stops: a.stops, params: P, multiJours: true }).jours.length).toBeGreaterThanOrEqual(2);
      const b = prep(t2);
      expect(t2.multiJours).toBeFalsy();
      expect(R.analyserDecoupage(b.m, b.stops, P).propose).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------- affichage
  const ok = resultats.filter((r) => r.ok).length;
  const ko = resultats.length - ok;
  const el = document.getElementById('resume');
  el.textContent = (ko === 0 ? 'OK' : 'ÉCHEC') + ' : ' + ok + ' / ' + resultats.length + ' tests réussis';
  el.className = ko === 0 ? 'ok' : 'ko';
  let html = '';
  let g = '';
  for (const r of resultats) {
    if (r.groupe !== g) {
      g = r.groupe;
      html += '<h2>' + U.esc(g) + '</h2>';
    }
    html += '<div class="' + (r.ok ? 'ok' : 'ko') + '">' + (r.ok ? '✓ ' : '✗ ') + U.esc(r.nom) + '</div>';
    if (!r.ok) html += '<pre>' + U.esc(r.erreur) + '</pre>';
  }
  document.getElementById('resultats').innerHTML = html;
})(window.TC);
