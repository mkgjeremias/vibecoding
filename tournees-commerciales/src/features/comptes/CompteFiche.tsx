import type { ReactNode } from 'react';
import { Badge, StatutBadge } from '../../components/ui';
import { IconPhone, IconX } from '../../components/icons';
import { CANAL_LABEL, ETAPE_LABEL, POTENTIEL_LABEL, RESULTAT_LABEL, TYPE_LABEL } from '../../domain/labels';
import { fmtAnciennete, fmtDate, fmtEuro } from '../../lib/format';
import { useData } from '../../state/DataContext';

interface HistItem {
  date: string;
  titre: string;
  detail?: string;
}

/** Historique fusionné : visites et échanges (appels, e-mails…), du plus récent au plus ancien. */
export function useHistorique(compteId: string): HistItem[] {
  const { data, derived } = useData();
  const visites = derived.visitesParCompte.get(compteId) ?? [];
  const items: HistItem[] = [
    ...visites.map((v) => ({
      date: v.debut.slice(0, 10),
      titre: `Visite · ${RESULTAT_LABEL[v.resultat]}`,
      detail: [v.note, v.prochaineAction && `Prochaine action : ${v.prochaineAction}`].filter(Boolean).join(' · ') || undefined,
    })),
    ...data.echanges
      .filter((e) => e.compteId === compteId)
      .map((e) => ({ date: e.date, titre: CANAL_LABEL[e.canal], detail: e.resume })),
  ];
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export function CompteFiche({
  compteId,
  onClose,
  actions,
  maxHistorique = 6,
}: {
  compteId: string;
  onClose?: () => void;
  actions?: ReactNode;
  maxHistorique?: number;
}) {
  const { data, derived } = useData();
  const info = derived.infos.get(compteId);
  const hist = useHistorique(compteId);
  if (!info) return null;
  const c = info.compte;
  const commercial = data.commerciaux.find((x) => x.id === c.commercialId);
  const devis = data.devis.filter((d) => d.compteId === c.id).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold leading-tight text-marine-900">{c.raisonSociale}</h2>
          <p className="text-sm text-slate-700">
            {TYPE_LABEL[c.type]} · {c.commune} ({c.departement})
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Fermer" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100">
            <IconX />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StatutBadge statut={info.statut} />
        <Badge>Potentiel {POTENTIEL_LABEL[c.potentiel]}</Badge>
        {info.important && <Badge tone="blue">Compte important</Badge>}
        {c.etape && <Badge tone="amber">{ETAPE_LABEL[c.etape]}</Badge>}
        {c.score !== undefined && <Badge>Score {c.score}/100</Badge>}
      </div>

      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-slate-600">Dernière visite</dt>
          <dd className="font-semibold">{info.derniereVisite ? `${fmtDate(info.derniereVisite)} (${fmtAnciennete(info.derniereVisite)})` : 'Jamais'}</dd>
        </div>
        <div>
          <dt className="text-slate-600">CA 12 mois</dt>
          <dd className="font-semibold">{fmtEuro(info.ca12m)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Visites 12 mois</dt>
          <dd className="font-semibold">{info.nbVisites12m}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Commercial</dt>
          <dd className="font-semibold">
            {commercial?.prenom} {commercial?.nom}
          </dd>
        </div>
      </dl>

      {c.prochaineAction && (
        <div className="rounded-lg bg-marine-50 p-3 text-sm">
          <div className="font-semibold text-marine-800">Prochaine action · {fmtDate(c.prochaineAction.date)}</div>
          <div>{c.prochaineAction.libelle}</div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 p-3 text-sm">
        <div className="font-semibold">
          {c.contact.prenom} {c.contact.nom} · {c.contact.fonction}
        </div>
        <div className="text-slate-700">
          {c.adresse}, {c.codePostal} {c.commune}
        </div>
        <a href={`tel:${c.contact.telephone.replace(/\s/g, '')}`} className="mt-1 inline-flex min-h-11 items-center gap-2 font-semibold text-marine-700 underline">
          <IconPhone width={18} height={18} /> {c.contact.telephone}
        </a>
      </div>

      {devis.length > 0 && (
        <div>
          <h3 className="mb-1 font-bold">Devis</h3>
          <ul className="space-y-1 text-sm">
            {devis.slice(0, 4).map((d) => (
              <li key={d.id} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">
                  {fmtDate(d.date)} · {d.objet}
                </span>
                <span className="shrink-0 font-semibold">
                  {fmtEuro(d.montantHT)}{' '}
                  <Badge tone={d.statut === 'en_cours' ? 'amber' : d.statut === 'accepte' ? 'green' : 'red'}>
                    {d.statut === 'en_cours' ? 'En cours' : d.statut === 'accepte' ? 'Accepté' : 'Refusé'}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-1 font-bold">Historique</h3>
        {hist.length === 0 ? (
          <p className="text-sm text-slate-600">Aucun échange enregistré.</p>
        ) : (
          <ol className="space-y-2 border-l-2 border-slate-200 pl-3 text-sm">
            {hist.slice(0, maxHistorique).map((h, i) => (
              <li key={i}>
                <div className="font-semibold">
                  {fmtDate(h.date)} · {h.titre}
                </div>
                {h.detail && <div className="text-slate-700">{h.detail}</div>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
