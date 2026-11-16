/*
 * Couche unique d'accès aux données (DataService).
 *
 * Point de branchement : pour utiliser Dynamics, écrire un objet qui respecte le même contrat
 * (load, saveCompte, saveVisite, saveTournee, deleteTournee, saveParametres, reset)
 * et le déclarer en bas de ce fichier à la place de localStorageDataService.
 *
 * Implémentation actuelle : les données de démonstration sont régénérées à chaque chargement
 * à partir d'une graine fixe (déterministe), et seules les modifications de l'utilisateur
 * sont stockées dans le localStorage du navigateur. Fonctionne sans réseau (zones blanches).
 */
window.TC = window.TC || {};
(function (TC) {
  'use strict';
  const U = TC.util;
  const CLE = 'tournees-commerciales.v2';

  function lire() {
    try {
      const brut = localStorage.getItem(CLE);
      if (brut) return JSON.parse(brut);
    } catch (e) {
      /* stockage indisponible ou illisible : on repart des données de démonstration */
    }
    return null;
  }
  function ecrire(store) {
    try {
      localStorage.setItem(CLE, JSON.stringify(store));
      return true;
    } catch (e) {
      return false;
    }
  }
  function storeVide() {
    return { dateDonnees: U.isoDay(new Date()), parametres: null, comptes: {}, visites: {}, tournees: {}, tourneesSupprimees: [] };
  }

  let store = null;

  const localStorageDataService = {
    /** Charge l'instantané complet : données de démonstration + modifications enregistrées. */
    load() {
      store = lire() || storeVide();
      const parametres = Object.assign({}, TC.domain.PARAMETRES_DEFAUT, store.parametres || {});
      const data = TC.seed.generer(U.parseDay(store.dateDonnees), parametres);
      data.comptes = data.comptes.map((c) => store.comptes[c.id] || c);
      const visitesAjoutees = Object.values(store.visites);
      const idsModifiees = new Set(visitesAjoutees.map((v) => v.id));
      data.visites = data.visites.filter((v) => !idsModifiees.has(v.id)).concat(visitesAjoutees);
      const supprimees = new Set(store.tourneesSupprimees);
      const parId = new Map(data.tournees.map((t) => [t.id, t]));
      for (const t of Object.values(store.tournees)) parId.set(t.id, t);
      data.tournees = [...parId.values()].filter((t) => !supprimees.has(t.id));
      data.dateDonnees = store.dateDonnees;
      ecrire(store);
      return data;
    },
    saveCompte(c) {
      store.comptes[c.id] = c;
      return ecrire(store);
    },
    saveVisite(v) {
      store.visites[v.id] = v;
      return ecrire(store);
    },
    saveTournee(t) {
      store.tournees[t.id] = t;
      store.tourneesSupprimees = store.tourneesSupprimees.filter((id) => id !== t.id);
      return ecrire(store);
    },
    deleteTournee(id) {
      delete store.tournees[id];
      store.tourneesSupprimees.push(id);
      return ecrire(store);
    },
    saveParametres(p) {
      store.parametres = p;
      return ecrire(store);
    },
    /** Efface les modifications et régénère les données de démonstration à la date du jour. */
    reset() {
      store = storeVide();
      ecrire(store);
      return this.load();
    },
  };

  /** Implémentation active. Remplacer ici par un service Dynamics le moment venu. */
  TC.dataService = localStorageDataService;
})(window.TC);
