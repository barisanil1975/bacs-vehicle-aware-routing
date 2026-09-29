/**
 * BACS Labs · Distance Service
 *
 * OSRM (Open Source Routing Machine) public API wrapper.
 * Kalkış/varış adresleri için mesafe + rota geometrisi döner.
 *
 * Service: router.project-osrm.org (rate-limited, demo amaçlı)
 * Production: kendi OSRM instance veya GraphHopper/Stadia Maps.
 *
 * Iki katmanlı yaklaşım:
 *  1. Nominatim geocode (yer adı → LatLng)
 *  2. OSRM route (LatLng[] → rota)
 */

import type { LatLng } from './types';

export interface RouteGeometry {
  /** Polyline koordinatları — Leaflet draw için [lat, lng][] */
  coordinates: [number, number][];
  /** Toplam mesafe (km) */
  distanceKm: number;
  /** Tahmini süre (dakika) */
  durationMin: number;
}

export interface GeocodeResult {
  display: string;
  location: LatLng;
}

/* ────────────────────────────────────────────────────────────
   1) Geocoding — Nominatim (OpenStreetMap)
   ──────────────────────────────────────────────────────────── */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/**
 * Yer adı → LatLng. Türkiye-bias.
 *
 * Rate limit: 1 req/sec (Nominatim usage policy).
 * Production'da self-hosted Photon veya Maptiler kullan.
 */
export async function geocodeAddress(
  query: string
): Promise<GeocodeResult | null> {
  if (!query || query.trim().length < 2) return null;

  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('countrycodes', 'tr');
  url.searchParams.set('limit', '1');
  url.searchParams.set('accept-language', 'tr');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'bacs-labs/0.1 (labs.barisanil.com)',
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0];
    if (!first || typeof first !== 'object') return null;

    const record = first as Record<string, unknown>;
    if (
      typeof record.lat !== 'string' ||
      typeof record.lon !== 'string' ||
      typeof record.display_name !== 'string' ||
      record.display_name.trim().length === 0
    ) {
      return null;
    }

    const lat = Number.parseFloat(record.lat);
    const lng = Number.parseFloat(record.lon);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }

    return {
      display: record.display_name,
      location: { lat, lng },
    };
  } catch (err) {
    console.error('[geocode] failed:', err);
    return null;
  }
}

/* ────────────────────────────────────────────────────────────
   2) Routing — OSRM
   ──────────────────────────────────────────────────────────── */

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

/**
 * İki nokta arasında rota — OSRM polyline geometrisi ile.
 *
 * Waypoint desteği: ara noktalar verilirse rota onlardan geçer.
 * BACS engine bridge waypoint'leri burada uygulanabilir.
 *
 * @returns mesafe + süre + koordinat dizisi (Leaflet için)
 */
export async function getRoute(
  from: LatLng,
  to: LatLng,
  waypoints: LatLng[] = []
): Promise<RouteGeometry | null> {
  // Coordinate format: lng,lat (OSRM convention)
  const coords = [from, ...waypoints, to]
    .map((p) => `${p.lng},${p.lat}`)
    .join(';');

  const url = new URL(`${OSRM_BASE}/${coords}`);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('alternatives', 'false');
  url.searchParams.set('steps', 'false');

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = (await res.json()) as unknown;
    if (!data || typeof data !== 'object') return null;

    const record = data as Record<string, unknown>;
    if (record.code !== 'Ok' || !Array.isArray(record.routes) || record.routes.length === 0) {
      return null;
    }

    const firstRoute = record.routes[0];
    if (!firstRoute || typeof firstRoute !== 'object') return null;

    const route = firstRoute as Record<string, unknown>;
    const distance = route.distance;
    const duration = route.duration;
    const geometry = route.geometry;

    if (
      typeof distance !== 'number' ||
      !Number.isFinite(distance) ||
      distance < 0 ||
      typeof duration !== 'number' ||
      !Number.isFinite(duration) ||
      duration < 0 ||
      !geometry ||
      typeof geometry !== 'object'
    ) {
      return null;
    }

    const rawCoordinates = (geometry as Record<string, unknown>).coordinates;
    if (!Array.isArray(rawCoordinates) || rawCoordinates.length < 2) return null;

    const coordinates: [number, number][] = [];
    for (const pair of rawCoordinates) {
      if (
        !Array.isArray(pair) ||
        pair.length < 2 ||
        typeof pair[0] !== 'number' ||
        typeof pair[1] !== 'number' ||
        !Number.isFinite(pair[0]) ||
        !Number.isFinite(pair[1]) ||
        pair[0] < -180 ||
        pair[0] > 180 ||
        pair[1] < -90 ||
        pair[1] > 90
      ) {
        return null;
      }
      // GeoJSON koordinatları [lng, lat] — Leaflet [lat, lng] istiyor.
      coordinates.push([pair[1], pair[0]]);
    }

    return {
      coordinates,
      distanceKm: distance / 1000,
      durationMin: duration / 60,
    };
  } catch (err) {
    console.error('[osrm] failed:', err);
    return null;
  }
}

/* ────────────────────────────────────────────────────────────
   3) End-to-end: address → route
   ──────────────────────────────────────────────────────────── */

export interface ResolvedRoute {
  fromGeocode: GeocodeResult;
  toGeocode: GeocodeResult;
  route: RouteGeometry;
}

/**
 * Tek çağrı: kalkış metni + varış metni + waypoint listesi → rota.
 *
 * @example
 * const result = await resolveRoute('Mahmutbey, İstanbul', 'Bursa', [
 *   { lat: 40.755, lng: 29.515 } // Osmangazi waypoint
 * ]);
 */
export async function resolveRoute(
  fromText: string,
  toText: string,
  waypoints: LatLng[] = []
): Promise<ResolvedRoute | null> {
  const [fromGeocode, toGeocode] = await Promise.all([
    geocodeAddress(fromText),
    geocodeAddress(toText),
  ]);

  if (!fromGeocode || !toGeocode) return null;

  const route = await getRoute(
    fromGeocode.location,
    toGeocode.location,
    waypoints
  );

  if (!route) return null;

  return { fromGeocode, toGeocode, route };
}
