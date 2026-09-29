import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress, getRoute } from '../src/lib/distance-service';

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

describe('geocodeAddress payload validation', () => {
  it('valid Nominatim payload returns display and coordinates', async () => {
    mockJson([
      {
        lat: '41.1082',
        lon: '29.0210',
        display_name: 'Maslak, Sarıyer, İstanbul, Türkiye',
      },
    ]);

    await expect(geocodeAddress('Maslak')).resolves.toEqual({
      display: 'Maslak, Sarıyer, İstanbul, Türkiye',
      location: { lat: 41.1082, lng: 29.021 },
    });
  });

  it('short query returns null without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(geocodeAddress('M')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('empty or non-array payload fails closed', async () => {
    mockJson([]);
    await expect(geocodeAddress('Maslak')).resolves.toBeNull();

    mockJson({ lat: '41.1', lon: '29.0', display_name: 'Maslak' });
    await expect(geocodeAddress('Maslak')).resolves.toBeNull();
  });

  it('invalid or out-of-range coordinates fail closed', async () => {
    mockJson([{ lat: 'not-a-number', lon: '29.0', display_name: 'Maslak' }]);
    await expect(geocodeAddress('Maslak')).resolves.toBeNull();

    mockJson([{ lat: '91', lon: '29.0', display_name: 'Maslak' }]);
    await expect(geocodeAddress('Maslak')).resolves.toBeNull();

    mockJson([{ lat: '41.1', lon: '181', display_name: 'Maslak' }]);
    await expect(geocodeAddress('Maslak')).resolves.toBeNull();
  });

  it('missing or blank display_name fails closed', async () => {
    mockJson([{ lat: '41.1', lon: '29.0' }]);
    await expect(geocodeAddress('Maslak')).resolves.toBeNull();

    mockJson([{ lat: '41.1', lon: '29.0', display_name: '   ' }]);
    await expect(geocodeAddress('Maslak')).resolves.toBeNull();
  });
});


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

