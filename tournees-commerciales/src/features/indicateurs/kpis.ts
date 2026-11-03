/**
 * Calcul des indicateurs d'activité. Fonctions pures, réutilisées par la vue manager.
 * Les kilomètres des journées passées sont estimés (domicile → visites dans l'ordre horaire → domicile).
 */
import { addDays, format, startOfWeek, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Derived } from '../../domain/derive';
import type { Commercial, Compte } from '../../domain/types';
import { isoDay, joursDepuis } from '../../lib/format';
import { estimateCircuitKm } from '../../routing';
import type { DataSnapshot } from '../../services';

export interface SemaineKpi {
  debut: string; // lundi ISO
  label: string; // "3 nov."
  visitesClients: number;
  visitesProspects: number;
  km: number;
}

export interface Kpis {
  semaines: SemaineKpi[];
  nbSemaines: number;
  visites: number;
  visitesParSemaine: number;
  km: number;
  kmParSemaine: number;
  joursTerrain: number;
  minutesClients: number;
  minutesProspects: number;
  partClient: number; // 0..1
  prospectsGagnes: number;
  prospectsPerdus: number;
  tauxConversion: number | null; // null si aucun prospect clôturé
  clients: number;
  clientsCouverts: number;
  couverture: number; // 0..1
}

export function calculerKpis(
  data: DataSnapshot,
  derived: Derived,
  commerciaux: Commercial[],
  nbSemaines: number,
): Kpis {
  const today = derived.today;
  const ids = new Set(commerciaux.map((c) => c.id));
  const homeById = new Map(commerciaux.map((c) => [c.id, c.domicile]));
  const comptes = new Map<string, Compte>(data.comptes.map((c) => [c.id, c]));

  const lundiCourant = startOfWeek(today, { weekStartsOn: 1 });
  const debut = subDays(lundiCourant, (nbSemaines - 1) * 7);
  const debutIso = isoDay(debut);
  const finIso = isoDay(addDays(today, 1));

  const semaines: SemaineKpi[] = Array.from({ length: nbSemaines }, (_, i) => {
    const d = addDays(debut, i * 7);
    return { debut: isoDay(d), label: format(d, 'd MMM', { locale: fr }), visitesClients: 0, visitesProspects: 0, km: 0 };
  });
  const idxSemaine = (iso: string) => Math.floor((new Date(iso).getTime() - debut.getTime()) / (7 * 86400000));

  const visites = data.visites.filter((v) => ids.has(v.commercialId) && v.debut >= debutIso && v.debut < finIso);

  let minutesClients = 0;
  let minutesProspects = 0;
  const journees = new Map<string, typeof visites>();
  for (const v of visites) {
    const c = comptes.get(v.compteId);
    if (!c) continue;
    const w = semaines[idxSemaine(v.debut.slice(0, 10))];
    if (c.nature === 'client') {
      minutesClients += v.dureeMin;
      if (w) w.visitesClients += 1;
    } else {
      minutesProspects += v.dureeMin;
      if (w) w.visitesProspects += 1;
    }
    const key = `${v.commercialId}|${v.debut.slice(0, 10)}`;
    const j = journees.get(key);
    if (j) j.push(v);
    else journees.set(key, [v]);
  }

  let km = 0;
  for (const [key, vs] of journees) {
    const [cid, day] = key.split('|');
    const home = homeById.get(cid)!;
    const pts = [home, ...vs.sort((a, b) => a.debut.localeCompare(b.debut)).map((v) => comptes.get(v.compteId)!), home];
    const k = estimateCircuitKm(pts);
    km += k;
    const w = semaines[idxSemaine(day)];
    if (w) w.km += k;
  }

  const prospects = data.comptes.filter(
    (c) => c.nature === 'prospect' && ids.has(c.commercialId) && (c.etapeModifieeLe ?? '') >= debutIso,
  );
  const gagnes = prospects.filter((c) => c.etape === 'gagne').length;
  const perdus = prospects.filter((c) => c.etape === 'perdu').length;

  const clients = [...derived.infos.values()].filter((i) => i.compte.nature === 'client' && ids.has(i.compte.commercialId));
  const couverts = clients.filter((i) => joursDepuis(i.derniereVisite, today) <= data.parametres.couvertureJours).length;

  const totalMin = minutesClients + minutesProspects;
  return {
    semaines,
    nbSemaines,
    visites: visites.length,
    visitesParSemaine: visites.length / nbSemaines,
    km,
    kmParSemaine: km / nbSemaines,
    joursTerrain: journees.size,
    minutesClients,
    minutesProspects,
    partClient: totalMin ? minutesClients / totalMin : 0,
    prospectsGagnes: gagnes,
    prospectsPerdus: perdus,
    tauxConversion: gagnes + perdus > 0 ? gagnes / (gagnes + perdus) : null,
    clients: clients.length,
    clientsCouverts: couverts,
    couverture: clients.length ? couverts / clients.length : 0,
  };
}
