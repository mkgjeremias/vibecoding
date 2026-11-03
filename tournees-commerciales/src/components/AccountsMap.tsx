import { useEffect, type ReactNode } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { STATUT_COULEUR, STATUT_LABEL } from '../domain/labels';
import type { LatLng, StatutCompte } from '../domain/types';

export interface MapPoint extends LatLng {
  id: string;
  label: string;
  statut: StatutCompte;
  important?: boolean;
  selected?: boolean;
  dimmed?: boolean;
}

function FitBounds({ points, fitKey }: { points: LatLng[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(b, { padding: [30, 30], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

/** Recalcule la taille quand le conteneur change (panneaux latéraux, onglets mobiles). */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export function BaseMap({
  children,
  fitPoints,
  fitKey,
  className = '',
}: {
  children: ReactNode;
  fitPoints: LatLng[];
  fitKey: string;
  className?: string;
}) {
  return (
    <MapContainer center={[46.6, 2.4]} zoom={6} className={`h-full w-full ${className}`} preferCanvas>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitBounds points={fitPoints} fitKey={fitKey} />
      <AutoResize />
      {children}
      {import.meta.env.VITE_ARTIFACT === '1' && (
        <div className="pointer-events-none absolute bottom-7 right-2 z-[400] max-w-[16rem] rounded bg-white/90 px-2 py-1 text-xs text-slate-700 shadow">
          Version en ligne : fond de carte OpenStreetMap indisponible. Il s'affiche en local.
        </div>
      )}
    </MapContainer>
  );
}

export function AccountMarkers({ points, onSelect }: { points: MapPoint[]; onSelect: (id: string) => void }) {
  return (
    <>
      {points.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={p.selected ? 10 : p.important ? 8 : 6.5}
          pathOptions={{
            color: p.selected ? '#f59e0b' : p.important ? '#0f172a' : '#ffffff',
            weight: p.selected ? 4 : p.important ? 2.5 : 1.5,
            fillColor: STATUT_COULEUR[p.statut],
            fillOpacity: p.dimmed ? 0.35 : 0.95,
          }}
          eventHandlers={{ click: () => onSelect(p.id) }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {p.label}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

export function Legend({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-sm ${className}`}>
      {(Object.keys(STATUT_LABEL) as StatutCompte[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-white" style={{ background: STATUT_COULEUR[s] }} />
          {STATUT_LABEL[s]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border-2 border-slate-900 bg-slate-300" />
        Compte important
      </span>
    </div>
  );
}
