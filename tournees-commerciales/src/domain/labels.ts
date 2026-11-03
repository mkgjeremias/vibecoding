import type {
  CanalEchange,
  EtapePipeline,
  Potentiel,
  ResultatVisite,
  StatutCompte,
  StatutDevis,
  TypeCompte,
} from './types';

export const TYPE_LABEL: Record<TypeCompte, string> = {
  installateur: 'Installateur',
  fumiste: 'Fumiste',
  bureau_etudes: "Bureau d'études",
  distributeur: 'Distributeur',
};

export const POTENTIEL_LABEL: Record<Potentiel, string> = {
  A: 'A · fort',
  B: 'B · moyen',
  C: 'C · faible',
};

export const ETAPES: EtapePipeline[] = [
  'identifie',
  'contacte',
  'rdv_obtenu',
  'devis_envoye',
  'gagne',
  'perdu',
];

export const ETAPE_LABEL: Record<EtapePipeline, string> = {
  identifie: 'Identifié',
  contacte: 'Contacté',
  rdv_obtenu: 'Rendez-vous obtenu',
  devis_envoye: 'Devis envoyé',
  gagne: 'Gagné',
  perdu: 'Perdu',
};

export const RESULTAT_LABEL: Record<ResultatVisite, string> = {
  positif: 'Positif',
  neutre: 'Neutre',
  negatif: 'Négatif',
  devis_demande: 'Devis demandé',
  commande: 'Commande',
  absent: 'Absent',
};

export const CANAL_LABEL: Record<CanalEchange, string> = {
  appel: 'Appel',
  email: 'E-mail',
  salon: 'Salon',
  autre: 'Autre',
};

export const STATUT_DEVIS_LABEL: Record<StatutDevis, string> = {
  en_cours: 'En cours',
  accepte: 'Accepté',
  refuse: 'Refusé',
};

export const STATUT_LABEL: Record<StatutCompte, string> = {
  client_actif: 'Client actif',
  client_risque: 'Client à risque',
  prospect_chaud: 'Prospect chaud',
  prospect_froid: 'Prospect froid',
};

/** Couleurs choisies pour rester distinguables en extérieur et pour les daltoniens (bleu / orange / rouge / gris). */
export const STATUT_COULEUR: Record<StatutCompte, string> = {
  client_actif: '#1d4ed8',
  client_risque: '#dc2626',
  prospect_chaud: '#ea580c',
  prospect_froid: '#64748b',
};
