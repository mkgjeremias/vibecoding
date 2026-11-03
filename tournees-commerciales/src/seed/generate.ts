/**
 * Génération déterministe des données fictives.
 * - 4 commerciaux, 4 secteurs, ~250 clients et ~150 prospects dans de vraies communes
 *   (coordonnées du centre de la commune, source geo.api.gouv.fr, légèrement décalées).
 * - 12 mois d'historique simulés journée par journée : tournées réalistes (points proches),
 *   visites, devis, commandes, échanges.
 * Tous les noms d'entreprises et de contacts sont inventés. Les montants sont fictifs.
 */
import { addDays, getDay, subDays, getMonth, getDate } from 'date-fns';
import type {
  Commande,
  Commercial,
  Compte,
  Devis,
  Echange,
  EtapePipeline,
  Parametres,
  Potentiel,
  ResultatVisite,
  Secteur,
  Tournee,
  TypeCompte,
  Visite,
} from '../domain/types';
import { isoDateTime, isoDay } from '../lib/format';
import { createRng, type Rng } from '../lib/random';
import { haversineKm } from '../routing/geo';
import { haversineMatrix } from '../routing/haversineProvider';
import { optimizeOrder } from '../routing/optimizer';
import type { DataSnapshot } from '../services/DataService';
import communesData from './communes.json';
import {
  FONCTIONS,
  FORMES_SOCIETE,
  MOTIFS_PERTE,
  NOMS_FICTIFS,
  NOTES_VISITE,
  OBJETS_DEVIS,
  PRENOMS,
  PROCHAINES_ACTIONS,
  RUES,
} from './names';

interface CommuneRef {
  code: string;
  nom: string;
  dep: string;
  lat: number;
  lng: number;
  pop: number;
  secteur: string;
  cp: string;
}
const COMMUNES = communesData as CommuneRef[];

export const SEED = 20261103;

const SECTEURS: Secteur[] = [
  { id: 'ouest', nom: 'Ouest', departements: ['35', '44', '56', '22', '53'], couleur: '#0f766e' },
  { id: 'nord', nom: 'Nord', departements: ['59', '62', '80', '02'], couleur: '#7c3aed' },
  { id: 'rhone', nom: 'Rhône-Alpes', departements: ['69', '01', '38', '42'], couleur: '#b45309' },
  { id: 'aquitaine', nom: 'Sud-Ouest', departements: ['33', '24', '47', '40'], couleur: '#be185d' },
];

const COMMERCIAUX_DEF = [
  { id: 'c1', prenom: 'Julien', nom: 'Testard', secteurId: 'ouest', commune: 'Cesson-Sévigné', couleur: '#0f766e' },
  { id: 'c2', prenom: 'Sandrine', nom: 'Exemplier', secteurId: 'nord', commune: 'Arras', couleur: '#7c3aed' },
  { id: 'c3', prenom: 'Karim', nom: 'Maquetton', secteurId: 'rhone', commune: 'Saint-Priest', couleur: '#b45309' },
  { id: 'c4', prenom: 'Élodie', nom: 'Fictelle', secteurId: 'aquitaine', commune: 'Libourne', couleur: '#be185d' },
];

const NB_CLIENTS = [63, 63, 62, 62];
const NB_PROSPECTS = [38, 38, 37, 37];

/** Intervalle cible entre deux visites (jours) selon le potentiel. */
const INTERVALLE: Record<Potentiel, number> = { A: 35, B: 60, C: 110 };

interface SimState {
  compte: Compte;
  derniereVisite?: Date;
  nbVisites: number;
  /** Client délaissé : plus visité après cette date (crée des clients à risque). */
  delaisseApres?: Date;
  /** Client en baisse : commandes réduites sur les 6 derniers mois. */
  enBaisse: boolean;
  /** Prospect : fenêtre de visite. */
  visitesDes?: Date;
  visitesMax: number;
}

