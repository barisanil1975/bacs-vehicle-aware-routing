import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress } from '../src/lib/distance-service';

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
