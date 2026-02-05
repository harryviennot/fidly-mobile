import { apiFetch, getAuthHeaders, API_BASE_URL } from "./client";
import type { Customer, StampResponse } from "../types/api";

export async function getCustomer(businessId: string, customerId: string): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${businessId}/${customerId}`);
}

export async function addStamp(
  businessId: string,
  customerId: string
): Promise<StampResponse> {
  const headers = getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/stamps/${businessId}/${customerId}`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Not authorized to add stamps");
    }
    if (response.status === 403) {
      throw new Error("You don't have access to this business");
    }
    if (response.status === 404) {
      throw new Error("Customer not found");
    }
    throw new Error("Failed to add stamp");
  }

  return response.json();
}

export async function redeemReward(
  businessId: string,
  customerId: string
): Promise<StampResponse> {
  const headers = getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/stamps/${businessId}/${customerId}/redeem`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Not authorized to redeem rewards");
    }
    if (response.status === 403) {
      throw new Error("You don't have access to this business");
    }
    if (response.status === 404) {
      throw new Error("Customer not found");
    }
    if (response.status === 400) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Customer not ready for reward");
    }
    throw new Error("Failed to redeem reward");
  }

  return response.json();
}
