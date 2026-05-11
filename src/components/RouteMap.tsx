/**
 * BACS Labs · Route Map
 *
 * Leaflet harita component'ı — React island.
 * SSR-safe: leaflet'i useEffect içinde dinamik import eder.
 *
 * Mixed mode: aynı rotanın iki versiyonu (FSM kırmızı / YSS yeşil)
 * paralel polyline olarak çizilir.
 */

import { useEffect, useRef } from 'react';
import type { LatLng, Waypoint, BridgeId } from '../lib/types';
import type { RouteGeometry } from '../lib/distance-service';
import { bridgeShortName } from '../lib/bridge-data';

export interface RouteOverlay {
  geometry: RouteGeometry;
  /** UI etiketi — örn. "FSM rotası" */
  label: string;
  /** Polyline rengi (CSS) */
  color: string;
  /** Bu rotada kullanılan waypoint'ler — köprü marker'ları için */
  waypoints: Waypoint[];
}

export interface RouteMapProps {
  /** Tek veya iki rota (mixed mode) */
  routes: RouteOverlay[];
  /** Tüm rotaları çevreleyen fit bounds yapsın mı */
  autoFit?: boolean;
  /** İlk yükleme görünüm merkezi (default: Türkiye) */
  defaultCenter?: LatLng;
  defaultZoom?: number;
}

const DEFAULT_CENTER: LatLng = { lat: 39.0, lng: 35.0 }; // Türkiye merkezi
const DEFAULT_ZOOM = 6;

export function RouteMap({
  routes,
  autoFit = true,
  defaultCenter = DEFAULT_CENTER,
  defaultZoom = DEFAULT_ZOOM,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const layersRef = useRef<unknown[]>([]);

  // Map initialization (one-time)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!containerRef.current) return;

      // Dinamik import — SSR'da leaflet'i yükleme
      const L = await import('leaflet');
      // CSS'i de dinamik yükle (Leaflet için zorunlu)
      await import('leaflet/dist/leaflet.css' as string).catch(() => {
        /* Astro/Vite içinde tailwind tarafından handle ediliyor */
      });

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [defaultCenter.lat, defaultCenter.lng],
        zoom: defaultZoom,
        scrollWheelZoom: false,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap contributors',
        className: 'bacs-tile-layer',
      }).addTo(map);

      mapInstanceRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        // @ts-expect-error — Leaflet Map.remove dinamik tipte
        mapInstanceRef.current.remove?.();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Route updates
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    (async () => {
      const L = await import('leaflet');
      const map = mapInstanceRef.current as any;

      // Clear previous layers
      for (const layer of layersRef.current) {
        try {
          map.removeLayer(layer);
        } catch {
          /* ignore */
        }
      }
      layersRef.current = [];

      if (routes.length === 0) return;

      const allCoords: [number, number][] = [];

      for (const overlay of routes) {
        // Main polyline
        const polyline = L.polyline(overlay.geometry.coordinates, {
          color: overlay.color,
          weight: 4,
          opacity: 0.85,
        }).addTo(map);

        polyline.bindTooltip(overlay.label, {
          permanent: false,
          sticky: true,
          direction: 'top',
          className: 'bacs-tooltip',
        });

        layersRef.current.push(polyline);
        allCoords.push(...overlay.geometry.coordinates);

        // Waypoint markers (bridges)
        for (const wp of overlay.waypoints) {
          const marker = L.circleMarker([wp.location.lat, wp.location.lng], {
            radius: 7,
            color: overlay.color,
            fillColor: '#0a0a0a',
            fillOpacity: 1,
            weight: 2.5,
          }).addTo(map);

          if (wp.bridgeId) {
            marker.bindPopup(
              `<div class="bacs-popup">
                <div class="text-xs uppercase tracking-wider text-neutral-400">Köprü</div>
                <div class="text-base font-semibold text-white mt-0.5">${bridgeShortName(wp.bridgeId)}</div>
              </div>`,
              { closeButton: false, className: 'bacs-leaflet-popup' }
            );
          }
          layersRef.current.push(marker);
        }

        // Start / end markers
        const start = overlay.geometry.coordinates[0];
        const end = overlay.geometry.coordinates[overlay.geometry.coordinates.length - 1];

        if (start) {
          const startMarker = L.circleMarker(start, {
            radius: 9,
            color: '#6366f1',
            fillColor: '#fafafa',
            fillOpacity: 1,
            weight: 2.5,
          }).addTo(map);
          layersRef.current.push(startMarker);
        }
        if (end) {
          const endMarker = L.circleMarker(end, {
            radius: 9,
            color: '#6366f1',
            fillColor: '#0a0a0a',
            fillOpacity: 1,
            weight: 2.5,
          }).addTo(map);
          layersRef.current.push(endMarker);
        }
      }

      // Auto-fit
      if (autoFit && allCoords.length > 1) {
        const bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }
    })();
  }, [routes, autoFit]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-border-default)]">
      <div
        ref={containerRef}
        className="h-[420px] w-full"
        style={{ background: '#0a0a0a' }}
      />
      {routes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-xs uppercase tracking-widest text-neutral-500">
            Hesapla → rota burada
          </div>
        </div>
      )}
    </div>
  );
}

// Track which bridge IDs are in use — for legend
export function getBridgeIdsFromRoutes(routes: RouteOverlay[]): BridgeId[] {
  const set = new Set<BridgeId>();
  for (const r of routes) {
    for (const wp of r.waypoints) {
      if (wp.bridgeId) set.add(wp.bridgeId);
    }
  }
  return Array.from(set);
}
