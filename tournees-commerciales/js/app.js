/*
 * Interface de l'application (une seule page, navigation par #ancre).
 * Commercial : « Préparer » (parcours guidé en 3 étapes) et « Ma tournée » (mobile).
 * Direction : « Pilotage » et « Paramètres ». Fiche compte en fenêtre.
 */
(function (TC) {
  'use strict';
  const U = TC.util, R = TC.routing, D = TC.domain, esc = U.esc;
  const CLE_PROFIL = 'tournees-commerciales.profil';
  const COULEURS_JOURS = ['#1d4ed8', '#c2410c', '#15803d', '#7c3aed', '#be185d'];
  const ETAPES_PREP = ['Où aller ?', 'Qui voir ?', 'Caler les rendez-vous'];

  const A = {
    data: null,
    der: null,
    comptesParId: new Map(),
    today: U.startOfDay(new Date()),
    profil: null,
    route: null,
    prep: null, // parcours Préparer en cours : { etape, departements, date, selection, activite, type, aVoirSeulement, tourneeId }
    maTourneeId: null,
    maJour: 0,
    maJourPour: null,
    crOuvert: null,
    cr: null,
    pilotage: { periodeJours: 28, secteurId: 'tous', activite: 'toutes' },
    cartes: [],
    ficheId: null,
    drag: null,
    vue: {},
  };

  // ------------------------------------------------------------------ données
  function indexer() {
    A.comptesParId = new Map(A.data.comptes.map((c) => [c.id, c]));
    A.der = D.derive(A.data, A.today);
  }
  function charger() {
    A.data = TC.dataService.load();
    indexer();
  }
  const compte = (id) => A.comptesParId.get(id);
  const commercial = (id) => A.data.commerciaux.find((c) => c.id === id);
  const secteur = (id) => A.data.secteurs.find((s) => s.id === id);
  const tournee = (id) => A.data.tournees.find((t) => t.id === id);
  const P = () => A.data.parametres;
  const nomDep = (d) => d + ' · ' + (D.DEPARTEMENTS[d] || d);

  function lireProfil() {
    try {
      const p = JSON.parse(localStorage.getItem(CLE_PROFIL));
      if (p && (p.kind === 'manager' || (p.kind === 'commercial' && commercial(p.commercialId)))) return p;
    } catch (e) {
      /* rien */
    }
    const fc = A.data.commerciaux.find((c) => c.secteurId === 'FC') || A.data.commerciaux[0];
    return { kind: 'commercial', commercialId: fc.id };
  }
  function ecrireProfil() {
    try {
      localStorage.setItem(CLE_PROFIL, JSON.stringify(A.profil));
    } catch (e) {
      /* rien */
    }
  }

  // ------------------------------------------------------------------ calcul d'une tournée
  function calc(t) {
    const p = P();
    const com = commercial(t.commercialId);
    const comptes = t.etapes.map((e) => compte(e.compteId));
    const points = [
      { lat: com.domicile.lat, lng: com.domicile.lng, nom: com.domicile.commune + ' (domicile)' },
      ...comptes.map((c) => ({ lat: c.lat, lng: c.lng, nom: c.commune })),
    ];
    const m = R.matrix(points, p);
    const stops = t.etapes.map((e, i) => ({ index: i + 1, dureeMin: e.dureeMin || p.dureeRdvMin }));
    const prospection = (j) => (t.prospection || []).includes(j);
    const plan = R.planifierTournee({ m, stops, params: p, multiJours: !!t.multiJours, prospection });
    const analyse = !t.multiJours && stops.length ? R.analyserDecoupage(m, stops, p, prospection) : null;
    const confirmes = t.etapes.filter((e) => e.confirme).length;
    return {
      com, comptes, points, m, plan, analyse,
      alertes: R.alertes(plan, points, p),
      dates: R.datesJours(t.date, plan.jours.length),
      confirmes,
      prete: t.etapes.length > 0 && confirmes === t.etapes.length,
    };
  }

  /** Tournées dont le dernier jour n'est pas passé, triées par date. */
  function tourneesAVenir(commercialId) {
    const auj = U.isoDay(A.today);
    return A.data.tournees
      .filter((t) => t.commercialId === commercialId)
      .map((t) => ({ t, k: calc(t) }))
      .filter((x) => x.k.dates[x.k.dates.length - 1] >= auj)
      .sort((a, b) => a.t.date.localeCompare(b.t.date));
  }

  function enregistrerTournee(t) {
    t.modifieeLe = U.isoDateTime(new Date());
    if (!A.data.tournees.includes(t)) A.data.tournees.push(t);
    TC.dataService.saveTournee(t);
  }
  function majTournee(t, fn) {
    fn(t);
    enregistrerTournee(t);
    render();
  }
  function deplacer(t, de, vers) {
    if (!t || de === vers || vers < 0 || vers >= t.etapes.length) return;
    majTournee(t, (x) => {
      const [e] = x.etapes.splice(de, 1);
      x.etapes.splice(vers, 0, e);
    });
  }

  /** Ordre optimisé d'une liste de comptes depuis le domicile, avec estimation (visites, km, jours). */
  function estimer(com, ids) {
    const p = P();
    if (!ids.length) return { visites: 0, km: 0, jours: 0, ordre: [] };
    const comptes = ids.map(compte);
    const m = R.matrix([com.domicile, ...comptes], p);
    const ordre = R.optimizeOrder(m.km);
    const stops = ordre.map((i) => ({ index: i, dureeMin: p.dureeRdvMin }));
    const un = R.planifierTournee({ m, stops, params: p, multiJours: false });
    const tient = un.jours[0].planning.finMin <= R.finUtileMin(p);
    const plan = tient ? un : R.planifierTournee({ m, stops, params: p, multiJours: true });
    return { visites: ids.length, km: plan.totalKm, jours: plan.jours.length, ordre: ordre.map((i) => ids[i - 1]) };
  }

  // ------------------------------------------------------------------ petits composants
  function badgeStatut(info) {
    if (!info) return '';
    return (
      '<span class="badge" style="--c:' + D.STATUT_COULEUR[info.statut] + '">' + D.STATUT_LABEL[info.statut] + '</span>' +
      (info.important ? ' <span class="badge important" title="Compte important">★ Important</span>' : '')
    );
  }
  function mentionEstimation() {
    const p = P();
    return (
      'Distances et horaires <b>estimés</b> (vol d’oiseau × ' + String(p.coefRoutier).replace('.', ',') + ', ' +
      p.vitesseMoyenneKmh + ' km/h, trajets majorés de ' + p.margeTrajetPct + ' %).'
    );
  }
  function alertesHtml(alertes) {
    if (!alertes.length) return '';
    return '<ul class="alertes">' + alertes.map((a) => '<li class="' + a.niveau + '">' + esc(a.texte) + '</li>').join('') + '</ul>';
  }
  function libelleJour(iso) {
    const s = U.fmtDateLongue(iso);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const telLien = (t) => '<a href="tel:' + esc(t.replace(/\s/g, '')) + '">' + esc(t) + '</a>';
  const pct = (x) => Math.round(x * 100) + ' %';
  function raisonsHtml(info) {
    const a = info.aVoir;
    if (a && a.est) return '<span class="raisons">' + esc(a.raisons.join(' · ')) + '</span>';
    return '<span class="raisons a-jour">à jour (vu ' + esc(U.fmtAnciennete(info.derniereVisite, A.today)) + ')</span>';
  }
  function badgeStatutTournee(k) {
    if (k.prete) return '<span class="badge" style="--c:#15803d">Prête</span>';
    return '<span class="badge" style="--c:#b45309">' + k.confirmes + '/' + k.plan.nbVisites + ' RDV confirmés</span>';
  }
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('visible'), 2500);
  }

  // ------------------------------------------------------------------ cartes Leaflet
  /*
   * Fond de carte : Plan IGN de la Géoplateforme (service public, gratuit, sans clé, Licence Ouverte Etalab).
   * Les serveurs d'OpenStreetMap refusent les pages ouvertes depuis un fichier local (pas d'en-tête Referer).
   */
  const FOND_DE_CARTE = {
    url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    options: { minZoom: 2, maxZoom: 18, attribution: '© <a href="https://www.ign.fr/">IGN</a> – Géoplateforme' },
  };
  function nouvelleCarte(el) {
    const map = L.map(el, { preferCanvas: true, zoomSnap: 0.5 });
    const fond = L.tileLayer(FOND_DE_CARTE.url, FOND_DE_CARTE.options).addTo(map);
    // message seulement si aucune tuile ne se charge (pas de réseau, page intégrée qui bloque les images externes)
    let tuilesChargees = 0;
    let msg = null;
    fond.on('tileload', () => {
      tuilesChargees++;
      if (msg) {
        msg.remove();
        msg = null;
      }
    });
    fond.on('tileerror', () => {
      if (tuilesChargees || msg) return;
      msg = L.DomUtil.create('div', 'carte-sans-fond', el);
      msg.textContent = 'Fond de carte indisponible ici (réseau ou page intégrée) : les informations restent affichées.';
    });
    A.cartes.push(map);
    return map;
  }
  function detruireCartes() {
    A.cartes.forEach((m) => m.remove());
    A.cartes = [];
  }
  function popupCompte(c) {
    const info = A.der.infos.get(c.id);
    return (
      '<div class="popup"><b>' + esc(c.raisonSociale) + '</b><br>' + esc(c.commune) + ' · ' + D.STATUT_LABEL[info.statut] +
      '<div class="popup-actions"><button data-action="fiche" data-id="' + c.id + '">Fiche</button></div></div>'
    );
  }
  const ll = (p) => [p.lat, p.lng];
  function pinDomicile(map, com) {
    L.marker(ll(com.domicile), { icon: L.divIcon({ className: 'pin-domicile', html: '⌂', iconSize: [28, 28] }) })
      .addTo(map)
      .bindTooltip('Domicile · ' + esc(com.domicile.commune));
  }

  /** Centre de chaque département, calculé une fois depuis le référentiel des communes. */
  let centresDep = null;
  function centreDepartement(d) {
    if (!centresDep) {
      centresDep = new Map();
      for (const x of window.TC_COMMUNES || []) {
        const e = centresDep.get(x[1]) || { lat: 0, lng: 0, n: 0 };
        e.lat += x[2];
        e.lng += x[3];
        e.n += 1;
        centresDep.set(x[1], e);
      }
    }
    const e = centresDep.get(d);
    return e ? { lat: e.lat / e.n, lng: e.lng / e.n } : null;
  }
  /** Couleur d'intensité (jaune pâle → orange brûlé) pour une part entre 0 et 1. */
  function couleurCharge(t) {
    const pal = ['#fef3c7', '#fcd34d', '#f59e0b', '#ea580c', '#9a3412'];
    return pal[Math.min(pal.length - 1, Math.floor(Math.max(0, t) * pal.length))];
  }

  // ================================================================== PRÉPARER
  function nouvellePrep() {
    return {
      etape: 1,
      departements: new Set(),
      date: U.isoDay(U.prochainJourTournee(A.today, false)),
      selection: new Set(),
      activite: 'toutes',
      type: 'tous',
      aVoirSeulement: true,
      tourneeId: null,
    };
  }
  function ouvrirTournee(t) {
    A.prep = Object.assign(nouvellePrep(), {
      etape: 3,
      tourneeId: t.id,
      date: t.date,
      departements: new Set(t.departements && t.departements.length ? t.departements : t.etapes.map((e) => compte(e.compteId).departement)),
      selection: new Set(t.etapes.map((e) => e.compteId)),
    });
  }
  const mesInfos = () => [...A.der.infos.values()].filter((i) => i.compte.commercialId === A.profil.commercialId);

  function vuePreparer() {
    if (!A.prep) return accueilPreparer();
    const e = A.prep.etape;
    const stepper =
      '<ol class="etapes-parcours">' + ETAPES_PREP.map((lib, i) =>
        '<li class="' + (i + 1 === e ? 'en-cours' : i + 1 < e ? 'faite' : '') + '"' + (i + 1 === e ? ' aria-current="step"' : '') + '>' +
        '<span class="pastille-etape">' + (i + 1 < e ? '✓' : i + 1) + '</span>' + lib + '</li>').join('') +
      '</ol>';
    const corps = e === 1 ? prepEtape1() : e === 2 ? prepEtape2() : prepEtape3();
    return '<div class="parcours"><div class="titre-ligne">' + stepper +
      '<button class="lien" data-action="prep-quitter">← Mes tournées</button></div>' + corps + '</div>';
  }

  function accueilPreparer() {
    const tours = tourneesAVenir(A.profil.commercialId);
    const aVoir = mesInfos().filter((i) => i.aVoir.est).length;
    const items = tours.map(({ t, k }) => {
      const n = k.plan.jours.length;
      return (
        '<li><button class="tournee-item" data-action="prep-ouvrir" data-id="' + t.id + '">' +
        '<b>' + esc(libelleJour(t.date)) + '</b>' +
        '<span>' + U.nb(k.plan.nbVisites, 'visite') + ' · ' + U.fmtKm(k.plan.totalKm) + (n > 1 ? ' · ' + n + ' jours' : '') + '</span>' +
        '<span class="meta">' + esc((t.departements || []).map((d) => D.DEPARTEMENTS[d] || d).join(', ')) + '</span>' +
        badgeStatutTournee(k) + '</button></li>'
      );
    }).join('');
    return (
      '<section class="panneau accueil"><h2>Préparer une tournée</h2>' +
      '<p>Vous avez <b>' + U.nb(aVoir, 'compte') + ' à voir</b> dans votre secteur : en retard sur leur fréquence de visite, à risque, avec un devis en attente ou prospects chauds.</p>' +
      '<p class="aide">Trois étapes : choisir où aller, choisir qui voir, puis caler les rendez-vous aux heures proposées.</p>' +
      '<button class="primaire grand" data-action="prep-nouvelle">Préparer une nouvelle tournée</button></section>' +
      '<section class="panneau"><h2>Mes tournées préparées</h2>' +
      (items ? '<ul class="liste-tournees">' + items + '</ul>' : '<p class="aide">Aucune tournée à venir.</p>') + '</section>'
    );
  }

  // ---------- étape 1 : où aller ?
  function prepEtape1() {
    const com = commercial(A.profil.commercialId);
    const sec = secteur(com.secteurId);
    const charges = D.chargeParDepartement(mesInfos());
    const parDep = new Map(charges.map((c) => [c.departement, c]));
    const lignes = sec.departements
      .map((d) => parDep.get(d) || { departement: d, comptes: 0, aVoir: 0, retard: 0, risque: 0, devis: 0, chaud: 0 })
      .sort((a, b) => b.aVoir - a.aVoir || a.departement.localeCompare(b.departement));
    A.vue.charges = lignes;
    const max = lignes.length ? lignes[0].aVoir : 0;
    const p = A.prep;
    const detail = (c) => [
      c.retard ? U.nb(c.retard, 'en retard', 'en retard') : '',
      c.risque ? U.nb(c.risque, 'client à risque', 'clients à risque') : '',
      c.devis ? U.nb(c.devis, 'devis en attente', 'devis en attente') : '',
      c.chaud ? U.nb(c.chaud, 'prospect chaud', 'prospects chauds') : '',
    ].filter(Boolean).join(' · ');
    return (
      '<div class="grille-prep"><section class="panneau"><h2>1. Où aller ?</h2>' +
      '<p class="aide">Nombre de comptes à voir par département. Choisissez un ou plusieurs départements.</p>' +
      '<ul class="departements">' + lignes.map((c, i) =>
        '<li class="' + (p.departements.has(c.departement) ? 'choisi' : '') + (i === 0 && c.aVoir ? ' plus-charge' : '') + '">' +
        '<label><input type="checkbox" data-action="prep-dep" value="' + c.departement + '"' + (p.departements.has(c.departement) ? ' checked' : '') + '>' +
        '<span class="dep-nom">' + esc(nomDep(c.departement)) + (i === 0 && c.aVoir ? ' <span class="badge" style="--c:#9a3412">Le plus chargé</span>' : '') + '</span>' +
        '<span class="dep-total" style="--fond:' + couleurCharge(max ? c.aVoir / max : 0) + '">' + c.aVoir + '</span></label>' +
        '<div class="dep-detail">' + (c.aVoir ? esc(detail(c)) : 'Rien d’urgent') + ' <span class="meta">· ' + U.nb(c.comptes, 'compte') + '</span></div></li>').join('') +
      '</ul>' +
      '<label class="champ-date">Date de début <input type="date" data-action="prep-date" value="' + p.date + '"></label>' +
      (U.estJourTournee(U.parseDay(p.date)) ? '' : '<p class="alerte-ligne">Les tournées ont lieu du mardi au vendredi (lundi au bureau).</p>') +
      '<div class="navigation-parcours"><span></span><button class="primaire" data-action="prep-suivant"' + (p.departements.size ? '' : ' disabled') + '>Suivant : qui voir ? →</button></div>' +
      '</section><div id="carte-prep" class="carte-map haute"></div></div>'
    );
  }
  function apresEtape1() {
    const el = document.getElementById('carte-prep');
    const map = nouvelleCarte(el);
    const com = commercial(A.profil.commercialId);
    pinDomicile(map, com);
    const lignes = A.vue.charges;
    const max = lignes.length ? Math.max(1, lignes[0].aVoir) : 1;
    const bornes = [ll(com.domicile)];
    for (const c of lignes) {
      const ctr = centreDepartement(c.departement);
      if (!ctr) continue;
      // la Corse n'entre dans le cadrage que si elle est choisie (sinon la carte dézoome trop)
      if (!TC.geo.estCorse(ctr) || A.prep.departements.has(c.departement)) bornes.push(ll(ctr));
      const taille = 34 + Math.round(26 * Math.sqrt(c.aVoir / max));
      const choisi = A.prep.departements.has(c.departement);
      L.marker(ll(ctr), {
        icon: L.divIcon({
          className: 'pin-dep' + (choisi ? ' choisi' : ''),
          html: '<span style="--fond:' + couleurCharge(c.aVoir / max) + '"><b>' + c.aVoir + '</b><small>' + c.departement + '</small></span>',
          iconSize: [taille, taille],
        }),
      })
        .addTo(map)
        .bindTooltip(esc(nomDep(c.departement)) + ' : ' + c.aVoir + ' à voir')
        .on('click', () => {
          A.prep.departements.has(c.departement) ? A.prep.departements.delete(c.departement) : A.prep.departements.add(c.departement);
          render();
        });
    }
    map.fitBounds(bornes, { padding: [30, 30] });
  }

  // ---------- étape 2 : qui voir ?
  function candidatsEtape2() {
    const p = A.prep;
    return D.trierParPriorite(
      mesInfos().filter((i) => {
        const c = i.compte;
        if (p.selection.has(c.id)) return true;
        if (!p.departements.has(c.departement)) return false;
        if (c.etape === 'perdu' || c.etape === 'gagne') return false;
        if (p.activite !== 'toutes' && !(c.activites || []).includes(p.activite)) return false;
        if (p.type !== 'tous' && c.type !== p.type) return false;
        if (p.aVoirSeulement && !i.aVoir.est) return false;
        return true;
      }),
      A.today,
    );
  }
  function prepEtape2() {
    const p = A.prep;
    const com = commercial(A.profil.commercialId);
    const liste = candidatsEtape2();
    const est = estimer(com, [...p.selection]);
    const message = !est.visites
      ? 'Cochez des comptes, ou utilisez la présélection automatique.'
      : est.jours > 1
        ? 'La sélection dépasse une journée : la tournée passera sur ' + est.jours + ' jours (nuit sur place). Vous pourrez accepter ou refuser à l’étape suivante.'
        : 'La sélection tient sur une journée.';
    return (
      '<section class="panneau"><h2>2. Qui voir ?</h2>' +
      '<p class="aide">Départements : ' + esc([...p.departements].map(nomDep).join(', ')) + '. Les comptes les plus urgents sont en haut.</p>' +
      '<div class="filtres-ligne">' +
      '<label>Activité <select data-action="prep-activite"><option value="toutes">Toutes</option>' +
      D.ACTIVITES.map((a) => '<option value="' + a + '"' + (p.activite === a ? ' selected' : '') + '>' + D.ACTIVITE_LABEL[a] + '</option>').join('') + '</select></label>' +
      '<label>Type <select data-action="prep-type"><option value="tous">Tous</option>' +
      D.TYPES.map((t) => '<option value="' + t + '"' + (p.type === t ? ' selected' : '') + '>' + D.TYPE_LABEL[t] + '</option>').join('') + '</select></label>' +
      '<label class="case"><input type="checkbox" data-action="prep-a-voir"' + (p.aVoirSeulement ? ' checked' : '') + '> Seulement les comptes à voir</label>' +
      '<div class="actions"><button class="primaire" data-action="prep-preselection">Présélection automatique</button>' +
      (p.selection.size ? '<button data-action="prep-vider">Tout décocher</button>' : '') + '</div></div>' +
      '<div class="compteur-direct' + (est.jours > 1 ? ' multi' : '') + '" role="status" aria-live="polite">' +
      '<span><b>' + U.nb(est.visites, 'visite') + '</b></span><span><b>' + U.fmtKm(est.km) + '</b> estimés</span><span><b>' + U.nb(est.jours, 'jour') + '</b></span>' +
      '<span class="message">' + message + '</span></div>' +
      (liste.length
        ? '<ul class="comptes-choix">' + liste.map((i) => {
            const c = i.compte;
            const coche = p.selection.has(c.id);
            return (
              '<li class="' + (coche ? 'choisi' : '') + '"><label><input type="checkbox" data-action="prep-compte" value="' + c.id + '"' + (coche ? ' checked' : '') + '>' +
              '<span class="compte-corps"><span class="compte-titre">' + esc(c.raisonSociale) + '</span> ' +
              '<span class="meta">' + esc(c.commune) + ' (' + c.departement + ') · ' + D.TYPE_LABEL[c.type] + ' · ' + (c.activites || []).map((a) => D.ACTIVITE_LABEL[a]).join(', ') + '</span><br>' +
              raisonsHtml(i) + '</span></label>' +
              '<button class="lien" data-action="fiche" data-id="' + c.id + '">Fiche</button></li>'
            );
          }).join('') + '</ul>'
        : '<p class="aide">Aucun compte ne correspond à ces filtres.</p>') +
      '<p class="estimation">' + mentionEstimation() + '</p>' +
      '<div class="navigation-parcours"><button data-action="prep-retour">← Retour</button>' +
      '<button class="primaire" data-action="prep-suivant"' + (p.selection.size ? '' : ' disabled') + '>Suivant : caler les rendez-vous →</button></div>' +
      '</section>'
    );
  }

  /** Remplit la sélection avec les comptes à voir les plus urgents, tant que la tournée tient dans le temps disponible. */
  function preselectionner() {
    const p = A.prep;
    const com = commercial(A.profil.commercialId);
    const cands = candidatsEtape2().filter((i) => i.aVoir.est && !p.selection.has(i.compte.id));
    const sel = [...p.selection];
    // une journée ; deux si le premier compte est à plus du seuil de route aller (on dort sur place)
    let cible = 1;
    const ancre = sel.length ? compte(sel[0]) : cands.length ? cands[0].compte : null;
    if (ancre) {
      const m = R.matrix([com.domicile, ancre], P());
      if (m.minutesBrutes[0][1] > P().seuilAllerMultiJoursMin || estimer(com, [ancre.id]).jours > 1) cible = 2;
    }
    if (sel.length) cible = Math.max(cible, estimer(com, sel).jours);
    let essais = 0;
    for (const i of cands) {
      if (sel.length >= 12 || essais >= 30) break;
      essais++;
      const test = [...sel, i.compte.id];
      if (estimer(com, test).jours <= cible) sel.push(i.compte.id);
    }
    if (!sel.length && cands.length) sel.push(cands[0].compte.id);
    p.selection = new Set(sel);
    toast(U.nb(sel.length, 'compte présélectionné', 'comptes présélectionnés'));
  }

  /** Crée ou met à jour la tournée à partir de la sélection (étape 2 → étape 3). */
  function creerOuMajTournee() {
    const p = A.prep;
    const com = commercial(A.profil.commercialId);
    const ids = [...p.selection];
    const deps = [...new Set(ids.map((id) => compte(id).departement))].sort();
    let t = p.tourneeId ? tournee(p.tourneeId) : null;
    if (!t) {
      const now = U.isoDateTime(new Date());
      t = { id: U.uid('t'), commercialId: com.id, date: p.date, departements: deps, multiJours: false, decoupageRefuse: false, prospection: [], etapes: estimer(com, ids).ordre.map((id) => ({ compteId: id, confirme: false })), creeLe: now, modifieeLe: now };
      p.tourneeId = t.id;
    } else {
      // on garde l'ordre et les rendez-vous déjà confirmés, on insère les nouveaux au moindre détour
      t.date = p.date;
      t.departements = deps;
      t.etapes = t.etapes.filter((e) => p.selection.has(e.compteId));
      for (const id of ids) {
        if (t.etapes.some((e) => e.compteId === id)) continue;
        const pts = [com.domicile, ...t.etapes.map((e) => compte(e.compteId)), compte(id)];
        const m = R.matrix(pts, P());
        const pos = R.meilleureInsertion(t.etapes.map((_, i) => i + 1), pts.length - 1, m.km);
        t.etapes.splice(pos, 0, { compteId: id, confirme: false });
      }
    }
    enregistrerTournee(t);
  }

  // ---------- étape 3 : caler les rendez-vous
  function prepEtape3() {
    const t = tournee(A.prep.tourneeId);
    if (!t) {
      A.prep.etape = 2;
      return prepEtape2();
    }
    const k = calc(t);
    A.vue = { t, k };
    const n = k.plan.jours.length;
    const fin = k.plan.jours[n - 1].planning.finMin;
    return (
      '<div class="grille-prep"><section class="panneau"><h2>3. Caler les rendez-vous</h2>' +
      '<p class="aide">Appelez chaque compte en proposant l’heure indiquée, puis cliquez sur « Rendez-vous confirmé ». Glissez les visites pour changer l’ordre : horaires et kilomètres sont recalculés.</p>' +
      '<div class="titre-ligne"><label class="champ-date">' + (n > 1 ? 'Premier jour' : 'Date') + ' <input type="date" value="' + t.date + '" data-action="date-tournee"></label>' +
      '<div class="actions"><button data-action="optimiser"' + (t.etapes.length < 2 ? ' disabled' : '') + '>Recalculer le meilleur ordre</button>' +
      '<button class="lien danger" data-action="supprimer-tournee">Supprimer la tournée</button></div></div>' +
      '<div class="resume"><span><b>' + k.plan.nbVisites + '</b> visite' + (k.plan.nbVisites > 1 ? 's' : '') + '</span><span><b>' + U.fmtKm(k.plan.totalKm) + '</b></span>' +
      '<span><b>' + n + '</b> jour' + (n > 1 ? 's' : '') + '</span>' + (t.etapes.length ? '<span>retour prévu <b>' + U.fmtHeure(fin) + '</b></span>' : '') + '</div>' +
      (k.prete
        ? '<div class="bandeau pret">✓ Tournée prête : tous les rendez-vous sont confirmés.</div>'
        : '<div class="bandeau discret">' + k.confirmes + ' rendez-vous confirmés sur ' + k.plan.nbVisites + '. La tournée sera prête quand tous seront confirmés.</div>') +
      '<p class="estimation">' + mentionEstimation() + '</p>' +
      blocDecoupage(t, k) + alertesHtml(k.alertes) +
      (t.etapes.length ? k.plan.jours.map((j, i) => jourHtml(t, k, j, i)).join('') : '<p class="aide">Tournée vide : revenez à l’étape 2 pour choisir des comptes.</p>') +
      '<div class="navigation-parcours"><button data-action="prep-retour">← Retour : qui voir ?</button>' +
      '<button class="primaire" data-action="prep-quitter">Terminer</button></div>' +
      '</section><div id="carte-tournee" class="carte-map haute"></div></div>'
    );
  }

  function blocDecoupage(t, k) {
    const p = P();
    const n = k.plan.jours.length;
    if (t.multiJours) {
      return (
        '<div class="bandeau info">Tournée sur ' + n + ' jour' + (n > 1 ? 's' : '') + ' : chaque soir, nuit dans la commune de la dernière visite ; ' +
        'le lendemain repart de ce point. Le dernier jour se termine au domicile. ' +
        '<button class="lien" data-action="un-jour">Revenir à une seule journée</button></div>'
      );
    }
    const a = k.analyse;
    if (!a || !a.propose) return '';
    if (t.decoupageRefuse) {
      return '<div class="bandeau discret">Passage à ' + a.nbJours + ' jours refusé. <button class="lien" data-action="revoir-decoupage">Revoir la proposition</button></div>';
    }
    const raisons = a.raisons.map((r) => {
      if (r.type === 'eloigne') {
        const noms = r.indices.map((i) => esc(k.comptes[i - 1].commune)).join(', ');
        return r.indices.length + ' visite' + (r.indices.length > 1 ? 's' : '') + ' à plus de ' + U.fmtDuree(p.seuilAllerMultiJoursMin) + ' de route du domicile (' + noms + ')';
      }
      return 'sur une seule journée, retour prévu à ' + U.fmtHeure(r.finMin) + ', après ' + U.fmtHeure(U.hhmmToMin(p.heureLimiteRetour));
    });
    return (
      '<div class="bandeau proposition"><b>Proposition : faire cette tournée sur ' + a.nbJours + ' jours.</b>' +
      '<ul>' + raisons.map((r) => '<li>' + r + '</li>').join('') + '</ul>' +
      '<p>L’ordre des visites est conservé. Chaque soir, nuit dans la commune de la dernière visite ; le dernier jour se termine au domicile.</p>' +
      '<div class="actions"><button class="primaire" data-action="accepter-decoupage">Accepter (' + a.nbJours + ' jours)</button>' +
      '<button data-action="refuser-decoupage">Refuser, garder une journée</button></div></div>'
    );
  }

  function jourHtml(t, k, j, n) {
    const p = P();
    const multi = k.plan.jours.length > 1;
    const depuis = j.planning.depuis === 0 ? 'du domicile' : 'de ' + esc(k.points[j.planning.depuis].nom);
    let html =
      '<div class="jour"' + (multi ? ' style="--jour:' + COULEURS_JOURS[n % COULEURS_JOURS.length] + '"' : '') + '>' +
      '<h3>' + (multi ? 'Jour ' + (n + 1) + ' · ' : '') + esc(libelleJour(k.dates[n])) + '</h3>' +
      '<p class="meta">Départ ' + U.fmtHeure(U.hhmmToMin(p.heureDepart)) + ' ' + depuis + ' · ' + U.nb(j.stops.length, 'visite') + ' · ' + U.fmtKm(j.planning.totalKm) + '</p>' +
      '<ol class="etapes">';
    for (const s of j.planning.stops) {
      const i = s.index - 1;
      const e = t.etapes[i];
      const c = compte(e.compteId);
      const info = A.der.infos.get(c.id);
      if (s.pauseAvantMin) {
        html += '<li class="pause">Pause déjeuner ' + U.fmtHeure(s.arriveeMin) + ' – ' + U.fmtHeure(s.arriveeMin + s.pauseAvantMin) + '</li>';
      }
      const decale = e.confirme && e.heureConfirmee != null && e.heureConfirmee !== s.debutRdvMin;
      html +=
        '<li class="etape' + (e.confirme ? ' confirmee' : '') + '" draggable="true" data-i="' + i + '">' +
        '<span class="poignee" title="Glisser pour déplacer" aria-hidden="true">⠿</span>' +
        '<span class="num">' + (i + 1) + '</span>' +
        '<div class="heure"><b>' + U.fmtHeure(e.confirme && e.heureConfirmee != null ? e.heureConfirmee : s.debutRdvMin) + '</b><small>' + (e.confirme ? 'RDV confirmé' : 'heure à proposer') + '</small></div>' +
        '<div class="corps"><button class="lien titre" data-action="fiche" data-id="' + c.id + '">' + esc(c.raisonSociale) + '</button>' +
        '<div class="meta">' + esc(c.commune) + ' · ' + esc(c.contact.prenom + ' ' + c.contact.nom) + ' · ' + telLien(c.contact.telephone) + '</div>' +
        '<div class="meta">' + raisonsHtml(info) + ' · trajet ' + U.fmtKm(s.legKm) + ', ' + U.fmtDuree(s.legMin) + '</div>' +
        (decale ? '<div class="alerte-ligne">L’ordre a changé : l’heure calculée est maintenant ' + U.fmtHeure(s.debutRdvMin) + '. Rappelez le client ou remettez la visite à sa place.</div>' : '') +
        '</div>' +
        '<label class="duree" title="Durée de la visite"><input type="number" min="15" max="480" step="15" value="' + (e.dureeMin || p.dureeRdvMin) + '" data-action="duree" data-i="' + i + '"> min</label>' +
        '<div class="boutons">' +
        '<button class="' + (e.confirme ? 'ok' : '') + '" data-action="confirmer-rdv" data-i="' + i + '">' + (e.confirme ? '✓ Confirmé' : 'Rendez-vous confirmé') + '</button>' +
        '<span class="fleches"><button data-action="monter" data-i="' + i + '" title="Monter" aria-label="Monter" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
        '<button data-action="descendre" data-i="' + i + '" title="Descendre" aria-label="Descendre" ' + (i === t.etapes.length - 1 ? 'disabled' : '') + '>↓</button>' +
        '<button data-action="retirer" data-i="' + i + '" title="Retirer de la tournée" aria-label="Retirer">✕</button></span></div></li>';
    }
    html += '</ol>';

    const actif = (t.prospection || []).includes(n);
    html +=
      '<label class="case"><input type="checkbox" data-action="prospection" data-jour="' + n + '" ' + (actif ? 'checked' : '') + (j.stops.length ? '' : ' disabled') +
      '> Ajouter un créneau prospection en fin de journée (' + U.fmtDuree(p.dureeProspectionMin) + ')</label>';
    if (actif && j.planning.prospection) {
      const point = k.points[j.stops.at(-1).index];
      const liste = D.prospectsProches({ point, candidats: mesInfos(), exclus: new Set(t.etapes.map((e) => e.compteId)), rayonKm: p.rayonProspectionKm, today: A.today, coefRoutier: p.coefRoutier, max: 5 });
      html +=
        '<div class="prospection"><b>Prospection ' + U.fmtHeure(j.planning.prospection.debutMin) + ' – ' + U.fmtHeure(j.planning.prospection.finMin) + '</b> autour de ' + esc(point.nom) + '.' +
        (liste.length
          ? '<ul>' + liste.map((x) =>
              '<li><div><button class="lien titre" data-action="fiche" data-id="' + x.info.compte.id + '">' + esc(x.info.compte.raisonSociale) + '</button>' +
              '<div class="meta">' + esc(x.info.compte.commune) + ' · environ ' + U.fmtKm(x.distanceKm) + ' · ' + raisonsHtml(x.info) + '</div></div>' +
              '<button data-action="ajouter-prospect" data-id="' + x.info.compte.id + '" data-jour="' + n + '">Ajouter</button></li>').join('') + '</ul>'
          : '<p class="aide">Aucun prospect à moins de ' + p.rayonProspectionKm + ' km de la dernière visite.</p>') +
        '</div>';
    }
    if (j.planning.retour) {
      html += '<p class="fin-jour">Retour au domicile vers <b>' + U.fmtHeure(j.planning.retour.arriveeMin) + '</b> (' + U.fmtKm(j.planning.retour.legKm) + ', ' + U.fmtDuree(j.planning.retour.legMin) + ')</p>';
    } else if (j.stops.length) {
      html += '<p class="fin-jour nuit">Nuit à <b>' + esc(k.points[j.stops.at(-1).index].nom) + '</b> · fin de journée vers ' + U.fmtHeure(j.planning.finMin) + '</p>';
    }
    return html + '</div>';
  }

  function apresEtape3() {
    const el = document.getElementById('carte-tournee');
    if (!el || !A.vue.t) return;
    const map = nouvelleCarte(el);
    const { k } = A.vue;
    pinDomicile(map, k.com);
    const bornes = [ll(k.com.domicile)];
    k.plan.jours.forEach((j, n) => {
      const pts = [k.points[j.planning.depuis], ...j.stops.map((s) => k.points[s.index])];
      if (j.planning.retour) pts.push(k.points[0]);
      L.polyline(pts.map(ll), { color: COULEURS_JOURS[n % COULEURS_JOURS.length], weight: 4, opacity: 0.85, dashArray: n % 2 ? '8 6' : null }).addTo(map);
      j.stops.forEach((s) => {
        const c = k.comptes[s.index - 1];
        bornes.push(ll(c));
        L.marker(ll(c), { icon: L.divIcon({ className: 'pin-etape', html: String(s.index), iconSize: [24, 24] }) })
          .addTo(map)
          .bindTooltip(U.fmtHeure(s.debutRdvMin) + ' · ' + esc(c.raisonSociale))
          .bindPopup(popupCompte(c));
      });
    });
    if (bornes.length > 1) map.fitBounds(bornes, { padding: [30, 30] });
    else map.setView(bornes[0], 9);
  }

  // ================================================================== MA TOURNÉE (mobile)
  function vueMaTournee() {
    const tours = tourneesAVenir(A.profil.commercialId);
    if (!tours.length) return '<section class="panneau vide">Aucune tournée prévue. Préparez-la dans « Préparer ».</section>';
    const auj = U.isoDay(A.today);
    const x = tours.find((y) => y.t.id === A.maTourneeId) || tours.find((y) => y.k.dates.includes(auj)) || tours[0];
    A.maTourneeId = x.t.id;
    const { t, k } = x;
    if (A.maJourPour !== t.id) {
      A.maJour = Math.max(0, k.dates.indexOf(auj));
      A.maJourPour = t.id;
    }
    A.maJour = Math.min(A.maJour, k.plan.jours.length - 1);
    const j = k.plan.jours[A.maJour];
    const p = P();
    const depuis = j.planning.depuis === 0 ? 'du domicile' : 'de ' + esc(k.points[j.planning.depuis].nom);
    let html =
      '<div class="mobile"><label class="selecteur">Tournée <select data-action="ma-tournee">' +
      tours.map((y) => '<option value="' + y.t.id + '"' + (y.t.id === t.id ? ' selected' : '') + '>' + esc(U.fmtDateCourte(y.t.date)) +
        (y.k.plan.jours.length > 1 ? ' (' + y.k.plan.jours.length + ' jours)' : '') + ' · ' + U.nb(y.k.plan.nbVisites, 'visite') + '</option>').join('') +
      '</select></label>';
    if (k.plan.jours.length > 1) {
      html += '<div class="onglets" role="tablist">' + k.plan.jours.map((_, n) =>
        '<button role="tab" class="' + (n === A.maJour ? 'actif' : '') + '" data-action="ma-jour" data-jour="' + n + '">Jour ' + (n + 1) + '<small>' + esc(U.fmtDateCourte(k.dates[n])) + '</small></button>').join('') + '</div>';
    }
    html +=
      '<section class="resume-jour"><h2>' + esc(libelleJour(k.dates[A.maJour])) + '</h2>' +
      '<p>' + U.nb(j.stops.length, 'visite') + ' · ' + U.fmtKm(j.planning.totalKm) + ' · départ ' + U.fmtHeure(U.hhmmToMin(p.heureDepart)) + ' ' + depuis + '</p>' +
      '<p class="estimation">' + mentionEstimation() + '</p></section><ol class="visites">';
    for (const s of j.planning.stops) {
      const i = s.index - 1;
      const e = t.etapes[i];
      const c = compte(e.compteId);
      const info = A.der.infos.get(c.id);
      const v = e.visiteId ? A.data.visites.find((y) => y.id === e.visiteId) : null;
      const heure = e.confirme && e.heureConfirmee != null ? e.heureConfirmee : s.debutRdvMin;
      if (s.pauseAvantMin) html += '<li class="pause">Pause déjeuner ' + U.fmtHeure(s.arriveeMin) + ' – ' + U.fmtHeure(s.arriveeMin + s.pauseAvantMin) + '</li>';
      html +=
        '<li class="visite' + (v ? ' faite' : '') + '">' +
        '<div class="ligne1"><span class="heure">' + U.fmtHeure(heure) + '</span><span>' + (e.confirme ? '<span class="badge" style="--c:#15803d">RDV confirmé</span> ' : '') + badgeStatut(info) + '</span></div>' +
        '<h3><button class="lien titre" data-action="fiche" data-id="' + c.id + '">' + esc(c.raisonSociale) + '</button></h3>' +
        '<p>' + esc(c.adresse) + ', ' + esc(c.codePostal) + ' ' + esc(c.commune) + '</p>' +
        '<p>' + esc(c.contact.prenom + ' ' + c.contact.nom) + ' (' + esc(c.contact.fonction) + ') · ' + telLien(c.contact.telephone) + '</p>' +
        '<p class="meta">' + raisonsHtml(info) + (c.prochaineAction ? ' · À faire : ' + esc(c.prochaineAction.libelle) : '') + '</p>' +
        (v
          ? '<p class="cr-ok">✓ Compte-rendu enregistré : ' + D.RESULTAT_LABEL[v.resultat] + '</p><button data-action="cr-ouvrir" data-i="' + i + '">Modifier le compte-rendu</button>'
          : '<button class="primaire large" data-action="cr-ouvrir" data-i="' + i + '">Compte-rendu</button>') +
        (A.crOuvert === i ? formulaireCR(v) : '') +
        '</li>';
    }
    html += '</ol>';
    if (j.planning.prospection) html += '<p class="fin-jour">Prospection ' + U.fmtHeure(j.planning.prospection.debutMin) + ' – ' + U.fmtHeure(j.planning.prospection.finMin) + '</p>';
    html += j.planning.retour
      ? '<p class="fin-jour">Retour au domicile vers <b>' + U.fmtHeure(j.planning.retour.arriveeMin) + '</b></p>'
      : '<p class="fin-jour nuit">Nuit à <b>' + esc(k.points[j.stops.at(-1).index].nom) + '</b></p>';
    return html + '</div>';
  }

  function formulaireCR(v) {
    A.cr = { resultat: v ? v.resultat : null };
    const relances = [['1 sem.', 7], ['2 sem.', 14], ['1 mois', 30], ['3 mois', 91]];
    const actions = ['Envoyer le chiffrage', 'Relancer le devis', 'Envoyer la documentation', 'Planifier une démo'];
    return (
      '<form class="cr" data-action="cr-form">' +
      '<fieldset><legend>Résultat</legend><div class="resultats">' +
      D.RESULTATS.map((r) => '<button type="button" class="res-' + r + (A.cr.resultat === r ? ' actif' : '') + '" data-action="cr-resultat" data-v="' + r + '">' + D.RESULTAT_LABEL[r] + '</button>').join('') +
      '</div></fieldset>' +
      '<label>Prochaine action <input name="action" id="cr-action" value="' + esc(v && v.prochaineAction ? v.prochaineAction : '') + '"></label>' +
      '<div class="puces">' + actions.map((a) => '<button type="button" data-action="cr-puce-action" data-v="' + esc(a) + '">' + esc(a) + '</button>').join('') + '</div>' +
      '<label>Date de relance <input type="date" name="relance" id="cr-relance" value="' + esc(v && v.dateRelance ? v.dateRelance : '') + '"></label>' +
      '<div class="puces">' + relances.map((r) => '<button type="button" data-action="cr-puce-relance" data-v="' + U.isoDay(U.addDays(A.today, r[1])) + '">' + r[0] + '</button>').join('') + '</div>' +
      '<label>Note <textarea name="note" id="cr-note" rows="3">' + esc(v && v.note ? v.note : '') + '</textarea></label>' +
      '<p class="aide">Enregistré sur cet appareil, même sans réseau.</p>' +
      '<div class="actions"><button type="submit" class="primaire">Enregistrer</button><button type="button" data-action="cr-fermer">Annuler</button></div>' +
      '</form>'
    );
  }

  function enregistrerCR(form) {
    if (!A.cr || !A.cr.resultat) {
      toast('Choisissez un résultat');
      return;
    }
    const t = tournee(A.maTourneeId);
    const i = A.crOuvert;
    const e = t.etapes[i];
    const c = compte(e.compteId);
    const k = calc(t);
    let date = k.dates[0], s = null;
    k.plan.jours.forEach((j, n) => j.planning.stops.forEach((x) => {
      if (x.index === i + 1) {
        s = x;
        date = k.dates[n];
      }
    }));
    const action = form.elements.action.value.trim();
    const relance = form.elements.relance.value;
    const note = form.elements.note.value.trim();
    const heure = e.confirme && e.heureConfirmee != null ? e.heureConfirmee : s ? s.debutRdvMin : 540;
    const v = { id: e.visiteId || U.uid('v'), compteId: c.id, commercialId: t.commercialId, debut: date + 'T' + U.minToHhmm(heure) + ':00', dureeMin: e.dureeMin || P().dureeRdvMin, resultat: A.cr.resultat, tourneeId: t.id };
    if (action) v.prochaineAction = action;
    if (relance) v.dateRelance = relance;
    if (note) v.note = note;
    TC.dataService.saveVisite(v);
    A.data.visites = A.data.visites.filter((x) => x.id !== v.id).concat(v);
    e.visiteId = v.id;
    enregistrerTournee(t);
    if (action) {
      const c2 = Object.assign({}, c, { prochaineAction: { libelle: action, date: relance || U.isoDay(U.addDays(A.today, 14)) } });
      TC.dataService.saveCompte(c2);
      A.data.comptes = A.data.comptes.map((x) => (x.id === c2.id ? c2 : x));
    }
    indexer();
    A.crOuvert = null;
    render();
    toast('Compte-rendu enregistré');
  }

  // ================================================================== PILOTAGE (direction)
  function vuePilotage() {
    const f = A.pilotage;
    const r = D.pilotage({ data: A.data, der: A.der, today: A.today, periodeJours: f.periodeJours, secteurId: f.secteurId, activite: f.activite });
    A.vue.pilotage = r;
    const p = P();
    const s = r.synthese;
    const tuile = (val, lib, extra) => '<div class="tuile' + (extra || '') + '"><b>' + val + '</b><span>' + lib + '</span></div>';
    const totalAct = Object.values(r.parActivite).reduce((x, y) => x + y, 0) || 1;
    const maxAct = Math.max(1, ...Object.values(r.parActivite));
    return (
      '<div class="pilotage"><section class="panneau filtres-ligne">' +
      '<label>Période <select data-action="pil-periode">' + [[28, '4 dernières semaines'], [91, '3 derniers mois'], [365, '12 derniers mois']].map(([v, l]) =>
        '<option value="' + v + '"' + (f.periodeJours === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '<label>Secteur <select data-action="pil-secteur"><option value="tous">Tous les secteurs</option>' + A.data.secteurs.map((x) =>
        '<option value="' + x.id + '"' + (f.secteurId === x.id ? ' selected' : '') + '>' + esc(x.nom) + '</option>').join('') + '</select></label>' +
      '<label>Activité <select data-action="pil-activite"><option value="toutes">Toutes</option>' + D.ACTIVITES.map((a) =>
        '<option value="' + a + '"' + (f.activite === a ? ' selected' : '') + '>' + D.ACTIVITE_LABEL[a] + '</option>').join('') + '</select></label>' +
      '</section>' +
      '<div class="tuiles">' +
      tuile(U.fmtNombre(s.visites), 'visites réalisées') +
      tuile(s.visitesSemaineParCommercial.toFixed(1).replace('.', ','), 'visites par semaine et par commercial (objectif ' + p.objectifVisitesSemaine + ')', s.visitesSemaineParCommercial < p.objectifVisitesSemaine ? ' alerte' : '') +
      tuile(U.fmtNombre(s.kmParVisite), 'km par visite (estimés)') +
      tuile(U.fmtNombre(s.devis), 'devis demandés') +
      tuile(U.fmtNombre(s.commandes), 'commandes') +
      tuile(pct(s.partCompteRendu), 'visites avec compte-rendu') +
      '</div>' +
      '<section class="panneau"><h2>Par commercial</h2><div class="tableau-defilant"><table class="equipe"><thead><tr>' +
      '<th>Commercial</th><th class="nombre">Visites / semaine</th><th class="nombre">Km / visite</th><th class="nombre">Clients A et B vus dans leur fréquence</th>' +
      '<th class="nombre">Clients à risque sans visite prévue</th><th class="nombre">Visites avec compte-rendu</th><th class="nombre">Devis demandés</th><th class="nombre">Commandes</th>' +
      '</tr></thead><tbody>' + r.lignes.map((l) =>
        '<tr><td><b>' + esc(l.commercial.prenom + ' ' + l.commercial.nom) + '</b><div class="meta">' + esc(secteur(l.commercial.secteurId).nom) + '</div></td>' +
        '<td class="nombre">' + (l.alerteVisites ? '<span class="badge" style="--c:#b91c1c">' : '<span>') + l.visitesSemaine.toFixed(1).replace('.', ',') + '</span></td>' +
        '<td class="nombre">' + U.fmtNombre(l.kmParVisite) + '</td>' +
        '<td class="nombre">' + pct(l.partABDansFrequence) + '</td>' +
        '<td class="nombre">' + (l.risquesSansVisitePrevue ? '<b>' + l.risquesSansVisitePrevue + '</b>' : '0') + '</td>' +
        '<td class="nombre">' + pct(l.partCompteRendu) + '</td>' +
        '<td class="nombre">' + l.devis + '</td><td class="nombre">' + l.commandes + '</td></tr>').join('') +
      '</tbody></table></div><p class="aide">En rouge : moins de ' + p.objectifVisitesSemaine + ' visites par semaine. Données issues uniquement des visites déclarées et des tournées prévues ; kilomètres estimés à vol d’oiseau corrigé.</p></section>' +
      '<div class="grille-pilotage"><section class="panneau"><h2>Visites par activité</h2><ul class="jauges">' +
      D.ACTIVITES.map((a) =>
        '<li><span class="jauge-lib">' + D.ACTIVITE_LABEL[a] + '</span><span class="jauge"><span style="width:' + Math.round((r.parActivite[a] / maxAct) * 100) + '%"></span></span>' +
        '<span class="jauge-val">' + r.parActivite[a] + ' <span class="meta">(' + pct(r.parActivite[a] / totalAct) + ')</span></span></li>').join('') +
      '</ul><p class="aide">Une visite compte pour chaque activité du compte visité.</p></section>' +
      '<section class="panneau"><h2>Part des comptes à voir par secteur</h2><div id="carte-secteurs" class="carte-map"></div>' +
      '<p class="aide">Comptes en retard sur leur fréquence, à risque, avec un devis en attente ou prospects chauds.</p></section></div></div>'
    );
  }
  function apresPilotage() {
    const el = document.getElementById('carte-secteurs');
    if (!el) return;
    const map = nouvelleCarte(el);
    const bornes = [];
    for (const s of A.vue.pilotage.parSecteur) {
      if (!s.comptes) continue;
      bornes.push([s.lat, s.lng]);
      const choisi = A.pilotage.secteurId === s.secteur.id;
      L.marker([s.lat, s.lng], {
        icon: L.divIcon({ className: 'pin-dep' + (choisi ? ' choisi' : ''), html: '<span style="--fond:' + couleurCharge(s.partAVoir / 0.8) + '"><b>' + pct(s.partAVoir) + '</b><small>' + s.secteur.id + '</small></span>', iconSize: [54, 54] }),
      })
        .addTo(map)
        .bindTooltip(esc(s.secteur.nom) + ' : ' + s.aVoir + ' comptes à voir sur ' + s.comptes);
    }
    if (bornes.length) map.fitBounds(bornes, { padding: [40, 40] });
    else map.setView([46.6, 2.4], 5);
  }

  // ================================================================== PARAMÈTRES (direction)
  const CHAMPS = [
    ['Journée type', [
      ['heureDepart', 'Heure de départ', 'time'],
      ['dureeRdvMin', 'Durée de visite par défaut (min)', 'number', 5],
      ['pauseActive', 'Pause déjeuner', 'checkbox'],
      ['pauseDebut', 'Début de la pause', 'time'],
      ['pauseDureeMin', 'Durée de la pause (min)', 'number', 5],
      ['heureLimiteRetour', 'Heure limite de retour (alerte)', 'time'],
      ['tempsLibreMin', 'Temps libre réservé par jour (min)', 'number', 5],
    ]],
    ['Fréquence de visite', [
      ['frequenceAJours', 'Clients A : au moins une visite tous les (jours)', 'number', 1],
      ['frequenceBJours', 'Clients B : au moins une visite tous les (jours)', 'number', 1],
      ['frequenceCJours', 'Clients C : au moins une visite tous les (jours)', 'number', 1],
      ['objectifVisitesSemaine', 'Objectif de visites par semaine et par commercial', 'number', 1],
    ]],
    ['Trajets', [
      ['margeTrajetPct', 'Marge sur les temps de trajet (%)', 'number', 1],
      ['coefRoutier', 'Coefficient routier (× vol d’oiseau)', 'number', 0.05],
      ['vitesseMoyenneKmh', 'Vitesse moyenne (km/h)', 'number', 1],
      ['seuilAllerMultiJoursMin', 'Proposer plusieurs jours au-delà de (min de route aller)', 'number', 5],
      ['dureeProspectionMin', 'Durée du créneau prospection (min)', 'number', 5],
      ['rayonProspectionKm', 'Rayon de recherche des prospects (km)', 'number', 1],
    ]],
    ['Statuts des comptes', [
      ['seuilRisqueJours', 'Client à risque : aucune visite depuis plus de (jours)', 'number', 1],
      ['seuilBaisseCAPct', '… ou baisse du CA sur 6 mois de plus de (%)', 'number', 1],
      ['seuilCAReferenceBaisse', '… si le CA des 6 mois précédents atteint (€)', 'number', 100],
      ['seuilScoreChaud', 'Prospect chaud : score à partir de (/100)', 'number', 1],
      ['seuilCAImportant', 'Compte important : CA 12 mois à partir de (€)', 'number', 1000],
    ]],
  ];
  function vueParametres() {
    const p = P();
    return (
      '<div class="parametres">' +
      CHAMPS.map(([titre, champs]) =>
        '<section class="panneau"><h2>' + titre + '</h2>' + champs.map(([cle, lib, type, pas]) =>
          type === 'checkbox'
            ? '<label class="case"><input type="checkbox" id="param-' + cle + '" data-param="' + cle + '"' + (p[cle] ? ' checked' : '') + '> ' + lib + '</label>'
            : '<label class="param">' + lib + ' <input type="' + type + '" id="param-' + cle + '" data-param="' + cle + '" value="' + esc(p[cle]) + '"' + (pas ? ' step="' + pas + '" min="0"' : '') + '></label>').join('') +
        '</section>').join('') +
      '<section class="panneau"><h2>Données de démonstration</h2><p class="aide">Données fictives générées le ' + U.fmtDate(A.data.dateDonnees) +
      '. Les modifications sont stockées dans ce navigateur uniquement.</p>' +
      '<button class="danger" data-action="reinitialiser">Réinitialiser les données</button></section></div>'
    );
  }
  function changerParametre(el) {
    const cle = el.dataset.param;
    const p = Object.assign({}, P());
    if (el.type === 'checkbox') p[cle] = el.checked;
    else if (el.type === 'number') {
      const n = parseFloat(el.value);
      if (!isFinite(n) || n < 0) return;
      p[cle] = n;
    } else if (el.value) p[cle] = el.value;
    A.data.parametres = p;
    TC.dataService.saveParametres(p);
    indexer();
    toast('Paramètre enregistré');
  }

  // ================================================================== FICHE COMPTE
  function ficheHtml() {
    const c = compte(A.ficheId);
    if (!c) return '';
    const info = A.der.infos.get(c.id);
    const vs = (A.der.visitesParCompte.get(c.id) || []).slice().reverse();
    const ech = A.data.echanges.filter((e) => e.compteId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const dv = A.data.devis.filter((d) => d.compteId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const com = commercial(c.commercialId);
    const freq = c.nature === 'client' ? D.frequenceJours(c, P()) : null;
    let html =
      '<div class="modale-fond" data-action="fermer-fiche"></div><div class="modale" role="dialog" aria-modal="true" aria-label="Fiche compte">' +
      '<div class="titre-ligne"><h2>' + esc(c.raisonSociale) + '</h2><button class="fermer" data-action="fermer-fiche" aria-label="Fermer">✕</button></div>' +
      '<p>' + badgeStatut(info) + ' <span class="badge" style="--c:#475569">' + (c.nature === 'client' ? 'Client' : 'Prospect') + ' · ' + D.TYPE_LABEL[c.type] + '</span>' +
      ' <span class="badge" style="--c:#475569">Potentiel ' + D.POTENTIEL_LABEL[c.potentiel] + '</span></p>' +
      '<p><b>Activités :</b> ' + esc((c.activites || []).map((a) => D.ACTIVITE_LABEL[a]).join(', ')) + '</p>' +
      '<p><b>À voir :</b> ' + raisonsHtml(info) + '</p>' +
      '<div class="fiche-grille"><div><h3>Contact</h3><p>' + esc(c.contact.prenom + ' ' + c.contact.nom) + ' · ' + esc(c.contact.fonction) + '<br>' +
      telLien(c.contact.telephone) + '<br><a href="mailto:' + esc(c.contact.email) + '">' + esc(c.contact.email) + '</a></p>' +
      '<p>' + esc(c.adresse) + '<br>' + esc(c.codePostal + ' ' + c.commune) + '</p>' +
      '<p class="meta">Suivi par ' + esc(com.prenom + ' ' + com.nom) + '</p></div>' +
      '<div><h3>Suivi</h3><p>Dernière visite : <b>' + U.fmtAnciennete(info.derniereVisite, A.today) + '</b>' + (info.derniereVisite ? ' (' + U.fmtDate(info.derniereVisite) + ')' : '') + '</p>' +
      (freq ? '<p>Fréquence attendue : une visite tous les ' + D.dureeEnClair(freq) + '</p>' : '') +
      '<p>Prochaine action : ' + (c.prochaineAction ? '<b>' + esc(c.prochaineAction.libelle) + '</b> · ' + U.fmtDate(c.prochaineAction.date) : '—') + '</p>';
    if (c.nature === 'client') {
      html +=
        '<p>CA 12 mois : <b>' + U.fmtEuro(info.ca12m) + '</b><br><span class="meta">6 derniers mois ' + U.fmtEuro(info.ca6m) + ' · 6 mois précédents ' + U.fmtEuro(info.caPrec6m) + '</span></p>' +
        '<label class="case"><input type="checkbox" data-action="fiche-important"' + (c.important ? ' checked' : '') + '> Compte important</label>';
    } else {
      html += '<label class="param">Étape <select data-action="fiche-etape">' + D.ETAPES.map((e) => '<option value="' + e + '"' + (c.etape === e ? ' selected' : '') + '>' + D.ETAPE_LABEL[e] + '</option>').join('') + '</select></label>';
    }
    html += '</div></div>';
    html += '<h3>Devis</h3>' + (dv.length ? '<ul class="historique">' + dv.map((d) =>
      '<li><b>' + U.fmtDate(d.date) + '</b> · ' + esc(d.objet) + ' · ' + U.fmtEuro(d.montantHT) + ' HT · ' + D.STATUT_DEVIS_LABEL[d.statut] + '</li>').join('') + '</ul>' : '<p class="aide">Aucun devis.</p>');
    html += '<h3>Visites (' + vs.length + ')</h3>' + (vs.length ? '<ul class="historique">' + vs.slice(0, 12).map((v) =>
      '<li><b>' + U.fmtDate(v.debut) + '</b> · ' + (v.resultat ? D.RESULTAT_LABEL[v.resultat] : '<i>sans compte-rendu</i>') + (v.note ? ' · ' + esc(v.note) : '') + (v.prochaineAction ? ' <span class="meta">→ ' + esc(v.prochaineAction) + '</span>' : '') + '</li>').join('') + '</ul>' : '<p class="aide">Aucune visite.</p>');
    html += '<h3>Échanges</h3>' + (ech.length ? '<ul class="historique">' + ech.map((e) =>
      '<li><b>' + U.fmtDate(e.date) + '</b> · ' + D.CANAL_LABEL[e.canal] + ' · ' + esc(e.resume) + '</li>').join('') + '</ul>' : '<p class="aide">Aucun échange enregistré.</p>');
    return html + '</div>';
  }
  function majCompte(c, champs) {
    const c2 = Object.assign({}, c, champs);
    TC.dataService.saveCompte(c2);
    A.data.comptes = A.data.comptes.map((x) => (x.id === c2.id ? c2 : x));
    indexer();
    render();
  }

  // ================================================================== RENDU ET NAVIGATION
  function routes() {
    return A.profil.kind === 'manager'
      ? [['pilotage', 'Pilotage'], ['parametres', 'Paramètres']]
      : [['preparer', 'Préparer'], ['tournee', 'Ma tournée']];
  }
  function routeCourante() {
    const r = location.hash.replace(/^#\/?/, '');
    const ok = routes().map((x) => x[0]);
    return ok.includes(r) ? r : ok[0];
  }
  function enTete() {
    const opts = A.data.commerciaux.map((c) =>
      '<option value="c:' + c.id + '"' + (A.profil.kind === 'commercial' && A.profil.commercialId === c.id ? ' selected' : '') + '>' +
      esc(c.prenom + ' ' + c.nom + ' · ' + c.secteurId) + '</option>').join('');
    document.getElementById('profil').innerHTML =
      '<optgroup label="Commerciaux">' + opts + '</optgroup><option value="manager"' + (A.profil.kind === 'manager' ? ' selected' : '') + '>Direction commerciale</option>';
    document.getElementById('nav').innerHTML = routes()
      .map((r) => '<a href="#' + r[0] + '"' + (r[0] === A.route ? ' class="actif" aria-current="page"' : '') + '>' + r[1] + '</a>')
      .join('');
  }
  function render() {
    A.route = routeCourante();
    A.vue = {};
    detruireCartes();
    enTete();
    const main = document.getElementById('vue');
    const scroll = window.scrollY;
    const vues = { preparer: vuePreparer, tournee: vueMaTournee, pilotage: vuePilotage, parametres: vueParametres };
    main.innerHTML = vues[A.route]();
    if (A.route === 'preparer' && A.prep && A.prep.etape === 1) apresEtape1();
    if (A.route === 'preparer' && A.prep && A.prep.etape === 3) apresEtape3();
    if (A.route === 'pilotage') apresPilotage();
    document.getElementById('fiche').innerHTML = A.ficheId ? ficheHtml() : '';
    window.scrollTo(0, scroll);
  }
  function allerEtape(n) {
    A.prep.etape = n;
    render();
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ événements
  /**
   * Confirmation en deux clics, sans fenêtre du navigateur (bloquée dans certaines pages intégrées) :
   * le premier clic change le libellé du bouton, le second (dans les 5 s) valide.
   */
  function confirmer(el, libelle) {
    if (el.dataset.confirme === '1') return true;
    const initial = el.textContent;
    el.dataset.confirme = '1';
    el.textContent = libelle + ' ?';
    el.classList.add('a-confirmer');
    setTimeout(() => {
      if (!el.isConnected) return;
      el.dataset.confirme = '';
      el.textContent = initial;
      el.classList.remove('a-confirmer');
    }, 5000);
    return false;
  }

  function surClic(ev) {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    const t = A.prep && A.prep.tourneeId ? tournee(A.prep.tourneeId) : null;
    const i = el.dataset.i != null ? Number(el.dataset.i) : null;
    switch (a) {
      case 'prep-nouvelle':
        A.prep = nouvellePrep();
        render();
        break;
      case 'prep-ouvrir':
        ouvrirTournee(tournee(el.dataset.id));
        render();
        break;
      case 'prep-quitter':
        A.prep = null;
        render();
        break;
      case 'prep-retour':
        if (A.prep.etape === 3 && t) A.prep.selection = new Set(t.etapes.map((e) => e.compteId));
        allerEtape(A.prep.etape - 1);
        break;
      case 'prep-suivant':
        if (A.prep.etape === 1 && !A.prep.departements.size) break;
        if (A.prep.etape === 2) {
          if (!A.prep.selection.size) break;
          creerOuMajTournee();
        }
        allerEtape(A.prep.etape + 1);
        break;
      case 'prep-preselection':
        preselectionner();
        render();
        break;
      case 'prep-vider':
        A.prep.selection = new Set();
        render();
        break;
      case 'confirmer-rdv': {
        const k = calc(t);
        let heure = null;
        k.plan.jours.forEach((j) => j.planning.stops.forEach((s) => {
          if (s.index === i + 1) heure = s.debutRdvMin;
        }));
        majTournee(t, (x) => {
          const e = x.etapes[i];
          e.confirme = !e.confirme;
          e.heureConfirmee = e.confirme ? heure : null;
        });
        break;
      }
      case 'supprimer-tournee':
        if (t && confirmer(el, 'Confirmer la suppression')) {
          TC.dataService.deleteTournee(t.id);
          A.data.tournees = A.data.tournees.filter((x) => x.id !== t.id);
          A.prep = null;
          render();
          toast('Tournée supprimée');
        }
        break;
      case 'optimiser':
        if (t) {
          const ordre = R.optimizeOrder(calc(t).m.km);
          majTournee(t, (x) => {
            x.etapes = ordre.map((n) => x.etapes[n - 1]);
          });
          toast('Meilleur ordre recalculé');
        }
        break;
      case 'monter':
        deplacer(t, i, i - 1);
        break;
      case 'descendre':
        deplacer(t, i, i + 1);
        break;
      case 'retirer':
        majTournee(t, (x) => x.etapes.splice(i, 1));
        A.prep.selection = new Set(t.etapes.map((e) => e.compteId));
        break;
      case 'ajouter-prospect': {
        const k = calc(t);
        const jour = Number(el.dataset.jour);
        majTournee(t, (x) => {
          x.etapes.splice(k.plan.jours[jour].stops.at(-1).index, 0, { compteId: el.dataset.id, confirme: false });
        });
        A.prep.selection.add(el.dataset.id);
        toast('Prospect ajouté à la tournée');
        break;
      }
      case 'accepter-decoupage':
        majTournee(t, (x) => {
          x.multiJours = true;
          x.decoupageRefuse = false;
        });
        break;
      case 'refuser-decoupage':
        majTournee(t, (x) => (x.decoupageRefuse = true));
        break;
      case 'revoir-decoupage':
        majTournee(t, (x) => (x.decoupageRefuse = false));
        break;
      case 'un-jour':
        majTournee(t, (x) => {
          x.multiJours = false;
          x.decoupageRefuse = true;
          x.prospection = (x.prospection || []).filter((n) => n === 0);
        });
        break;
      case 'fiche':
        A.ficheId = el.dataset.id;
        document.getElementById('fiche').innerHTML = ficheHtml();
        break;
      case 'fermer-fiche':
        A.ficheId = null;
        document.getElementById('fiche').innerHTML = '';
        break;
      case 'ma-jour':
        A.maJour = Number(el.dataset.jour);
        A.crOuvert = null;
        render();
        break;
      case 'cr-ouvrir':
        A.crOuvert = i;
        render();
        break;
      case 'cr-fermer':
        A.crOuvert = null;
        render();
        break;
      case 'cr-resultat':
        A.cr.resultat = el.dataset.v;
        el.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('actif', b === el));
        break;
      case 'cr-puce-action':
        el.closest('form').elements.action.value = el.dataset.v;
        break;
      case 'cr-puce-relance':
        el.closest('form').elements.relance.value = el.dataset.v;
        break;
      case 'reinitialiser':
        if (confirmer(el, 'Confirmer : tout effacer et régénérer')) {
          A.data = TC.dataService.reset();
          indexer();
          A.prep = null;
          A.maTourneeId = A.ficheId = null;
          render();
          toast('Données réinitialisées');
        }
        break;
      default:
    }
  }

  function surChangement(ev) {
    const el = ev.target;
    if (el.id === 'profil') {
      A.profil = el.value === 'manager' ? { kind: 'manager' } : { kind: 'commercial', commercialId: el.value.slice(2) };
      ecrireProfil();
      A.prep = null;
      A.maTourneeId = A.ficheId = A.crOuvert = null;
      history.replaceState(null, '', '#' + routes()[0][0]);
      render();
      return;
    }
    if (el.dataset.param) {
      changerParametre(el);
      return;
    }
    const a = el.dataset.action;
    const t = A.prep && A.prep.tourneeId ? tournee(A.prep.tourneeId) : null;
    switch (a) {
      case 'prep-dep':
        el.checked ? A.prep.departements.add(el.value) : A.prep.departements.delete(el.value);
        render();
        break;
      case 'prep-date':
        if (el.value) {
          A.prep.date = el.value;
          render();
        }
        break;
      case 'prep-compte':
        el.checked ? A.prep.selection.add(el.value) : A.prep.selection.delete(el.value);
        render();
        break;
      case 'prep-activite':
        A.prep.activite = el.value;
        render();
        break;
      case 'prep-type':
        A.prep.type = el.value;
        render();
        break;
      case 'prep-a-voir':
        A.prep.aVoirSeulement = el.checked;
        render();
        break;
      case 'date-tournee':
        if (el.value && t) {
          A.prep.date = el.value;
          majTournee(t, (x) => (x.date = el.value));
        }
        break;
      case 'duree': {
        const n = parseInt(el.value, 10);
        if (n >= 5 && t) majTournee(t, (x) => (x.etapes[Number(el.dataset.i)].dureeMin = n));
        break;
      }
      case 'prospection': {
        const n = Number(el.dataset.jour);
        majTournee(t, (x) => {
          const s = new Set(x.prospection || []);
          if (el.checked) s.add(n);
          else s.delete(n);
          x.prospection = [...s].sort();
        });
        break;
      }
      case 'ma-tournee':
        A.maTourneeId = el.value;
        A.crOuvert = null;
        render();
        break;
      case 'pil-periode':
        A.pilotage.periodeJours = Number(el.value);
        render();
        break;
      case 'pil-secteur':
        A.pilotage.secteurId = el.value;
        render();
        break;
      case 'pil-activite':
        A.pilotage.activite = el.value;
        render();
        break;
      case 'fiche-important':
        majCompte(compte(A.ficheId), { important: el.checked });
        break;
      case 'fiche-etape':
        majCompte(compte(A.ficheId), { etape: el.value, etapeModifieeLe: U.isoDay(A.today) });
        break;
      default:
    }
  }

  // glisser-déposer des visites (ordinateur ; boutons ↑ ↓ sur mobile)
  function surDebutGlisser(ev) {
    const li = ev.target.closest && ev.target.closest('li.etape');
    if (!li) return;
    A.drag = Number(li.dataset.i);
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', li.dataset.i);
    li.classList.add('glisse');
  }
  function surSurvol(ev) {
    const li = ev.target.closest && ev.target.closest('li.etape');
    if (A.drag == null || !li) return;
    ev.preventDefault();
    document.querySelectorAll('li.etape.cible').forEach((x) => x !== li && x.classList.remove('cible'));
    li.classList.add('cible');
  }
  function surDepot(ev) {
    const li = ev.target.closest && ev.target.closest('li.etape');
    if (A.drag == null || !li) return;
    ev.preventDefault();
    const de = A.drag;
    A.drag = null;
    deplacer(tournee(A.prep.tourneeId), de, Number(li.dataset.i));
  }
  function surFinGlisser() {
    A.drag = null;
    document.querySelectorAll('li.etape.glisse, li.etape.cible').forEach((x) => x.classList.remove('glisse', 'cible'));
  }

  function demarrer() {
    charger();
    A.profil = lireProfil();
    document.addEventListener('click', surClic, true); // phase de capture : fonctionne aussi dans les popups de la carte
    document.addEventListener('change', surChangement);
    document.addEventListener('submit', (ev) => {
      if (ev.target.matches('form.cr')) {
        ev.preventDefault();
        enregistrerCR(ev.target);
      }
    });
    document.addEventListener('dragstart', surDebutGlisser);
    document.addEventListener('dragover', surSurvol);
    document.addEventListener('drop', surDepot);
    document.addEventListener('dragend', surFinGlisser);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && A.ficheId) {
        A.ficheId = null;
        document.getElementById('fiche').innerHTML = '';
      }
    });
    window.addEventListener('hashchange', () => {
      A.ficheId = null;
      A.crOuvert = null;
      render();
    });
    render();
  }

  TC.app = { demarrer, render, etat: A };
  document.addEventListener('DOMContentLoaded', demarrer);
})(window.TC);
