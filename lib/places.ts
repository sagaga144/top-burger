import { PlaceResult } from '../types';

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';

// Food-related OSM amenity values we want to include
const FOOD_AMENITY_VALUES = new Set([
  'restaurant', 'fast_food', 'cafe', 'bar', 'pub',
  'food_court', 'biergarten', 'ice_cream',
]);

interface PhotonFeature {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
    osm_type?: string;
    osm_id?: number;
    postcode?: string;
  };
  geometry: {
    coordinates: [number, number]; // [lon, lat]
  };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

function mapFeatureToPlaceResult(feature: PhotonFeature): PlaceResult {
  const p = feature.properties;

  // Build a stable ID from osm_type+osm_id if available, else coordinates
  const coords = feature.geometry.coordinates;
  const id = p.osm_type && p.osm_id
    ? `photon-${p.osm_type}-${p.osm_id}`
    : `photon-${coords[0].toFixed(5)}-${coords[1].toFixed(5)}`;

  const displayName = p.name ?? (p.city ?? p.country ?? 'Unknown');

  const addrParts: string[] = [];
  if (p.street) {
    addrParts.push(p.housenumber ? `${p.street} ${p.housenumber}` : p.street);
  }
  if (p.city) addrParts.push(p.city);
  if (p.country) addrParts.push(p.country);
  const formattedAddress = addrParts.length > 0 ? addrParts.join(', ') : displayName;

  return { id, displayName, formattedAddress } satisfies PlaceResult;
}

export async function searchRestaurants(
  textQuery: string,
  countryCode?: string,
  lang?: string
): Promise<PlaceResult[]> {
  if (!textQuery.trim()) return [];

  // When filtering by country, request more results so the client-side filter
  // has enough candidates. Photon does not support server-side country filtering
  // without lat/lon bias, so we over-fetch and filter client-side on countrycode.
  const fetchLimit = countryCode ? 40 : 20;
  const resolvedLang = lang ?? 'default';

  const params = new URLSearchParams({
    q: textQuery,
    limit: String(fetchLimit),
    lang: resolvedLang,
  });

  const response = await fetch(`${PHOTON_ENDPOINT}?${params}`, {
    headers: {
      'User-Agent': 'TopBurgerApp/1.0 (burger restaurant ratings)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Search failed (${response.status}). Please try again.`);
  }

  const data: PhotonResponse = await response.json();
  let features = data.features ?? [];

  // Apply country hard-filter when a countryCode is specified
  if (countryCode) {
    const upperCode = countryCode.toUpperCase();
    features = features.filter(
      (f) => (f.properties.countrycode ?? '').toUpperCase() === upperCode
    );
  }

  // Filter to food amenities; if none match, fall back to all results
  const foodFeatures = features.filter(
    (f) =>
      f.properties.osm_key === 'amenity' &&
      FOOD_AMENITY_VALUES.has(f.properties.osm_value ?? '')
  );
  const finalFeatures = foodFeatures.length > 0 ? foodFeatures : features;

  return finalFeatures.slice(0, 10).map(mapFeatureToPlaceResult);
}
