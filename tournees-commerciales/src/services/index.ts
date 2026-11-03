import type { DataService } from './DataService';
import { LocalStorageDataService } from './LocalStorageDataService';

export type { DataService, DataSnapshot } from './DataService';
export { PARAMETRES_DEFAUT } from './defaults';

/** Implémentation active. Remplacer ici par un CrmDataService le moment venu. */
export const dataService: DataService = new LocalStorageDataService();
