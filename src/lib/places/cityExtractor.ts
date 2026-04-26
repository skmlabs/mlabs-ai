interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

/**
 * Extract city from Places API addressComponents array.
 * Hierarchy for Indian addresses:
 *   1. locality (e.g. "New Delhi")
 *   2. administrative_area_level_2 (e.g. "South Delhi")
 *   3. administrative_area_level_1 (e.g. "Delhi")
 * Returns null if none match.
 */
export function extractCity(components: AddressComponent[] | undefined): string | null {
  if (!components || components.length === 0) return null;

  const locality = components.find((c) => c.types.includes("locality"));
  if (locality) return locality.longText;

  const adminL2 = components.find((c) => c.types.includes("administrative_area_level_2"));
  if (adminL2) return adminL2.longText;

  const adminL1 = components.find((c) => c.types.includes("administrative_area_level_1"));
  if (adminL1) return adminL1.longText;

  return null;
}
