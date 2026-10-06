import { searchRestaurants } from './places';

type Props = Record<string, unknown>;
const feature = (properties: Props, coordinates: [number, number] = [34.78, 32.08]) => ({
  properties,
  geometry: { coordinates },
});

const mockFetch = jest.fn();
beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

function respondWith(features: unknown[], ok = true, status = 200) {
  mockFetch.mockResolvedValueOnce({ ok, status, json: async () => ({ features }) });
}

const restaurant = (name: string, extra: Props = {}) =>
  feature({ name, osm_key: 'amenity', osm_value: 'restaurant', osm_type: 'N', osm_id: 42, ...extra });

describe('searchRestaurants (Photon)', () => {
  it('returns [] for a blank query without calling Photon', async () => {
    expect(await searchRestaurants('   ')).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('maps a Photon feature to a PlaceResult with a stable OSM id and address', async () => {
    respondWith([
      restaurant('Burger Bar', { street: 'Dizengoff', housenumber: '99', city: 'Tel Aviv', country: 'Israel' }),
    ]);
    expect(await searchRestaurants('burger')).toEqual([
      { id: 'photon-N-42', displayName: 'Burger Bar', formattedAddress: 'Dizengoff 99, Tel Aviv, Israel' },
    ]);
  });

  it('falls back to a coordinate id and to the name when there is no address', async () => {
    respondWith([feature({ name: 'Shack', osm_key: 'amenity', osm_value: 'fast_food' }, [1.234567, 2.345678])]);
    expect(await searchRestaurants('shack')).toEqual([
      { id: 'photon-1.23457-2.34568', displayName: 'Shack', formattedAddress: 'Shack' },
    ]);
  });

  it('sends the query, language and limit, over-fetching when filtering by country', async () => {
    respondWith([]);
    await searchRestaurants('burger', 'il', 'he');
    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://photon.komoot.io/api/');
    expect(url.searchParams.get('q')).toBe('burger');
    expect(url.searchParams.get('lang')).toBe('he');
    expect(url.searchParams.get('limit')).toBe('40');

    respondWith([]);
    await searchRestaurants('burger');
    const plain = new URL(mockFetch.mock.calls[1][0]);
    expect(plain.searchParams.get('lang')).toBe('default');
    expect(plain.searchParams.get('limit')).toBe('20');
  });

  it('keeps only results in the selected country (case-insensitive)', async () => {
    respondWith([
      restaurant('In Israel', { countrycode: 'IL', osm_id: 1 }),
      restaurant('In France', { countrycode: 'FR', osm_id: 2 }),
    ]);
    const results = await searchRestaurants('burger', 'il');
    expect(results.map((r) => r.displayName)).toEqual(['In Israel']);
  });

  it('prefers food amenities, but falls back to all results when none match', async () => {
    respondWith([
      feature({ name: 'Burger Street', osm_key: 'highway', osm_value: 'residential', osm_type: 'W', osm_id: 1 }),
      restaurant('Burger Bar'),
    ]);
    expect((await searchRestaurants('burger')).map((r) => r.displayName)).toEqual(['Burger Bar']);

    respondWith([feature({ name: 'Burger Street', osm_key: 'highway', osm_value: 'residential', osm_type: 'W', osm_id: 1 })]);
    expect((await searchRestaurants('burger')).map((r) => r.displayName)).toEqual(['Burger Street']);
  });

  it('returns at most 10 results', async () => {
    respondWith(Array.from({ length: 15 }, (_, i) => restaurant(`R${i}`, { osm_id: i + 1 })));
    expect(await searchRestaurants('burger')).toHaveLength(10);
  });

  it('throws a readable error when Photon fails', async () => {
    respondWith([], false, 503);
    await expect(searchRestaurants('burger')).rejects.toThrow('Search failed (503)');
  });
});
