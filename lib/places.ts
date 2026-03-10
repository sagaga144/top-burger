import { PlaceResult } from '../types';

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

export async function searchRestaurantsInIsrael(
  textQuery: string
): Promise<PlaceResult[]> {
  if (!textQuery.trim()) return [];

  const response = await fetch(PLACES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({
      textQuery,
      includedType: 'restaurant',
      regionCode: 'il',
      pageSize: 10,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Places API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (!data.places || !Array.isArray(data.places)) {
    return [];
  }

  return data.places.map(
    (place: { id: string; displayName: { text: string }; formattedAddress: string }) => ({
      id: place.id,
      displayName: place.displayName?.text ?? 'Unknown',
      formattedAddress: place.formattedAddress ?? '',
    })
  );
}