function pickType(r: Rng, prospect: boolean): TypeCompte {
  return r.weighted<TypeCompte>(
    ['installateur', 'fumiste', 'bureau_etudes', 'distributeur'],
    (t) =>
      prospect
        ? { installateur: 50, fumiste: 25, bureau_etudes: 15, distributeur: 10 }[t]
        : { installateur: 45, fumiste: 25, bureau_etudes: 12, distributeur: 18 }[t],
  );
}

function telephone(r: Rng, dep: string): string {
  // Indicatif régional réel, numéro fictif (aléatoire, non vérifié).
  const pfx = ['59', '62', '80', '02'].includes(dep)
    ? '03'
    : ['69', '01', '38', '42'].includes(dep)
      ? '04'
      : ['33', '24', '47', '40'].includes(dep)
        ? '05'
        : '02';
  return `${pfx} ${r.int(10, 99)} ${r.int(10, 99)} ${r.int(10, 99)} ${r.int(10, 99)}`;
}

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function at(day: Date, minutes: number): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(Math.round(minutes));
  return d;
}

function isWorkingDay(d: Date): boolean {
  const wd = getDay(d);
  if (wd === 0 || wd === 6) return false;
  const m = getMonth(d);
  const day = getDate(d);
  // congés : 3 semaines en août, fin décembre
  if (m === 7 && day >= 4 && day <= 24) return false;
  if (m === 11 && day >= 24) return false;
  if (m === 0 && day === 1) return false;
  return true;
}

