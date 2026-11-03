import { useMemo, useState } from 'react';
import { Button, Field, inputCls } from '../../components/ui';
import { IconX } from '../../components/icons';
import { TYPE_LABEL } from '../../domain/labels';
import type { Commercial, Compte, Potentiel, TypeCompte } from '../../domain/types';
import { isoDay } from '../../lib/format';
import { uid } from '../../lib/random';
import communesData from '../../seed/communes.json';
import { useData } from '../../state/DataContext';

interface CommuneRef {
  code: string;
  nom: string;
  dep: string;
  lat: number;
  lng: number;
  secteur: string;
  cp: string;
}
const COMMUNES = communesData as CommuneRef[];

/**
 * Création d'un prospect. Sans service de géocodage dans ce prototype,
 * le prospect est positionné au centre de la commune choisie dans le référentiel local.
 */
export function NouveauProspect({ commercial, onClose, onCreated }: { commercial: Commercial; onClose: () => void; onCreated: (id: string) => void }) {
  const { saveCompte } = useData();
  const communes = useMemo(
    () => COMMUNES.filter((c) => c.secteur === commercial.secteurId).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [commercial.secteurId],
  );
  const [f, setF] = useState({
    raisonSociale: '',
    type: 'installateur' as TypeCompte,
    commune: '',
    adresse: '',
    prenom: '',
    nom: '',
    telephone: '',
    potentiel: 'B' as Potentiel,
  });
  const communeRef = communes.find((c) => `${c.nom} (${c.cp})` === f.commune);
  const valide = f.raisonSociale.trim() && communeRef;

  const creer = async () => {
    if (!communeRef) return;
    const c: Compte = {
      id: uid('pr'),
      nature: 'prospect',
      raisonSociale: f.raisonSociale.trim(),
      type: f.type,
      adresse: f.adresse.trim() || 'Adresse à compléter',
      codePostal: communeRef.cp,
      commune: communeRef.nom,
      departement: communeRef.dep,
      lat: communeRef.lat,
      lng: communeRef.lng,
      contact: { prenom: f.prenom, nom: f.nom, fonction: '', telephone: f.telephone, email: '' },
      commercialId: commercial.id,
      secteurId: commercial.secteurId,
      potentiel: f.potentiel,
      important: false,
      creeLe: isoDay(new Date()),
      etape: 'identifie',
      score: { A: 70, B: 50, C: 30 }[f.potentiel],
      etapeModifieeLe: isoDay(new Date()),
    };
    await saveCompte(c);
    onCreated(c.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Nouveau prospect</h2>
        <button onClick={onClose} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100">
          <IconX />
        </button>
      </div>
      <Field label="Raison sociale">
        <input className={inputCls} value={f.raisonSociale} onChange={(e) => setF({ ...f, raisonSociale: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Type">
          <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as TypeCompte })}>
            {(Object.keys(TYPE_LABEL) as TypeCompte[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Potentiel">
          <select className={inputCls} value={f.potentiel} onChange={(e) => setF({ ...f, potentiel: e.target.value as Potentiel })}>
            <option value="A">A · fort</option>
            <option value="B">B · moyen</option>
            <option value="C">C · faible</option>
          </select>
        </Field>
      </div>
      <Field label="Commune" hint="Communes du secteur. Le prospect est placé au centre de la commune (pas de géocodage d'adresse).">
        <input list="communes-secteur" className={inputCls} value={f.commune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="Commencer à taper…" />
        <datalist id="communes-secteur">
          {communes.map((c) => (
            <option key={c.code} value={`${c.nom} (${c.cp})`} />
          ))}
        </datalist>
      </Field>
      <Field label="Adresse">
        <input className={inputCls} value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Prénom du contact">
          <input className={inputCls} value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} />
        </Field>
        <Field label="Nom du contact">
          <input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
        </Field>
      </div>
      <Field label="Téléphone">
        <input type="tel" className={inputCls} value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} />
      </Field>
      <Button className="w-full" disabled={!valide} onClick={creer}>
        Créer le prospect
      </Button>
    </div>
  );
}
