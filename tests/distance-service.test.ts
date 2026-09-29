import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRoute } from '../src/lib/distance-service';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockJson(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('getRoute payload validation', () => {
  it('valid OSRM payload maps GeoJSON lng/lat to Leaflet lat/lng', async () => {
    mockJson({
      code: 'Ok',
      routes: [
        {
          distance: 125000,
          duration: 7200,
          geometry: {
            coordinates: [
              [29.021, 41.1082],
              [29.5159, 40.7556],
            ],
          },
        },
      ],
    });

    await expect(
      getRoute(
        { lat: 41.1082, lng: 29.021 },
        { lat: 40.7556, lng: 29.5159 }
      )
    ).resolves.toEqual({
      coordinates: [
        [41.1082, 29.021],
        [40.7556, 29.5159],
      ],
      distanceKm: 125,
      durationMin: 120,
    });
  });

  it('non-Ok code or empty routes fails closed', async () => {
    mockJson({ code: 'NoRoute', routes: [] });
    await expect(
      getRoute({ lat: 41, lng: 29 }, { lat: 40.7, lng: 29.5 })
    ).resolves.toBeNull();

    mockJson({ code: 'Ok', routes: [] });
    await expect(
      getRoute({ lat: 41, lng: 29 }, { lat: 40.7, lng: 29.5 })
    ).resolves.toBeNull();
  });

  it('invalid distance or duration fails closed', async () => {
    mockJson({
      code: 'Ok',
      routes: [
        {
          distance: Number.NaN,
          duration: 3600,
          geometry: { coordinates: [[29, 41], [29.5, 40.7]] },
        },
      ],
    });
    await expect(
      getRoute({ lat: 41, lng: 29 }, { lat: 40.7, lng: 29.5 })
    ).resolves.toBeNull();

    mockJson({
      code: 'Ok',
      routes: [
        {
          distance: 1000,
          duration: -1,
          geometry: { coordinates: [[29, 41], [29.5, 40.7]] },
        },
      ],
    });
    await expect(
      getRoute({ lat: 41, lng: 29 }, { lat: 40.7, lng: 29.5 })
    ).resolves.toBeNull();
  });

  it('malformed or out-of-range geometry fails closed', async () => {
    mockJson({
      code: 'Ok',
      routes: [
        {
          distance: 1000,
          duration: 60,
          geometry: { coordinates: [[29, 41], ['bad', 40.7]] },
        },
      ],
    });
    await expect(
      getRoute({ lat: 41, lng: 29 }, { lat: 40.7, lng: 29.5 })
    ).resolves.toBeNull();

    mockJson({
      code: 'Ok',
      routes: [
        {
          distance: 1000,
          duration: 60,
          geometry: { coordinates: [[181, 41], [29.5, 40.7]] },
        },
      ],
    });
    await expect(
      getRoute({ lat: 41, lng: 29 }, { lat: 40.7, lng: 29.5 })
    ).resolves.toBeNull();
  });

  it('missing geometry or fewer than two coordinates fails closed', async () => {
    mockJson({
      code: 'Ok',
      routes: [{ distance: 1000, duration: 60 }],
    });
    await expect(
      getRoute({ lat: 41, lng: 29 }, { lat: 40.7, lng: 29.5 })
    ).resolves.toBeNull();

    mockJson({
      code: 'Ok',
      routes: [
        {
          distance: 1000,
          duration: 60,
          geometry: { coordinates: [[29, 41]] },
        },
      ],
    });
    await expect(
      getRoute({ lat: 41, lng: 29 }, { lat: 40.7, lng: 29.5 })
    ).resolves.toBeNull();
  });
});
