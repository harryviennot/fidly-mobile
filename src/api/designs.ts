import { API_BASE_URL } from "./client";

export interface CardDesign {
  id: string;
  business_id: string;
  name: string;
  total_stamps: number;
  is_active: boolean;
}

export async function getActiveDesign(businessId: string): Promise<CardDesign | null> {
  // Active design endpoint is public for pass generation
  const response = await fetch(`${API_BASE_URL}/designs/${businessId}/active`);

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data || null;
}
