import { searchPlacesByText } from "./placesNewApi";

/**
 * Find Places API place_id for an owned GMB location using its name + address.
 * Used on first sync to bridge GMB-stored data to Places API.
 * Returns place_id of the top match or null if no match.
 */
export async function findPlaceIdForLocation(
  locationName: string,
  address: string,
): Promise<string | null> {
  const query = `${locationName} ${address}`.trim();
  if (!query) return null;
  try {
    const results = await searchPlacesByText(query);
    return results[0]?.id ?? null;
  } catch (e) {
    console.error("reverseLookup failed:", e);
    return null;
  }
}
