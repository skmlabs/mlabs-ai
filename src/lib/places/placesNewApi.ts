// Places API (New) — interim data source while GMB v4 propagation completes.
// Uses field masks to keep response payloads small and quota cost predictable.

const PLACES_API_BASE = "https://places.googleapis.com/v1";

interface PlacesReview {
  name: string;
  relativePublishTimeDescription: string;
  rating: number;
  text?: { text: string; languageCode: string };
  authorAttribution?: {
    displayName: string;
    photoUri?: string;
  };
  publishTime: string;
}

interface PlacesAddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

export interface PlaceDetails {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  addressComponents: PlacesAddressComponent[];
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  reviews?: PlacesReview[];
  types?: string[];
  googleMapsUri?: string;
  primaryType?: string;
}

export interface PlaceSearchResult {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
}

interface SearchTextBody {
  textQuery: string;
  locationBias?: {
    circle: {
      center: { latitude: number; longitude: number };
      radius: number;
    };
  };
}

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "rating",
  "userRatingCount",
  "reviews",
  "types",
  "primaryType",
  "googleMapsUri",
].join(",");

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.primaryType",
].join(",");

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY not configured");
  return key;
}

export async function searchPlacesByText(
  query: string,
  locationBias?: { lat: number; lng: number; radiusMeters?: number },
): Promise<PlaceSearchResult[]> {
  const body: SearchTextBody = { textQuery: query };
  if (locationBias) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.lat, longitude: locationBias.lng },
        radius: locationBias.radiusMeters ?? 50000,
      },
    };
  }

  const res = await fetch(`${PLACES_API_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Places searchText failed: ${res.status} ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as { places?: PlaceSearchResult[] };
  return data.places ?? [];
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const res = await fetch(
    `${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}?reviews_sort=newest`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": getApiKey(),
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Places details failed: ${res.status} ${errText.slice(0, 300)}`);
  }

  return await res.json() as PlaceDetails;
}