export function generateSeed(today: Date, parametres: Parametres): DataSnapshot {
  const r = createRng(SEED);
  const t0 = new Date(today);
  t0.setHours(0, 0, 0, 0);
  const debut = subDays(t0, 365);
  const opts = { coefRoutier: parametres.coefRoutier, vitesseMoyenneKmh: parametres.vitesseMoyenneKmh };

  // --- Commerciaux
  const commerciaux: Commercial[] = COMMERCIAUX_DEF.map((c) => {
    const commune = COMMUNES.find((x) => x.nom === c.commune && x.secteur === c.secteurId)!;
    return {
      id: c.id,
      prenom: c.prenom,
      nom: c.nom,
      secteurId: c.secteurId,
      couleur: c.couleur,
      domicile: {
        adresse: `${r.int(1, 40)} ${r.pick(RUES)}`,
        commune: commune.nom,
        lat: commune.lat,
        lng: commune.lng,
      },
    };
  });

  // --- Comptes
  const usedNames = new Set<string>();
  const comptes: Compte[] = [];
  const states = new Map<string, SimState>();
  let seq = 0;

  commerciaux.forEach((com, ci) => {
    const pool = COMMUNES.filter((c) => c.secteur === com.secteurId).map((c) => ({
      c,
      d: haversineKm(com.domicile, c),
    }));
    const weight = (x: { c: CommuneRef; d: number }) =>
      Math.sqrt(x.c.pop) * (x.d < 60 ? 1 : x.d < 110 ? 0.55 : 0.15);

    const make = (nature: 'client' | 'prospect') => {
      const { c } = r.weighted(pool, weight);
      const type = pickType(r, nature === 'prospect');
      let raison = '';
      for (let k = 0; k < 20; k++) {
        raison = r.pick(FORMES_SOCIETE[type]).replace('{n}', r.pick(NOMS_FICTIFS));
        if (!usedNames.has(raison)) break;
        raison = `${raison} ${c.nom}`;
        if (!usedNames.has(raison)) break;
      }
      usedNames.add(raison);
      const prenom = r.pick(PRENOMS);
      const nomC = r.pick(NOMS_FICTIFS);
      const potentiel = r.weighted<Potentiel>(['A', 'B', 'C'], (p) => ({ A: 20, B: 45, C: 35 })[p]);
      seq += 1;
      const jitter = c.pop > 50000 ? 0.025 : c.pop > 10000 ? 0.012 : 0.006;
      const compte: Compte = {
        id: `${nature === 'client' ? 'cl' : 'pr'}${String(seq).padStart(4, '0')}`,
        nature,
        raisonSociale: raison,
        type,
        adresse: `${r.int(1, 120)} ${r.pick(RUES)}`,
        codePostal: c.cp,
        commune: c.nom,
        departement: c.dep,
        lat: +(c.lat + r.float(-jitter, jitter)).toFixed(5),
        lng: +(c.lng + r.float(-jitter, jitter) * 1.4).toFixed(5),
        contact: {
          prenom,
          nom: nomC,
          fonction: r.pick(FONCTIONS[type]),
          telephone: telephone(r, c.dep),
          email: `${slug(prenom)}.${slug(nomC)}@exemple-fictif.fr`,
        },
        commercialId: com.id,
        secteurId: com.secteurId,
        potentiel,
        important: false,
        creeLe: isoDay(nature === 'client' ? subDays(t0, r.int(400, 3000)) : subDays(t0, r.int(20, 330))),
      };
      if (nature === 'client') {
        compte.important = potentiel === 'A' && r.chance(0.5);
      }
      comptes.push(compte);
      const st: SimState = { compte, nbVisites: 0, enBaisse: false, visitesMax: 999 };
      if (nature === 'client') {
        if (r.chance(0.1)) st.delaisseApres = subDays(t0, r.int(125, 260));
        if (r.chance(0.08)) st.enBaisse = true;
      }
      states.set(compte.id, st);
    };

    for (let i = 0; i < NB_CLIENTS[ci]; i++) make('client');
    for (let i = 0; i < NB_PROSPECTS[ci]; i++) make('prospect');
  });

  // --- Prospects : étape du pipeline et fenêtre de visite
  const etapeTirage: [EtapePipeline, number][] = [
    ['identifie', 24],
    ['contacte', 24],
    ['rdv_obtenu', 20],
    ['devis_envoye', 15],
    ['gagne', 9],
    ['perdu', 8],
  ];
  for (const st of states.values()) {
    const c = st.compte;
    if (c.nature !== 'prospect') continue;
    const etape = r.weighted(etapeTirage, (e) => e[1])[0];
    c.etape = etape;
    const base = { A: 70, B: 50, C: 30 }[c.potentiel];
    c.score = Math.max(5, Math.min(98, Math.round(base + r.float(-20, 25) + (etape === 'devis_envoye' ? 10 : 0))));
    if (etape === 'identifie') c.creeLe = isoDay(subDays(t0, r.int(3, 75)));
    const cree = new Date(c.creeLe);
    if (['rdv_obtenu', 'devis_envoye', 'gagne', 'perdu'].includes(etape)) {
      st.visitesDes = addDays(cree, r.int(10, 40));
      st.visitesMax = etape === 'rdv_obtenu' ? 1 : r.int(1, 3);
    } else {
      st.visitesMax = 0;
    }
  }

  // --- Simulation jour par jour
  const visites: Visite[] = [];
  const devis: Devis[] = [];
  const commandes: Commande[] = [];
  const echanges: Echange[] = [];
  let vseq = 0;
  let dseq = 0;
  let oseq = 0;
  let eseq = 0;

  const eligible = (st: SimState, day: Date) => {
    const c = st.compte;
    if (new Date(c.creeLe) > day) return false;
    if (c.nature === 'client') return !(st.delaisseApres && day > st.delaisseApres);
    return !!st.visitesDes && day >= st.visitesDes && st.nbVisites < st.visitesMax;
  };
  const urgence = (st: SimState, day: Date) => {
    if (st.compte.nature === 'prospect') return 2.5;
    const last = st.derniereVisite ?? subDays(debut, r.int(0, 60));
    const jours = (day.getTime() - last.getTime()) / 86400000;
    return jours / INTERVALLE[st.compte.potentiel];
  };

  for (const com of commerciaux) {
    const mine = [...states.values()].filter((s) => s.compte.commercialId === com.id);
    for (let day = new Date(debut); day < t0; day = addDays(day, 1)) {
      if (!isWorkingDay(day)) continue;
      if (!r.chance(0.62)) continue; // jours terrain (~3 par semaine)
      const cands = mine
        .filter((s) => eligible(s, day))
        .map((s) => ({ s, u: urgence(s, day) }))
        .filter((x) => x.u >= 0.6)
        .sort((a, b) => b.u - a.u);
      if (cands.length === 0) continue;
      const anchor = r.pick(cands.slice(0, 8)).s;
      const n = r.int(3, 6);
      const near = cands
        .filter((x) => x.s !== anchor && haversineKm(x.s.compte, anchor.compte) < 35)
        .slice(0, n - 1)
        .map((x) => x.s);
      const groupe = [anchor, ...near];
      // ordre de passage réaliste
      const m = haversineMatrix([com.domicile, ...groupe.map((g) => g.compte)], opts);
      const order = optimizeOrder(m.km);
      let clock = 8 * 60 + r.int(0, 30);
      let prev = 0;
      let pause = false;
      for (const idx of order) {
        const st = groupe[idx - 1];
        clock += m.minutes[prev][idx];
        if (!pause && clock >= 12 * 60) {
          clock += 60;
          pause = true;
        }
        if (clock > 17 * 60 + 30) break;
        const duree = r.pick([45, 60, 60, 60, 75, 90]);
        const c = st.compte;
        const resultat: ResultatVisite = r.weighted<ResultatVisite>(
          ['positif', 'neutre', 'devis_demande', 'commande', 'negatif', 'absent'],
          (x) =>
            c.nature === 'client'
              ? { positif: 34, neutre: 30, devis_demande: 15, commande: 12, negatif: 4, absent: 5 }[x]
              : { positif: 35, neutre: 25, devis_demande: 25, commande: 0, negatif: 10, absent: 5 }[x],
        );
        const debutRdv = at(day, clock);
        vseq += 1;
        const v: Visite = {
          id: `v${String(vseq).padStart(5, '0')}`,
          compteId: c.id,
          commercialId: com.id,
          debut: isoDateTime(debutRdv),
          dureeMin: duree,
          resultat,
          note: r.chance(0.7) ? r.pick(NOTES_VISITE) : undefined,
        };
        if (resultat !== 'absent' && r.chance(0.6)) {
          v.prochaineAction = r.pick(PROCHAINES_ACTIONS);
          v.dateRelance = isoDay(addDays(day, r.int(7, 45)));
        }
        visites.push(v);
        st.derniereVisite = new Date(day);
        st.nbVisites += 1;
        clock += duree;
        prev = idx;

        if (resultat === 'devis_demande' && c.nature === 'client') {
          dseq += 1;
          const dDate = addDays(day, r.int(2, 7));
          if (dDate < t0) {
            const age = (t0.getTime() - dDate.getTime()) / 86400000;
            const statut = age > 45 ? (r.chance(0.55) ? 'accepte' : 'refuse') : 'en_cours';
            const montant = montantDevis(r, c.type);
            const dv: Devis = {
              id: `d${String(dseq).padStart(5, '0')}`,
              compteId: c.id,
              commercialId: com.id,
              date: isoDay(dDate),
              montantHT: montant,
              statut,
              objet: r.pick(OBJETS_DEVIS),
            };
            devis.push(dv);
            if (statut === 'accepte') {
              oseq += 1;
              commandes.push({
                id: `o${String(oseq).padStart(5, '0')}`,
                compteId: c.id,
                date: isoDay(addDays(dDate, r.int(5, 20))),
                montantHT: montant,
                devisId: dv.id,
              });
            }
          }
        }
      }
    }
  }

  // --- Commandes récurrentes des clients
  for (const st of states.values()) {
    const c = st.compte;
    if (c.nature !== 'client') continue;
    // Cadence régulière (tous les N mois) pour que les variations de CA soient voulues, pas du bruit.
    const cadence = c.type === 'bureau_etudes' ? 3 : { A: 1, B: 1, C: 2 }[c.potentiel];
    const offset = r.int(0, cadence - 1);
    for (let mo = 12; mo >= 1; mo--) {
      const recent = mo <= 6;
      if ((mo + offset) % cadence !== 0) continue;
      if (st.enBaisse && recent && !r.chance(0.3)) continue;
      if (st.delaisseApres && recent && !r.chance(0.5)) continue;
      const nb = c.type === 'distributeur' ? r.int(1, 3) : 1;
      for (let k = 0; k < nb; k++) {
        const date = subDays(t0, mo * 30 - r.int(0, 28));
        if (date >= t0) continue;
        oseq += 1;
        commandes.push({
          id: `o${String(oseq).padStart(5, '0')}`,
          compteId: c.id,
          date: isoDay(date),
          montantHT: montantCommande(r, c.type, c.potentiel),
        });
      }
    }
    // devis en cours récents pour alimenter les suggestions
    if (r.chance(0.12)) {
      dseq += 1;
      devis.push({
        id: `d${String(dseq).padStart(5, '0')}`,
        compteId: c.id,
        commercialId: c.commercialId,
        date: isoDay(subDays(t0, r.int(3, 40))),
        montantHT: montantDevis(r, c.type),
        statut: 'en_cours',
        objet: r.pick(OBJETS_DEVIS),
      });
    }
  }

  // --- Prospects : échanges, devis, prochaine action
  for (const st of states.values()) {
    const c = st.compte;
    if (c.nature !== 'prospect' || !c.etape) continue;
    const cree = new Date(c.creeLe);
    const lastVisit = st.derniereVisite;
    const addEchange = (date: Date, canal: Echange['canal'], resume: string) => {
      if (date >= t0) date = subDays(t0, 1);
      eseq += 1;
      echanges.push({
        id: `e${String(eseq).padStart(5, '0')}`,
        compteId: c.id,
        commercialId: c.commercialId,
        date: isoDay(date),
        canal,
        resume,
      });
      return date;
    };
    let derniere = cree;
    if (c.etape !== 'identifie') {
      derniere = addEchange(addDays(cree, r.int(2, 10)), r.pick(['appel', 'email', 'salon'] as const), 'Premier contact, présentation de l’entreprise et de la gamme.');
      if (r.chance(0.5)) derniere = addEchange(addDays(derniere, r.int(5, 20)), 'email', 'Envoi de la documentation et des références chantiers.');
    }
    if (lastVisit && lastVisit > derniere) derniere = lastVisit;
    const actif = c.etape !== 'gagne' && c.etape !== 'perdu';
    // ~25 % des prospects actifs sont laissés sans action récente (alimente les alertes)
    const delaisse = actif && r.chance(0.25);
    if (actif && !delaisse && c.etape !== 'identifie') {
      const d = subDays(t0, r.int(1, 25));
      if (d > derniere) {
        derniere = addEchange(d, r.pick(['appel', 'email'] as const), r.pick([
          'Relance téléphonique, projet toujours d’actualité.',
          'Échange sur le calendrier du chantier.',
          'Questions techniques sur le dimensionnement, réponse envoyée.',
          'Point sur la proposition, en attente de décision.',
        ]));
      }
    }
    if (delaisse && c.etape !== 'identifie') {
      // dernière activité repoussée à plus de 30 jours
      const vieux = subDays(t0, r.int(35, 120));
      if (derniere > vieux) derniere = vieux;
    }
    if (c.etape === 'devis_envoye' || c.etape === 'gagne' || c.etape === 'perdu') {
      dseq += 1;
      const dDate = addDays(derniere, r.int(2, 10));
      const dateDevis = dDate < t0 ? dDate : subDays(t0, r.int(1, 10));
      const montant = montantDevis(r, c.type);
      const statut = c.etape === 'gagne' ? 'accepte' : c.etape === 'perdu' ? 'refuse' : 'en_cours';
      const dv: Devis = {
        id: `d${String(dseq).padStart(5, '0')}`,
        compteId: c.id,
        commercialId: c.commercialId,
        date: isoDay(dateDevis),
        montantHT: montant,
        statut,
        objet: r.pick(OBJETS_DEVIS),
      };
      devis.push(dv);
      derniere = dateDevis;
      if (c.etape === 'gagne') {
        oseq += 1;
        const od = addDays(dateDevis, r.int(5, 15));
        commandes.push({ id: `o${String(oseq).padStart(5, '0')}`, compteId: c.id, date: isoDay(od < t0 ? od : subDays(t0, 1)), montantHT: montant, devisId: dv.id });
      }
      if (c.etape === 'perdu') c.motifPerte = r.pick(MOTIFS_PERTE);
    }
    c.etapeModifieeLe = isoDay(derniere);
    if (c.etape !== 'gagne' && c.etape !== 'perdu') {
      const delai = delaisse ? r.int(-40, -10) : r.int(-3, 21);
      c.prochaineAction = {
        libelle:
          c.etape === 'identifie'
            ? 'Premier appel de qualification'
            : c.etape === 'contacte'
              ? 'Obtenir un rendez-vous'
              : c.etape === 'rdv_obtenu'
                ? 'Envoyer une proposition'
                : 'Relancer le devis',
        date: isoDay(addDays(t0, delai)),
      };
    }
  }

  // --- Prochaine action des clients : issue de la dernière visite
  const lastByCompte = new Map<string, Visite>();
  for (const v of visites) {
    const prev = lastByCompte.get(v.compteId);
    if (!prev || v.debut > prev.debut) lastByCompte.set(v.compteId, v);
  }
  for (const c of comptes) {
    if (c.nature !== 'client') continue;
    const v = lastByCompte.get(c.id);
    if (v?.prochaineAction && v.dateRelance) c.prochaineAction = { libelle: v.prochaineAction, date: v.dateRelance };
  }

  // --- Tournée du jour pour chaque commercial (démo)
  const tournees: Tournee[] = commerciaux.map((com) => {
    const mine = [...states.values()].filter((s) => s.compte.commercialId === com.id && s.compte.nature === 'client' && !s.delaisseApres);
    const ranked = mine.map((s) => ({ s, u: urgence(s, t0) })).sort((a, b) => b.u - a.u);
    const anchor = ranked[0].s;
    const group = [
      anchor,
      ...ranked.filter((x) => x.s !== anchor && haversineKm(x.s.compte, anchor.compte) < 30).slice(0, 4).map((x) => x.s),
    ];
    const m = haversineMatrix([com.domicile, ...group.map((g) => g.compte)], opts);
    const order = optimizeOrder(m.km);
    const now = isoDateTime(new Date());
    return {
      id: `t_${com.id}_${isoDay(t0)}`,
      commercialId: com.id,
      date: isoDay(t0),
      heureDepart: parametres.heureDepart,
      dureeRdvMin: parametres.dureeRdvMin,
      etapes: order.map((i) => ({ compteId: group[i - 1].compte.id })),
      creeLe: now,
      modifieeLe: now,
    };
  });

  return {
    secteurs: SECTEURS,
    commerciaux,
    comptes,
    visites: visites.sort((a, b) => a.debut.localeCompare(b.debut)),
    echanges,
    devis,
    commandes: commandes.sort((a, b) => a.date.localeCompare(b.date)),
    tournees,
    parametres,
    genereLe: isoDateTime(new Date()),
  };
}

function arrondi(n: number, pas = 10) {
  return Math.round(n / pas) * pas;
}

function montantDevis(r: Rng, type: TypeCompte): number {
  const [min, max] = {
    installateur: [800, 9000],
    fumiste: [600, 6000],
    bureau_etudes: [5000, 40000],
    distributeur: [3000, 25000],
  }[type];
  return arrondi(r.float(min, max), 50);
}

function montantCommande(r: Rng, type: TypeCompte, p: Potentiel): number {
  const f = { A: 1.6, B: 1, C: 0.6 }[p];
  const moyenne = { installateur: 1600, fumiste: 1200, bureau_etudes: 2500, distributeur: 6000 }[type];
  return arrondi(moyenne * f * r.float(0.6, 1.4), 10);
}
