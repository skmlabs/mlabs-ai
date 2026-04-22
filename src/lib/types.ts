export type DataStatus = "ok" | "pending_api_access" | "never" | "error";

export type DailyMetricRow = {
  metric_date: string;
  calls: number;
  direction_requests: number;
  website_clicks: number;
  business_impressions_desktop_maps: number;
  business_impressions_desktop_search: number;
  business_impressions_mobile_maps: number;
  business_impressions_mobile_search: number;
};

export type LocationRow = {
  id: string;
  title: string;
  address: string | null;
  place_id: string | null;
  is_active: boolean;
  connected_account_id: string;
  location_resource_name: string;
  primary_phone: string | null;
  website_uri: string | null;
};

export type ReviewRow = {
  id: string;
  location_id: string;
  author_name: string | null;
  author_photo_url: string | null;
  rating: number | null;
  text: string | null;
  publish_time: string | null;
};

export type ReviewStat = {
  location_id: string;
  average_rating: number | null;
  total_reviews: number;
  last_fetched_at: string | null;
};
