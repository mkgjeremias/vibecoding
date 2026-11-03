import type {
  Commande,
  Commercial,
  Compte,
  Devis,
  Echange,
  Parametres,
  Secteur,
  Tournee,
  Visite,
} from '../domain/types';

/** Instantané complet des données, chargé au démarrage. */
export interface DataSnapshot {
  secteurs: Secteur[];
  commerciaux: Commercial[];
  comptes: Compte[];
  visites: Visite[];
  echanges: Echange[];
  devis: Devis[];
  commandes: Commande[];
  tournees: Tournee[];
  parametres: Parametres;
  /** Date de génération du jeu de données. */
  genereLe: string;
}

/**
 * Contrat d'accès aux données.
 * L'implémentation actuelle stocke tout dans le localStorage du navigateur.
 * Pour brancher un CRM, il suffit d'écrire une autre implémentation de cette interface
 * (appels HTTP vers l'API du CRM) et de la déclarer dans services/index.ts.
 */
export interface DataService {
  load(): Promise<DataSnapshot>;

  saveCompte(c: Compte): Promise<Compte>;
  saveVisite(v: Visite): Promise<Visite>;
  saveEchange(e: Echange): Promise<Echange>;
  saveDevis(d: Devis): Promise<Devis>;
  saveTournee(t: Tournee): Promise<Tournee>;
  deleteTournee(id: string): Promise<void>;
  saveParametres(p: Parametres): Promise<Parametres>;

  /** Réinitialise les données fictives. */
  reset(): Promise<DataSnapshot>;
}
