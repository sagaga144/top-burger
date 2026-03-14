import { PlaceResult } from '../types';

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

// Food-related OSM types we want to include
const FOOD_TYPES = new Set([
  'restaurant', 'fast_food', 'cafe', 'bar', 'pub',
  'food_court', 'biergarten', 'ice_cream',
]);

interface NominatimResult {
  osm_type: string;
  osm_id: number;
  display_name: string;
  name: string;
  type: string;
  class: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
  };
}

export async function searchRestaurantsInIsrael(
  textQuery: string
): Promise<PlaceResult[]> {
  if (!textQuery.trim()) return [];

  const params = new URLSearchParams({
    q: textQuery,
    format: 'json',
    countrycodes: 'il',
    limit: '20',
    addressdetails: '1',
    'accept-language': 'en',
  });

  const response = await fetch(`${NOMINATIM_ENDPOINT}?${params}`, {
    headers: {
      'User-Agent': 'TopBurgerApp/1.0 (burger restaurant ratings)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Search failed (${response.status}). Please try again.`);
  }

  const data: NominatimResult[] = await response.json();

  // Filter to food places; if none match, return all results (user may search by name only)
  const foodResults = data.filter(
    (r) => FOOD_TYPES.has(r.type) || r.class === 'amenity'
  );
  const results = foodResults.length > 0 ? foodResults : data;

  return results.slice(0, 10).map((item) => {
    const addr = item.address ?? {};
    const parts: string[] = [];
    if (addr.road) {
      parts.push(addr.house_number ? `${addr.road} ${addr.house_number}` : addr.road);
    }
    const city = addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? '';
    if (city) parts.push(city);

    const displayName = item.name || item.display_name.split(',')[0].trim();
    const formattedAddress = parts.length > 0 ? parts.join(', ') : 'Israel';

    return {
      id: `osm-${item.osm_type}-${item.osm_id}`,
      displayName,
      formattedAddress,
    } satisfies PlaceResult;
  });
}
