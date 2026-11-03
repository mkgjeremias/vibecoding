import { useEffect, useState } from 'react';
import L from 'leaflet';
import { Marker, Polyline, Tooltip } from 'react-leaflet';
import { AccountMarkers, BaseMap, type MapPoint } from '../../components/AccountsMap';
import type { Compte, LatLng } from '../../domain/types';
import { getRoutingProvider } from '../../routing';

const numIcon = (n: number, done = false) =>
  L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${done ? '#15803d' : '#1e3a5f'};color:#fff;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">${n}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const homeIcon = L.divIcon({
  className: '',
  html: `<div style="width:34px;height:34px;border-radius:8px;background:#f59e0b;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2.5"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

export function TourMap({
  domicile,
  etapes,
  faits = new Set(),
  autres = [],
  onSelect,
  extraFit = [],
}: {
  domicile: LatLng & { label?: string };
  etapes: Compte[];
  faits?: Set<string>;
  autres?: MapPoint[];
  onSelect?: (id: string) => void;
  extraFit?: LatLng[];
}) {
  const [geom, setGeom] = useState<LatLng[]>([]);
  const key = etapes.map((e) => e.id).join(',');

  useEffect(() => {
    let alive = true;
    const pts = [domicile, ...etapes, domicile];
    getRoutingProvider()
      .geometry(pts)
      .then((g) => alive && setGeom(g));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, domicile.lat, domicile.lng]);

  const fit = [domicile, ...etapes, ...extraFit];
  return (
    <BaseMap fitPoints={fit} fitKey={`${domicile.lat}-${key}-${extraFit.length}`}>
      {autres.length > 0 && onSelect && <AccountMarkers points={autres} onSelect={onSelect} />}
      {geom.length > 1 && (
        <Polyline positions={geom.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#1e3a5f', weight: 4, opacity: 0.8, dashArray: '8 6' }} />
      )}
      <Marker position={[domicile.lat, domicile.lng]} icon={homeIcon}>
        <Tooltip direction="top" offset={[0, -14]}>
          Départ et retour{domicile.label ? ` · ${domicile.label}` : ''}
        </Tooltip>
      </Marker>
      {etapes.map((c, i) => (
        <Marker key={c.id} position={[c.lat, c.lng]} icon={numIcon(i + 1, faits.has(c.id))} eventHandlers={onSelect ? { click: () => onSelect(c.id) } : undefined}>
          <Tooltip direction="top" offset={[0, -14]}>
            {i + 1}. {c.raisonSociale} · {c.commune}
          </Tooltip>
        </Marker>
      ))}
    </BaseMap>
  );
}
