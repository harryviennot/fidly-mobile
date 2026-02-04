export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string;
  stamps: number;
  pass_url?: string;
}

export interface StampResponse {
  customer_id: string;
  name: string;
  stamps: number;
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
  invited_by?: string;
  created_at?: string;
  updated_at?: string;
  last_active_at?: string;
  scans_count?: number;
  business?: Business;
}

export interface CardDesign {
  id: string;
  business_id: string;
  name: string;
  is_active: boolean;
  total_stamps: number;
}
