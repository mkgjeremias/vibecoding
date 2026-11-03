import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGrip, IconX } from '../../components/icons';
import { StatutBadge } from '../../components/ui';
import type { CompteInfo } from '../../domain/derive';
import type { EtapeTournee } from '../../domain/types';
import { fmtDuree, fmtHeureMin, fmtKm } from '../../lib/format';
import type { ScheduledStop } from '../../routing/schedule';

const DUREES = [30, 45, 60, 75, 90, 120, 150, 180];

interface RowProps {
  etape: EtapeTournee;
  index: number;
  info: CompteInfo;
  stop?: ScheduledStop;
  dureeDefaut: number;
  onDuree: (min: number | undefined) => void;
  onRemove: () => void;
  onSelect: () => void;
}

function Row({ etape, index, info, stop, dureeDefaut, onDuree, onRemove, onSelect }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: etape.compteId });
  const c = info.compte;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border bg-white ${isDragging ? 'z-10 border-marine-600 shadow-lg' : 'border-slate-200'}`}
    >
      {stop && (
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-1 text-xs text-slate-600">
          <span>
            Trajet {fmtKm(stop.legKm)} · {fmtDuree(stop.legMin)}
          </span>
          {stop.pauseAvantMin > 0 && <span className="font-semibold text-amber-800">· Pause {fmtDuree(stop.pauseAvantMin)}</span>}
        </div>
      )}
      <div className="flex items-stretch gap-1 p-2">
        <button
          {...attributes}
          {...listeners}
          aria-label={`Déplacer ${c.raisonSociale}`}
          className="flex w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
        >
          <IconGrip />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full bg-marine-700 text-sm font-bold text-white">
          {index + 1}
        </div>
        <button onClick={onSelect} className="min-w-0 flex-1 px-2 text-left">
          <div className="truncate font-semibold">{c.raisonSociale}</div>
          <div className="truncate text-sm text-slate-600">{c.commune}</div>
          <div className="mt-0.5">
            <StatutBadge statut={info.statut} />
          </div>
        </button>
        <div className="flex shrink-0 flex-col items-end justify-between gap-1">
          {stop ? (
            <span className="text-sm font-bold text-marine-800">
              {fmtHeureMin(stop.debutRdvMin)} – {fmtHeureMin(stop.finRdvMin)}
            </span>
          ) : (
            <span className="text-sm text-slate-400">…</span>
          )}
          <select
            aria-label="Durée du rendez-vous"
            className="min-h-9 rounded border border-slate-300 bg-white px-1 text-sm"
            value={etape.dureeMin ?? ''}
            onChange={(e) => onDuree(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Défaut ({fmtDuree(dureeDefaut)})</option>
            {DUREES.map((d) => (
              <option key={d} value={d}>
                {fmtDuree(d)}
              </option>
            ))}
          </select>
        </div>
        <button onClick={onRemove} aria-label={`Retirer ${c.raisonSociale}`} className="flex w-10 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-700">
          <IconX />
        </button>
      </div>
    </li>
  );
}

export function StopList({
  etapes,
  infos,
  stops,
  dureeDefaut,
  onChange,
  onSelect,
}: {
  etapes: EtapeTournee[];
  infos: Map<string, CompteInfo>;
  stops?: ScheduledStop[];
  dureeDefaut: number;
  onChange: (etapes: EtapeTournee[]) => void;
  onSelect: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = etapes.findIndex((x) => x.compteId === e.active.id);
    const to = etapes.findIndex((x) => x.compteId === e.over!.id);
    onChange(arrayMove(etapes, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={etapes.map((e) => e.compteId)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2">
          {etapes.map((e, i) => {
            const info = infos.get(e.compteId);
            if (!info) return null;
            return (
              <Row
                key={e.compteId}
                etape={e}
                index={i}
                info={info}
                stop={stops?.[i]}
                dureeDefaut={dureeDefaut}
                onDuree={(min) => onChange(etapes.map((x) => (x.compteId === e.compteId ? { ...x, dureeMin: min } : x)))}
                onRemove={() => onChange(etapes.filter((x) => x.compteId !== e.compteId))}
                onSelect={() => onSelect(e.compteId)}
              />
            );
          })}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
