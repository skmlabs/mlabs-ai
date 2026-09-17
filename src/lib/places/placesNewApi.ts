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
  primaryTypeDisplayName?: { text: string; languageCode?: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
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
  "primaryTypeDisplayName",
  "googleMapsUri",
  // Contact fields — Enterprise SKU on Place Details. Fetched once per
  // competitor on add and refreshed weekly by the sync cron, so the cost is
  // per-competitor, not per-keystroke.
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
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
    `${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}`,
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

  // Places API (New) returns reviews ordered by relevance and ignores reviews_sort
  // (the v1 endpoint 400s on that query param). Sort client-side, newest first.
  const data = await res.json() as PlaceDetails;
  if (data.reviews && data.reviews.length > 0) {
    data.reviews.sort((a, b) =>
      new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime(),
    );
  }
  return data;
}

// ----------------------------------------------------------------------------
// Extended search used by the competitor search page. Returns one page of up
// to 20 results with a richer field mask (display name + maps URI), plus a
// nextPageToken so the UI can pull further pages on demand. Text Search (New)
// serves a maximum of 60 results across 3 pages.
// ----------------------------------------------------------------------------

export interface PlaceSearchResultExtended extends PlaceSearchResult {
  primaryTypeDisplayName?: { text: string };
  googleMapsUri?: string;
  /** Only populated when the caller opts in via `includeWebsite` (see below). */
  websiteUri?: string;
}

export interface CompetitorSearchOptions {
  /**
   * Adds `places.websiteUri` to the field mask so the "has a website /
   * no website" filter can be applied. This upgrades the Text Search call
   * from the Pro SKU to Enterprise, so it is opt-in: the UI only sets it
   * when the user actually picks a website filter.
   */
  includeWebsite?: boolean;
  /** Places caps this at 20 per page. */
  pageSize?: number;
  /**
   * `nextPageToken` from a previous call. Text Search (New) serves at most
   * 60 results across 3 pages, and every page is a separately billed
   * request — hence the explicit "Load more" in the UI rather than
   * auto-paging.
   *
   * Google requires the rest of the request to be identical when a
   * pageToken is supplied, so callers must pass the same query/bias/type.
   */
  pageToken?: string;
  /**
   * A Places "Table A" type (e.g. `dental_clinic`, `gym`) used as the
   * category filter. Filtering server-side beats keyword-matching because
   * Google resolves it against the place's own primary type.
   */
  includedType?: string;
}

export interface CompetitorSearchPage {
  places: PlaceSearchResultExtended[];
  nextPageToken?: string;
}

interface SearchTextBodyExtended extends SearchTextBody {
  // `maxResultCount` is deprecated in favour of `pageSize`; if both are sent
  // Google ignores maxResultCount.
  pageSize?: number;
  pageToken?: string;
  includedType?: string;
}

const SEARCH_FIELD_MASK_EXTENDED = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.googleMapsUri",
].join(",");

export async function searchPlacesForCompetitor(
  query: string,
  locationBias?: { lat: number; lng: number; radiusMeters?: number },
  options: CompetitorSearchOptions = {},
): Promise<CompetitorSearchPage> {
  const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 20);
  const body: SearchTextBodyExtended = { textQuery: query, pageSize };
  if (options.pageToken) body.pageToken = options.pageToken;
  if (options.includedType) body.includedType = options.includedType;
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
      // `nextPageToken` is a top-level field, not a `places.*` one — it has
      // to be in the mask explicitly or Google omits it and pagination
      // silently stops after the first page.
      "X-Goog-FieldMask": options.includeWebsite
        ? `${SEARCH_FIELD_MASK_EXTENDED},places.websiteUri,nextPageToken`
        : `${SEARCH_FIELD_MASK_EXTENDED},nextPageToken`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Places searchText failed: ${res.status} ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as {
    places?: PlaceSearchResultExtended[];
    nextPageToken?: string;
  };
  return { places: data.places ?? [], nextPageToken: data.nextPageToken };
}
