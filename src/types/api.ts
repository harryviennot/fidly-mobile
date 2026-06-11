export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string;
  stamps: number;
  /** Banked (earned, unredeemed) rewards — stackable rewards. */
  rewards?: number;
  /** Program config snapshot so the stamp screen can branch between the
   *  classic redeem/skip flow and the stackable stamp+redeem flow. */
  stackable_rewards?: boolean;
  max_stacked_rewards?: number | null;
  total_stamps?: number;
  pass_url?: string;
}

export interface StampResponse {
  customer_id: string;
  name: string;
  stamps: number;
  /** Banked rewards after the action. */
  rewards?: number;
  message: string;
}

export interface Business {
  id: string;
  name: string;
  url_slug: string;
  logo_url: string | null;
  subscription_tier: string;
  settings: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface Membership {
  id: string;
  user_id: string;
  business_id: string;
  role: "owner" | "admin" | "scanner";
  is_paused?: boolean;
  invited_by?: string;
  created_at?: string;
  updated_at?: string;
  last_active_at?: string;
  scans_count?: number;
  business?: Business;
}

export interface ScannerLocation {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  address?: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  is_primary: boolean;
}

export interface ScannableLocationsResponse {
  locations: ScannerLocation[];
  // True only on a Pro tier with >1 active location → the scanner MUST send a
  // location_id when stamping. Mirrors POST /stamps validation server-side.
  requires_location: boolean;
  scope: "all" | "assigned";
}

export interface LocationQRResponse {
  enrollment_url: string;
  qr_png_base64: string | null;
  location_id: string;
  location_slug: string;
  business_slug: string;
}

export interface CardDesign {
  id: string;
  business_id: string;
  name: string;
  is_active: boolean;
  total_stamps: number;
  // Color fields (RGB strings like "rgb(139, 90, 43)")
  background_color?: string;
  foreground_color?: string;
  label_color?: string;
  stamp_filled_color?: string;
  stamp_empty_color?: string;
  stamp_border_color?: string;
  // Icon configuration
  stamp_icon?: string;
  reward_icon?: string;
  icon_color?: string;
}
