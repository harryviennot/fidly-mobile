/** One reward on the program ladder (stamp checkpoint or points-priced item). */
export interface ProgramReward {
  id: string;
  /** Stamps to reach (stamp) or point price (points). */
  threshold: number;
  name: string;
  /** True when primary_value already reached this threshold. */
  reached: boolean;
}

/**
 * Type-aware view of an enrollment's standing (backend `ProgramSnapshot`,
 * attached to GET /customers by get_customer_info). The scanner reads this to
 * render the points keypad (rate + live preview) and the reward picker without
 * branching on the stamp-named `stamps` field.
 */
export interface ProgramSnapshot {
  type: "stamp" | "points";
  /** Stamp count OR points balance. */
  primary_value: number;
  /** "7 / 10" | "130 pts". */
  display: string;
  /** Can redeem ≥1 reward right now. */
  reward_ready: boolean;
  is_complete: boolean;
  /** Next reward target above primary_value, or null when all reached. */
  next_threshold: number | null;
  threshold_after: number | null;
  /** Points balance cap (config.max_balance), or null. */
  max_limit: number | null;
  /** Lifetime points total (points only), else null. */
  lifetime: number | null;
  /** Banked unredeemed rewards (stamps only). */
  rewards_banked: number;
  /** The ladder, sorted ascending — the redeem menu / milestone list. */
  rewards: ProgramReward[];
  /** Ticket-price → points rate (points only), for the live keypad preview. */
  points_per_currency_unit: number | null;
  /**
   * The merchant's per-customer earning cap standing for THIS customer, or
   * null when no cap is configured (or the plan isn't entitled). Lets the
   * screen pre-cap its stepper and explain a blocked scan before the employee
   * tries one.
   */
  earning_cap: EarningCapSnapshot | null;
}

/** Per-customer earning cap: what is left, and when it frees up. */
export interface EarningCapSnapshot {
  per_day: number | null;
  per_week: number | null;
  week_mode: "calendar" | "rolling";
  /** Which window is binding right now. */
  scope: "day" | "week";
  limit: number;
  earned: number;
  /** Stamps/points this customer may still earn. 0 = blocked. */
  remaining: number;
  /** ISO-8601 instant when the binding window rolls over. */
  resets_at: string;
}

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
  /** Type-aware snapshot (points balance, rewards ladder, rate). Present when
   *  the QR resolved to an enrollment with a program. */
  program?: ProgramSnapshot;
  pass_url?: string;
}

export interface StampResponse {
  customer_id: string;
  name: string;
  /** Legacy primary counter: stamp count OR points balance (== value_after). */
  stamps: number;
  /** Unambiguous type-aware primary value after the action. */
  value_after?: number;
  /**
   * Stamps/points this action actually credited. Not derivable from
   * `value_after`: a multi-stamp scan that rolls the card over ends BELOW where
   * it started. Drives the "N stamps added" copy + the staggered dot animation.
   */
  delta?: number;
  program_type?: "stamp" | "points";
  /** Banked rewards after the action. */
  rewards?: number;
  message: string;
  transaction_id?: string;
  location_id?: string | null;
  location_name?: string | null;
  /**
   * True when the per-customer earning cap is what held this scan back, so the
   * screen says "2 of 5 added" instead of a plain, misleading success.
   */
  cap_applied?: boolean;
  cap_scope?: "day" | "week";
  /** What the scan would have credited with no cap in play. */
  cap_requested?: number;
  cap_remaining?: number;
  cap_resets_at?: string;
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
  /** Program type signal — lets the scanner route to the points keypad
   *  instantly (the active design is cached per-business). */
  card_type?: "stamp" | "points";
  /** Ticket-price → points rate, set on the active-design response for points
   *  programs. Optional convenience for an instant preview before the
   *  per-customer snapshot lands. */
  points_per_currency_unit?: number | null;
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
