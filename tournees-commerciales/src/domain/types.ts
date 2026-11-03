// Modèle de données de l'application.
// Les identifiants sont des chaînes pour faciliter un futur mapping vers un CRM.

export type ISODate = string; // "2026-11-03"
export type ISODateTime = string; // "2026-11-03T09:30:00"

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Secteur {
  id: string;
  nom: string;
  departements: string[];
  couleur: string;
}

export interface Commercial {
  id: string;
  prenom: string;
  nom: string;
  secteurId: string;
  domicile: { adresse: string; commune: string } & LatLng;
  couleur: string;
}

export type TypeCompte = 'installateur' | 'fumiste' | 'bureau_etudes' | 'distributeur';
export type Potentiel = 'A' | 'B' | 'C';
export type NatureCompte = 'client' | 'prospect';

export type EtapePipeline =
  | 'identifie'
  | 'contacte'
  | 'rdv_obtenu'
  | 'devis_envoye'
  | 'gagne'
  | 'perdu';

export interface ProchaineAction {
  libelle: string;
  date: ISODate;
}

export interface Contact {
  prenom: string;
  nom: string;
  fonction: string;
  telephone: string;
  email: string;
}

export interface Compte extends LatLng {
  id: string;
  nature: NatureCompte;
  raisonSociale: string;
  type: TypeCompte;
  adresse: string;
  codePostal: string;
  commune: string;
  departement: string;
  contact: Contact;
  commercialId: string;
  secteurId: string;
  potentiel: Potentiel;
  /** Marqué manuellement comme compte stratégique. */
  important: boolean;
  prochaineAction?: ProchaineAction;
  creeLe: ISODate;
  // Champs propres aux prospects
  etape?: EtapePipeline;
  /** Score de potentiel 0 à 100. */
  score?: number;
  motifPerte?: string;
  etapeModifieeLe?: ISODate;
}

export type ResultatVisite =
  | 'positif'
  | 'neutre'
  | 'negatif'
  | 'devis_demande'
  | 'commande'
  | 'absent';

export interface Visite {
  id: string;
  compteId: string;
  commercialId: string;
  /** Début du rendez-vous. */
  debut: ISODateTime;
  dureeMin: number;
  resultat: ResultatVisite;
  prochaineAction?: string;
  dateRelance?: ISODate;
  note?: string;
  tourneeId?: string;
}

export type CanalEchange = 'appel' | 'email' | 'salon' | 'autre';

export interface Echange {
  id: string;
  compteId: string;
  commercialId: string;
  date: ISODate;
  canal: CanalEchange;
  resume: string;
}

export type StatutDevis = 'en_cours' | 'accepte' | 'refuse';

export interface Devis {
  id: string;
  compteId: string;
  commercialId: string;
  date: ISODate;
  montantHT: number;
  statut: StatutDevis;
  objet: string;
}

export interface Commande {
  id: string;
  compteId: string;
  date: ISODate;
  montantHT: number;
  devisId?: string;
}

export interface EtapeTournee {
  compteId: string;
  /** Durée spécifique ; sinon durée par défaut de la tournée. */
  dureeMin?: number;
  /** Visite réalisée (compte-rendu saisi). */
  visiteId?: string;
}

export interface Tournee {
  id: string;
  commercialId: string;
  date: ISODate;
  heureDepart: string; // "08:00"
  dureeRdvMin: number;
  etapes: EtapeTournee[];
  creeLe: ISODateTime;
  modifieeLe: ISODateTime;
}

export interface Parametres {
  coefRoutier: number;
  vitesseMoyenneKmh: number;
  dureeRdvMin: number;
  heureDepart: string;
  pauseDejeuner: { active: boolean; debut: string; dureeMin: number };
  heureLimiteRetour: string;
  rayonSuggestionKm: number;
  /** Seuils de statut (jours). */
  seuilActifJours: number;
  seuilRisqueJours: number;
  /** Baisse de CA (6 derniers mois vs 6 précédents) au-delà de laquelle le client est à risque. */
  seuilBaisseCA: number;
  seuilScoreChaud: number;
  /** CA 12 mois à partir duquel un client est considéré important. */
  seuilCAImportant: number;
  seuilProspectInactifJours: number;
  couvertureJours: number;
}

export type StatutCompte = 'client_actif' | 'client_risque' | 'prospect_chaud' | 'prospect_froid';

export type Profil = { kind: 'commercial'; commercialId: string } | { kind: 'manager' };
