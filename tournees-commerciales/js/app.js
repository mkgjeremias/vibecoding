/*
 * Interface de l'application (une seule page, navigation par #ancre).
 * Écrans : Planifier, Ma tournée (mobile), Carte, Équipe (manager), Paramètres. Fiche compte en fenêtre.
 */
(function (TC) {
  'use strict';
  const U = TC.util, R = TC.routing, D = TC.domain, esc = U.esc;
  const CLE_PROFIL = 'tournees-commerciales.profil';
  const COULEURS_JOURS = ['#1d4ed8', '#c2410c', '#15803d', '#7c3aed', '#be185d'];

  const A = {
    data: null,
    der: null,
    comptesParId: new Map(),
    today: U.startOfDay(new Date()),
    profil: null,
    tourneeId: null,
    maTourneeId: null,
    maJour: 0,
    maJourPour: null,
    crOuvert: null,
    cr: null,
    recherche: '',
    filtres: null,
    cartes: [],
    coucheComptes: null,
    ficheId: null,
    drag: null,
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

  function lireProfil() {
    try {
      const p = JSON.parse(localStorage.getItem(CLE_PROFIL));
      if (p && (p.kind === 'manager' || (p.kind === 'commercial' && commercial(p.commercialId)))) return p;
    } catch (e) {
      /* rien */
    }
    const lim = A.data.commerciaux.find((c) => c.secteurId === 'limousin') || A.data.commerciaux[0];
    return { kind: 'commercial', commercialId: lim.id };
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
    return { com, comptes, points, m, plan, analyse, alertes: R.alertes(plan, points, p), dates: R.datesJours(t.date, plan.jours.length) };
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

  function majTournee(t, fn) {
    fn(t);
    t.modifieeLe = U.isoDateTime(new Date());
    TC.dataService.saveTournee(t);
    render();
  }

  function deplacer(t, de, vers) {
    if (de === vers || vers < 0 || vers >= t.etapes.length) return;
    majTournee(t, (x) => {
      const [e] = x.etapes.splice(de, 1);
      x.etapes.splice(vers, 0, e);
    });
  }

  function ajouterEtape(t, compteId, jour) {
    if (t.etapes.some((e) => e.compteId === compteId)) return;
    const k = calc(t);
    majTournee(t, (x) => {
      const e = { compteId };
      if (jour != null && k.plan.jours[jour] && k.plan.jours[jour].stops.length) {
        // créneau prospection : juste après la dernière visite du jour
        x.etapes.splice(k.plan.jours[jour].stops.at(-1).index, 0, e);
      } else {
        // ailleurs : à la position qui allonge le moins le circuit
        const c = compte(compteId);
        const pts = [...k.points, { lat: c.lat, lng: c.lng }];
        const m = R.matrix(pts, P());
        const pos = R.meilleureInsertion(x.etapes.map((_, i) => i + 1), pts.length - 1, m.km);
        x.etapes.splice(pos, 0, e);
      }
    });
    toast('Compte ajouté à la tournée');
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
    const prov = R.getProvider();
    return (
      'Distances et horaires sont des <b>estimations</b> (' + esc(prov.label) + ' : distance × ' + String(p.coefRoutier).replace('.', ',') + ', ' +
      p.vitesseMoyenneKmh + ' km/h, marge trajet ' + p.margeTrajetPct + ' %). Heures proposées pour la prise de rendez-vous.'
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
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('visible'), 2500);
  }

  // ------------------------------------------------------------------ cartes Leaflet
  function nouvelleCarte(el) {
    const map = L.map(el, { preferCanvas: true, zoomSnap: 0.5 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© contributeurs OpenStreetMap',
    }).addTo(map);
    A.cartes.push(map);
    return map;
  }
  function detruireCartes() {
    A.cartes.forEach((m) => m.remove());
    A.cartes = [];
    A.coucheComptes = null;
  }
  function popupCompte(c, ajout) {
    const info = A.der.infos.get(c.id);
    return (
      '<div class="popup"><b>' + esc(c.raisonSociale) + '</b><br>' + esc(c.commune) + ' · ' + D.STATUT_LABEL[info.statut] +
      '<div class="popup-actions"><button data-action="fiche" data-id="' + c.id + '">Fiche</button>' +
      (ajout ? '<button data-action="ajouter" data-id="' + c.id + '">Ajouter</button>' : '') + '</div></div>'
    );
  }
  const ll = (p) => [p.lat, p.lng];

  // ================================================================== PLANIFIER
  function vuePlanifier() {
    const com = commercial(A.profil.commercialId);
    const tours = tourneesAVenir(com.id);
    if (!tours.some((x) => x.t.id === A.tourneeId)) A.tourneeId = tours.length ? tours[0].t.id : null;
    const t = A.tourneeId ? tournee(A.tourneeId) : null;
    const k = t ? calc(t) : null;
    A.vue = { t, k };
    return (
      '<div class="grille-planifier"><div class="colonne">' +
      listeTournees(tours) +
      (t ? editeur(t, k) : '<section class="panneau vide">Aucune tournée prévue. Créez-en une avec « Nouvelle tournée ».</section>') +
      '</div><div class="colonne"><div id="carte-tournee" class="carte-map"></div>' +
      (t ? panneauAjout(t, k) : '') +
      '</div></div>'
    );
  }

  function listeTournees(tours) {
    const items = tours
      .map(({ t, k }) => {
        const n = k.plan.jours.length;
        return (
          '<li><button class="tournee-item' + (t.id === A.tourneeId ? ' actif' : '') + '" data-action="choisir-tournee" data-id="' + t.id + '">' +
          '<b>' + esc(U.fmtDateCourte(t.date)) + '</b>' + (n > 1 ? ' <span class="badge" style="--c:#7c3aed">' + n + ' jours</span>' : '') +
          '<span>' + U.nb(k.plan.nbVisites, 'visite') + ' · ' + U.fmtKm(k.plan.totalKm) + '</span></button></li>'
        );
      })
      .join('');
    return (
      '<section class="panneau"><div class="titre-ligne"><h2>Tournées planifiées</h2>' +
      '<button class="primaire" data-action="nouvelle-tournee">+ Nouvelle tournée</button></div>' +
      (items ? '<ul class="liste-tournees">' + items + '</ul>' : '<p class="aide">Aucune tournée à venir.</p>') +
      '</section>'
    );
  }

  function editeur(t, k) {
    const p = P();
    const n = k.plan.jours.length;
    const fin = k.plan.jours[n - 1].planning.finMin;
    const jourNonTournee = !U.estJourTournee(U.parseDay(t.date));
    return (
      '<section class="panneau">' +
      '<div class="titre-ligne"><label class="champ-date">' + (n > 1 ? 'Premier jour' : 'Date') +
      ' <input type="date" value="' + t.date + '" data-action="date-tournee"></label>' +
      '<div class="actions"><button data-action="optimiser" ' + (t.etapes.length < 2 ? 'disabled' : '') + '>Optimiser l’ordre</button>' +
      '<button class="lien danger" data-action="supprimer-tournee">Supprimer</button></div></div>' +
      (jourNonTournee ? '<p class="alerte-ligne">Ce jour n’est pas un jour de tournée : lundi au bureau, tournées du mardi au vendredi.</p>' : '') +
      '<div class="resume"><span><b>' + k.plan.nbVisites + '</b> visite' + (k.plan.nbVisites > 1 ? 's' : '') + '</span><span><b>' + U.fmtKm(k.plan.totalKm) + '</b></span>' +
      '<span><b>' + n + '</b> jour' + (n > 1 ? 's' : '') + '</span>' +
      (t.etapes.length ? '<span>retour prévu <b>' + U.fmtHeure(fin) + '</b></span>' : '') + '</div>' +
      '<p class="estimation">' + mentionEstimation() + '</p>' +
      blocDecoupage(t, k) +
      alertesHtml(k.alertes) +
      (t.etapes.length ? k.plan.jours.map((j, i) => jourHtml(t, k, j, i)).join('') : '<p class="aide">Tournée vide : ajoutez des comptes depuis les suggestions ou la recherche.</p>') +
      '</section>'
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
      return '<div class="bandeau discret">Découpage en ' + a.nbJours + ' jours refusé. <button class="lien" data-action="revoir-decoupage">Revoir la proposition</button></div>';
    }
    const raisons = a.raisons.map((r) => {
      if (r.type === 'eloigne') {
        const noms = r.indices.map((i) => esc(k.comptes[i - 1].commune)).join(', ');
        return r.indices.length + ' visite' + (r.indices.length > 1 ? 's' : '') + ' à plus de ' + U.fmtDuree(p.seuilAllerMultiJoursMin) + ' de route du domicile (' + noms + ')';
      }
      return 'retour prévu à ' + U.fmtHeure(r.finMin) + ' sur une seule journée, après ' + U.fmtHeure(U.hhmmToMin(p.heureLimiteRetour));
    });
    return (
      '<div class="bandeau proposition"><b>Proposition : répartir cette tournée sur ' + a.nbJours + ' jours.</b>' +
      '<ul>' + raisons.map((r) => '<li>' + r + '</li>').join('') + '</ul>' +
      '<p>L’ordre de passage est conservé. Chaque soir, nuit dans la commune de la dernière visite ; le dernier jour se termine au domicile.</p>' +
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
      html +=
        '<li class="etape" draggable="true" data-i="' + i + '">' +
        '<span class="poignee" title="Glisser pour déplacer" aria-hidden="true">⠿</span>' +
        '<span class="num">' + (i + 1) + '</span>' +
        '<div class="heure"><b>' + U.fmtHeure(s.debutRdvMin) + '</b><small>RDV proposé</small></div>' +
        '<div class="corps"><button class="lien titre" data-action="fiche" data-id="' + c.id + '">' + esc(c.raisonSociale) + '</button> ' +
        badgeStatut(info) + (e.visiteId ? ' <span class="badge" style="--c:#15803d">CR saisi</span>' : '') +
        '<div class="meta">' + esc(c.commune) + ' · trajet ' + U.fmtKm(s.legKm) + ' · ' + U.fmtDuree(s.legMin) + '</div></div>' +
        '<label class="duree" title="Durée de la visite"><input type="number" min="15" max="480" step="15" value="' + (e.dureeMin || p.dureeRdvMin) + '" data-action="duree" data-i="' + i + '"> min</label>' +
        '<div class="boutons">' +
        '<button data-action="monter" data-i="' + i + '" title="Monter" aria-label="Monter" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
        '<button data-action="descendre" data-i="' + i + '" title="Descendre" aria-label="Descendre" ' + (i === t.etapes.length - 1 ? 'disabled' : '') + '>↓</button>' +
        '<button data-action="retirer" data-i="' + i + '" title="Retirer" aria-label="Retirer">✕</button></div></li>';
    }
    html += '</ol>';

    // créneau prospection
    const actif = (t.prospection || []).includes(n);
    html +=
      '<label class="case"><input type="checkbox" data-action="prospection" data-jour="' + n + '" ' + (actif ? 'checked' : '') + (j.stops.length ? '' : ' disabled') +
      '> Créneau prospection en fin de journée (' + U.fmtDuree(p.dureeProspectionMin) + ')</label>';
    if (actif && j.planning.prospection) {
      const dernier = j.stops.at(-1);
      const point = k.points[dernier.index];
      const exclus = new Set(t.etapes.map((e) => e.compteId));
      const candidats = [...A.der.infos.values()].filter((x) => x.compte.commercialId === t.commercialId);
      const liste = D.prospectsProches({ point, candidats, exclus, rayonKm: p.rayonProspectionKm, today: A.today, coefRoutier: p.coefRoutier, max: 5 });
      html +=
        '<div class="prospection"><b>Prospection ' + U.fmtHeure(j.planning.prospection.debutMin) + ' – ' + U.fmtHeure(j.planning.prospection.finMin) +
        '</b> autour de ' + esc(point.nom) + '.' +
        (liste.length
          ? '<ul>' + liste.map((x) =>
              '<li><div><button class="lien titre" data-action="fiche" data-id="' + x.info.compte.id + '">' + esc(x.info.compte.raisonSociale) + '</button> ' +
              badgeStatut(x.info) + '<div class="meta">' + esc(x.info.compte.commune) + ' · environ ' + U.fmtKm(x.distanceKm) + ' · score ' + x.score + '</div></div>' +
              '<button data-action="ajouter" data-id="' + x.info.compte.id + '" data-jour="' + n + '">Ajouter</button></li>').join('') + '</ul>'
          : '<p class="aide">Aucun prospect à moins de ' + p.rayonProspectionKm + ' km de la dernière visite.</p>') +
        '</div>';
    }

    // fin de journée
    if (j.planning.retour) {
      html += '<p class="fin-jour">Retour au domicile vers <b>' + U.fmtHeure(j.planning.retour.arriveeMin) + '</b> (' + U.fmtKm(j.planning.retour.legKm) + ', ' + U.fmtDuree(j.planning.retour.legMin) + ')</p>';
    } else if (j.stops.length) {
      html += '<p class="fin-jour nuit">Nuit à <b>' + esc(k.points[j.stops.at(-1).index].nom) + '</b> · fin de journée vers ' + U.fmtHeure(j.planning.finMin) + '</p>';
    }
    return html + '</div>';
  }

  function panneauAjout(t, k) {
    const p = P();
    const route = [k.points[0], ...t.etapes.map((_, i) => k.points[i + 1]), k.points[0]];
    const exclus = new Set(t.etapes.map((e) => e.compteId));
    const candidats = [...A.der.infos.values()].filter((x) => x.compte.commercialId === t.commercialId);
    const sugg = D.suggerer({ route, candidats, exclus, rayonKm: p.rayonSuggestionKm, today: A.today, coefRoutier: p.coefRoutier }).slice(0, 12);
    A.vue.suggestions = sugg;
    return (
      '<section class="panneau"><h2>Suggestions à moins de ' + p.rayonSuggestionKm + ' km du trajet</h2>' +
      '<p class="aide">Classées par score : ancienneté de la dernière visite (jusqu’à 40), devis en cours (30), potentiel (jusqu’à 25), client à risque ou prospect chaud (10).</p>' +
      (sugg.length
        ? '<ul class="suggestions">' + sugg.map((s) =>
            '<li><div><button class="lien titre" data-action="fiche" data-id="' + s.info.compte.id + '">' + esc(s.info.compte.raisonSociale) + '</button> ' +
            badgeStatut(s.info) + ' <span class="score">' + s.score + ' pts</span>' +
            '<div class="meta">' + esc(s.info.compte.commune) + ' · à ' + U.fmtKm(s.distanceTraceKm) + ' du trajet · détour ≈ +' + U.fmtKm(s.detourKm) + '</div>' +
            (s.motifs.length ? '<div class="motifs">' + esc(s.motifs.join(' · ')) + '</div>' : '') + '</div>' +
            '<button data-action="ajouter" data-id="' + s.info.compte.id + '">Ajouter</button></li>').join('') + '</ul>'
        : '<p class="aide">Aucun compte à moins de ' + p.rayonSuggestionKm + ' km du trajet.</p>') +
      '<h3>Ajouter un autre compte</h3>' +
      '<input type="search" class="recherche" placeholder="Nom ou commune" data-action="recherche" value="' + esc(A.recherche) + '">' +
      '<ul id="resultats-recherche" class="suggestions">' + resultatsRecherche(t) + '</ul></section>'
    );
  }

  const normaliser = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function resultatsRecherche(t) {
    const q = normaliser(A.recherche.trim());
    if (q.length < 2) return '';
    const exclus = new Set(t.etapes.map((e) => e.compteId));
    const res = A.data.comptes
      .filter((c) => c.commercialId === t.commercialId && !exclus.has(c.id) && normaliser(c.raisonSociale + ' ' + c.commune).includes(q))
      .slice(0, 8);
    if (!res.length) return '<li class="aide">Aucun compte trouvé.</li>';
    return res
      .map((c) => '<li><div><button class="lien titre" data-action="fiche" data-id="' + c.id + '">' + esc(c.raisonSociale) + '</button> ' + badgeStatut(A.der.infos.get(c.id)) +
        '<div class="meta">' + esc(c.commune) + '</div></div><button data-action="ajouter" data-id="' + c.id + '">Ajouter</button></li>')
      .join('');
  }

  function apresPlanifier() {
    const el = document.getElementById('carte-tournee');
    if (!el) return;
    const map = nouvelleCarte(el);
    const com = commercial(A.profil.commercialId);
    const bornes = [ll(com.domicile)];
    L.marker(ll(com.domicile), { icon: L.divIcon({ className: 'pin-domicile', html: '⌂', iconSize: [28, 28] }) })
      .addTo(map)
      .bindTooltip('Domicile · ' + esc(com.domicile.commune));
    const { t, k } = A.vue;
    if (t) {
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
            .bindPopup(popupCompte(c, false));
        });
      });
      (A.vue.suggestions || []).forEach((s) => {
        const c = s.info.compte;
        L.circleMarker(ll(c), { radius: 6, color: '#fff', weight: 1.5, fillColor: D.STATUT_COULEUR[s.info.statut], fillOpacity: 0.95 })
          .addTo(map)
          .bindPopup(popupCompte(c, true));
      });
    }
    if (bornes.length > 1) map.fitBounds(bornes, { padding: [30, 30] });
    else map.setView(bornes[0], 10);
  }

  // ================================================================== MA TOURNÉE (mobile)
  function vueMaTournee() {
    const com = commercial(A.profil.commercialId);
    const tours = tourneesAVenir(com.id);
    if (!tours.length) return '<section class="panneau vide">Aucune tournée prévue. Préparez-la dans « Planifier ».</section>';
    const auj = U.isoDay(A.today);
    let x = tours.find((y) => y.t.id === A.maTourneeId) || tours.find((y) => y.k.dates.includes(auj)) || tours[0];
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
      if (s.pauseAvantMin) html += '<li class="pause">Pause déjeuner ' + U.fmtHeure(s.arriveeMin) + ' – ' + U.fmtHeure(s.arriveeMin + s.pauseAvantMin) + '</li>';
      html +=
        '<li class="visite' + (v ? ' faite' : '') + '">' +
        '<div class="ligne1"><span class="heure">' + U.fmtHeure(s.debutRdvMin) + '</span><span>' + badgeStatut(info) + '</span></div>' +
        '<h3><button class="lien titre" data-action="fiche" data-id="' + c.id + '">' + esc(c.raisonSociale) + '</button></h3>' +
        '<p>' + esc(c.adresse) + ', ' + esc(c.codePostal) + ' ' + esc(c.commune) + '</p>' +
        '<p>' + esc(c.contact.prenom + ' ' + c.contact.nom) + ' (' + esc(c.contact.fonction) + ') · ' + telLien(c.contact.telephone) + '</p>' +
        '<p class="meta">Dernière visite : ' + U.fmtAnciennete(info.derniereVisite, A.today) +
        (c.prochaineAction ? ' · À faire : ' + esc(c.prochaineAction.libelle) : '') + '</p>' +
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
      '<label>Prochaine action <input name="action" value="' + esc(v && v.prochaineAction ? v.prochaineAction : '') + '"></label>' +
      '<div class="puces">' + actions.map((a) => '<button type="button" data-action="cr-puce-action" data-v="' + esc(a) + '">' + esc(a) + '</button>').join('') + '</div>' +
      '<label>Date de relance <input type="date" name="relance" value="' + esc(v && v.dateRelance ? v.dateRelance : '') + '"></label>' +
      '<div class="puces">' + relances.map((r) => '<button type="button" data-action="cr-puce-relance" data-v="' + U.isoDay(U.addDays(A.today, r[1])) + '">' + r[0] + '</button>').join('') + '</div>' +
      '<label>Note <textarea name="note" rows="3">' + esc(v && v.note ? v.note : '') + '</textarea></label>' +
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
    const v = {
      id: e.visiteId || U.uid('v'),
      compteId: c.id,
      commercialId: t.commercialId,
      debut: date + 'T' + U.minToHhmm(s ? s.debutRdvMin : 540) + ':00',
      dureeMin: e.dureeMin || P().dureeRdvMin,
      resultat: A.cr.resultat,
      tourneeId: t.id,
    };
    if (action) v.prochaineAction = action;
    if (relance) v.dateRelance = relance;
    if (note) v.note = note;
    TC.dataService.saveVisite(v);
    A.data.visites = A.data.visites.filter((x) => x.id !== v.id).concat(v);
    e.visiteId = v.id;
    TC.dataService.saveTournee(t);
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

  // ================================================================== CARTE
  function filtresDefaut() {
    return { statuts: new Set(D.STATUTS), importants: false, potentiels: new Set(['A', 'B', 'C']), perimetre: A.profil.kind === 'manager' ? 'tous' : A.profil.commercialId };
  }
  function comptesFiltres() {
    const f = A.filtres;
    return [...A.der.infos.values()].filter((i) => {
      const c = i.compte;
      if (f.perimetre !== 'tous' && c.commercialId !== f.perimetre) return false;
      if (!f.statuts.has(i.statut)) return false;
      if (f.importants && !i.important) return false;
      if (!f.potentiels.has(c.potentiel)) return false;
      if (c.etape === 'perdu') return false;
      return true;
    });
  }
  function vueCarte() {
    if (!A.filtres) A.filtres = filtresDefaut();
    const f = A.filtres;
    const options = [['tous', 'Toute la France']].concat(A.data.commerciaux.map((c) => [c.id, c.prenom + ' ' + c.nom + ' · ' + secteur(c.secteurId).nom]));
    return (
      '<div class="grille-carte"><aside class="panneau filtres"><h2>Filtres</h2>' +
      '<label>Périmètre <select data-action="filtre-perimetre">' + options.map((o) => '<option value="' + o[0] + '"' + (f.perimetre === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>' +
      '<fieldset><legend>Statut</legend>' + D.STATUTS.map((s) =>
        '<label class="case"><input type="checkbox" data-action="filtre-statut" value="' + s + '"' + (f.statuts.has(s) ? ' checked' : '') + '> <span class="pastille" style="--c:' + D.STATUT_COULEUR[s] + '"></span>' + D.STATUT_LABEL[s] + '</label>').join('') + '</fieldset>' +
      '<fieldset><legend>Potentiel</legend>' + ['A', 'B', 'C'].map((p) =>
        '<label class="case"><input type="checkbox" data-action="filtre-potentiel" value="' + p + '"' + (f.potentiels.has(p) ? ' checked' : '') + '> ' + D.POTENTIEL_LABEL[p] + '</label>').join('') + '</fieldset>' +
      '<label class="case"><input type="checkbox" data-action="filtre-importants"' + (f.importants ? ' checked' : '') + '> Comptes importants uniquement</label>' +
      '<p class="compteur" id="compteur-carte"></p>' +
      '<p class="aide">Cercle plus grand cerclé de noir : compte important. Positions au centre de la commune.</p>' +
      '</aside><div id="carte-comptes" class="carte-map grande"></div></div>'
    );
  }
  function apresCarte() {
    const map = nouvelleCarte(document.getElementById('carte-comptes'));
    A.coucheComptes = L.layerGroup().addTo(map);
    dessinerComptes(true);
  }
  function dessinerComptes(cadrer) {
    const map = A.cartes[0];
    A.coucheComptes.clearLayers();
    const liste = comptesFiltres();
    const bornes = [];
    for (const i of liste) {
      const c = i.compte;
      L.circleMarker(ll(c), {
        radius: i.important ? 8 : 5.5,
        color: i.important ? '#0f172a' : '#ffffff',
        weight: i.important ? 2 : 1,
        fillColor: D.STATUT_COULEUR[i.statut],
        fillOpacity: 0.9,
      }).bindPopup(popupCompte(c, false)).addTo(A.coucheComptes);
      bornes.push(ll(c));
    }
    if (A.filtres.perimetre !== 'tous') {
      const com = commercial(A.filtres.perimetre);
      L.marker(ll(com.domicile), { icon: L.divIcon({ className: 'pin-domicile', html: '⌂', iconSize: [28, 28] }) }).bindTooltip('Domicile de ' + esc(com.prenom + ' ' + com.nom)).addTo(A.coucheComptes);
    }
    document.getElementById('compteur-carte').textContent = liste.length + ' compte' + (liste.length > 1 ? 's' : '') + ' affiché' + (liste.length > 1 ? 's' : '');
    if (cadrer) {
      if (bornes.length) map.fitBounds(bornes, { padding: [20, 20] });
      else map.setView([46.6, 2.4], 6);
    }
  }

  // ================================================================== ÉQUIPE (manager)
  function vueEquipe() {
    const depuis = U.isoDay(U.addDays(A.today, -28));
    const lignes = A.data.commerciaux.map((com) => {
      const tours = tourneesAVenir(com.id);
      const prevues = tours.reduce((s, x) => s + x.k.plan.nbVisites, 0);
      const realisees = A.data.visites.filter((v) => v.commercialId === com.id && v.debut >= depuis && v.debut.slice(0, 10) <= U.isoDay(A.today)).length;
      const chips = tours.map((x) => {
        const n = x.k.plan.jours.length;
        return '<span class="puce-tournee">' + esc(U.fmtDateCourte(x.t.date)) + (n > 1 ? ' · ' + n + ' j' : '') + ' · ' + U.nb(x.k.plan.nbVisites, 'visite') + ' · ' + U.fmtKm(x.k.plan.totalKm) + '</span>';
      }).join(' ');
      return (
        '<tr><td><b>' + esc(com.prenom + ' ' + com.nom) + '</b><div class="meta">' + esc(secteur(com.secteurId).nom) + '</div></td>' +
        '<td>' + (chips || '<span class="aide">Aucune</span>') + '</td>' +
        '<td class="nombre">' + prevues + '</td><td class="nombre">' + realisees + '</td></tr>'
      );
    });
    return (
      '<section class="panneau"><h2>Tournées prévues par commercial</h2>' +
      '<div class="tableau-defilant"><table class="equipe"><thead><tr><th>Commercial</th><th>Tournées prévues</th><th class="nombre">Visites prévues</th><th class="nombre">Visites réalisées (4 sem.)</th></tr></thead>' +
      '<tbody>' + lignes.join('') + '</tbody></table></div>' +
      '<p class="estimation">Kilomètres estimés (' + esc(R.getProvider().label) + ').</p></section>'
    );
  }

  // ================================================================== PARAMÈTRES
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
    ['Trajets', [
      ['margeTrajetPct', 'Marge sur les temps de trajet (%)', 'number', 1],
      ['coefRoutier', 'Coefficient routier (× vol d’oiseau)', 'number', 0.05],
      ['vitesseMoyenneKmh', 'Vitesse moyenne (km/h)', 'number', 1],
      ['seuilAllerMultiJoursMin', 'Proposer plusieurs jours au-delà de (min de route aller)', 'number', 5],
    ]],
    ['Suggestions et prospection', [
      ['rayonSuggestionKm', 'Rayon des suggestions autour du trajet (km)', 'number', 1],
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
            ? '<label class="case"><input type="checkbox" data-param="' + cle + '"' + (p[cle] ? ' checked' : '') + '> ' + lib + '</label>'
            : '<label class="param">' + lib + ' <input type="' + type + '" data-param="' + cle + '" value="' + esc(p[cle]) + '"' + (pas ? ' step="' + pas + '" min="0"' : '') + '></label>').join('') +
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
    const t = A.route === 'planifier' && A.tourneeId ? tournee(A.tourneeId) : null;
    const peutAjouter = t && t.commercialId === c.commercialId && !t.etapes.some((e) => e.compteId === c.id);
    let html =
      '<div class="modale-fond" data-action="fermer-fiche"></div><div class="modale" role="dialog" aria-modal="true" aria-label="Fiche compte">' +
      '<div class="titre-ligne"><h2>' + esc(c.raisonSociale) + '</h2><button class="fermer" data-action="fermer-fiche" aria-label="Fermer">✕</button></div>' +
      '<p>' + badgeStatut(info) + ' <span class="badge" style="--c:#475569">' + (c.nature === 'client' ? 'Client' : 'Prospect') + ' · ' + D.TYPE_LABEL[c.type] + '</span>' +
      ' <span class="badge" style="--c:#475569">Potentiel ' + D.POTENTIEL_LABEL[c.potentiel] + '</span></p>' +
      '<div class="fiche-grille"><div><h3>Contact</h3><p>' + esc(c.contact.prenom + ' ' + c.contact.nom) + ' · ' + esc(c.contact.fonction) + '<br>' +
      telLien(c.contact.telephone) + '<br><a href="mailto:' + esc(c.contact.email) + '">' + esc(c.contact.email) + '</a></p>' +
      '<p>' + esc(c.adresse) + '<br>' + esc(c.codePostal + ' ' + c.commune) + '</p>' +
      '<p class="meta">Suivi par ' + esc(com.prenom + ' ' + com.nom) + '</p></div>' +
      '<div><h3>Suivi</h3><p>Dernière visite : <b>' + U.fmtAnciennete(info.derniereVisite, A.today) + '</b>' + (info.derniereVisite ? ' (' + U.fmtDate(info.derniereVisite) + ')' : '') + '</p>' +
      '<p>Prochaine action : ' + (c.prochaineAction ? '<b>' + esc(c.prochaineAction.libelle) + '</b> · ' + U.fmtDate(c.prochaineAction.date) : '—') + '</p>';
    if (c.nature === 'client') {
      html +=
        '<p>CA 12 mois : <b>' + U.fmtEuro(info.ca12m) + '</b><br><span class="meta">6 derniers mois ' + U.fmtEuro(info.ca6m) + ' · 6 mois précédents ' + U.fmtEuro(info.caPrec6m) + '</span></p>' +
        '<label class="case"><input type="checkbox" data-action="fiche-important"' + (c.important ? ' checked' : '') + '> Marquer comme compte important</label>';
    } else {
      html +=
        '<label class="param">Étape <select data-action="fiche-etape">' + D.ETAPES.map((e) => '<option value="' + e + '"' + (c.etape === e ? ' selected' : '') + '>' + D.ETAPE_LABEL[e] + '</option>').join('') + '</select></label>' +
        '<p>Score : <b>' + (c.score || 0) + '/100</b></p>';
    }
    html += '</div></div>';
    if (peutAjouter) html += '<p><button class="primaire" data-action="ajouter" data-id="' + c.id + '">Ajouter à la tournée du ' + esc(U.fmtDateCourte(t.date)) + '</button></p>';
    html += '<h3>Devis</h3>' + (dv.length ? '<ul class="historique">' + dv.map((d) =>
      '<li><b>' + U.fmtDate(d.date) + '</b> · ' + esc(d.objet) + ' · ' + U.fmtEuro(d.montantHT) + ' HT · ' + D.STATUT_DEVIS_LABEL[d.statut] + '</li>').join('') + '</ul>' : '<p class="aide">Aucun devis.</p>');
    html += '<h3>Visites (' + vs.length + ')</h3>' + (vs.length ? '<ul class="historique">' + vs.slice(0, 12).map((v) =>
      '<li><b>' + U.fmtDate(v.debut) + '</b> · ' + D.RESULTAT_LABEL[v.resultat] + (v.note ? ' · ' + esc(v.note) : '') + (v.prochaineAction ? ' <span class="meta">→ ' + esc(v.prochaineAction) + '</span>' : '') + '</li>').join('') + '</ul>' : '<p class="aide">Aucune visite.</p>');
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
      ? [['equipe', 'Équipe'], ['carte', 'Carte'], ['parametres', 'Paramètres']]
      : [['planifier', 'Planifier'], ['tournee', 'Ma tournée'], ['carte', 'Carte'], ['parametres', 'Paramètres']];
  }
  function routeCourante() {
    const r = location.hash.replace(/^#\/?/, '');
    const ok = routes().map((x) => x[0]);
    return ok.includes(r) ? r : ok[0];
  }

  function enTete() {
    const opts = A.data.commerciaux.map((c) =>
      '<option value="c:' + c.id + '"' + (A.profil.kind === 'commercial' && A.profil.commercialId === c.id ? ' selected' : '') + '>' +
      esc(c.prenom + ' ' + c.nom + ' · ' + secteur(c.secteurId).nom) + '</option>').join('');
    document.getElementById('profil').innerHTML =
      '<optgroup label="Commerciaux">' + opts + '</optgroup><option value="manager"' + (A.profil.kind === 'manager' ? ' selected' : '') + '>Direction commerciale (manager)</option>';
    document.getElementById('nav').innerHTML = routes()
      .map((r) => '<a href="#/' + r[0] + '"' + (r[0] === A.route ? ' class="actif" aria-current="page"' : '') + '>' + r[1] + '</a>')
      .join('');
  }

  function render() {
    A.route = routeCourante();
    detruireCartes();
    enTete();
    const main = document.getElementById('vue');
    const scroll = window.scrollY;
    const vues = { planifier: vuePlanifier, tournee: vueMaTournee, carte: vueCarte, equipe: vueEquipe, parametres: vueParametres };
    main.innerHTML = vues[A.route]();
    if (A.route === 'planifier') apresPlanifier();
    if (A.route === 'carte') apresCarte();
    document.getElementById('fiche').innerHTML = A.ficheId ? ficheHtml() : '';
    window.scrollTo(0, scroll);
  }

  // ------------------------------------------------------------------ événements
  function surClic(ev) {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    const t = A.tourneeId ? tournee(A.tourneeId) : null;
    const i = el.dataset.i != null ? Number(el.dataset.i) : null;
    switch (a) {
      case 'choisir-tournee':
        A.tourneeId = el.dataset.id;
        A.recherche = '';
        render();
        break;
      case 'nouvelle-tournee': {
        const date = U.isoDay(U.prochainJourTournee(A.today, false));
        const nt = { id: U.uid('t'), commercialId: A.profil.commercialId, date, multiJours: false, decoupageRefuse: false, prospection: [], etapes: [], creeLe: U.isoDateTime(new Date()), modifieeLe: U.isoDateTime(new Date()) };
        A.data.tournees.push(nt);
        A.tourneeId = nt.id;
        TC.dataService.saveTournee(nt);
        render();
        toast('Nouvelle tournée le ' + U.fmtDateCourte(date));
        break;
      }
      case 'supprimer-tournee':
        if (t && confirm('Supprimer cette tournée ?')) {
          TC.dataService.deleteTournee(t.id);
          A.data.tournees = A.data.tournees.filter((x) => x.id !== t.id);
          A.tourneeId = null;
          render();
        }
        break;
      case 'optimiser':
        if (t) {
          const k = calc(t);
          const ordre = R.optimizeOrder(k.m.km);
          majTournee(t, (x) => {
            x.etapes = ordre.map((n) => x.etapes[n - 1]);
          });
          toast('Ordre optimisé');
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
        break;
      case 'ajouter': {
        const cible = A.route === 'planifier' ? t : null;
        if (!cible) break;
        ajouterEtape(cible, el.dataset.id, el.dataset.jour != null ? Number(el.dataset.jour) : null);
        break;
      }
      case 'accepter-decoupage':
        majTournee(t, (x) => {
          x.multiJours = true;
          x.decoupageRefuse = false;
        });
        break;
      case 'refuser-decoupage':
        majTournee(t, (x) => {
          x.decoupageRefuse = true;
        });
        break;
      case 'revoir-decoupage':
        majTournee(t, (x) => {
          x.decoupageRefuse = false;
        });
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
        if (confirm('Effacer toutes les modifications et régénérer les données de démonstration ?')) {
          A.data = TC.dataService.reset();
          indexer();
          A.tourneeId = A.maTourneeId = A.ficheId = null;
          A.filtres = null;
          render();
          toast('Données réinitialisées');
        }
        break;
      default:
        return;
    }
  }

  function surChangement(ev) {
    const el = ev.target;
    if (el.id === 'profil') {
      A.profil = el.value === 'manager' ? { kind: 'manager' } : { kind: 'commercial', commercialId: el.value.slice(2) };
      ecrireProfil();
      A.tourneeId = A.maTourneeId = A.ficheId = null;
      A.filtres = null;
      A.crOuvert = null;
      location.hash = '#/' + routes()[0][0];
      render();
      return;
    }
    if (el.dataset.param) {
      changerParametre(el);
      return;
    }
    const a = el.dataset.action;
    const t = A.tourneeId ? tournee(A.tourneeId) : null;
    switch (a) {
      case 'date-tournee':
        if (el.value) majTournee(t, (x) => (x.date = el.value));
        break;
      case 'duree': {
        const n = parseInt(el.value, 10);
        if (n >= 5) majTournee(t, (x) => (x.etapes[Number(el.dataset.i)].dureeMin = n));
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
      case 'filtre-perimetre':
        A.filtres.perimetre = el.value;
        dessinerComptes(true);
        break;
      case 'filtre-statut':
        el.checked ? A.filtres.statuts.add(el.value) : A.filtres.statuts.delete(el.value);
        dessinerComptes(false);
        break;
      case 'filtre-potentiel':
        el.checked ? A.filtres.potentiels.add(el.value) : A.filtres.potentiels.delete(el.value);
        dessinerComptes(false);
        break;
      case 'filtre-importants':
        A.filtres.importants = el.checked;
        dessinerComptes(false);
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

  function surSaisie(ev) {
    const el = ev.target;
    if (el.dataset.action === 'recherche') {
      A.recherche = el.value;
      const t = tournee(A.tourneeId);
      if (t) document.getElementById('resultats-recherche').innerHTML = resultatsRecherche(t);
    }
  }

  // glisser-déposer des étapes (ordinateur ; boutons ↑ ↓ sur mobile)
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
    deplacer(tournee(A.tourneeId), de, Number(li.dataset.i));
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
    document.addEventListener('input', surSaisie);
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
