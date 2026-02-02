import { apiFetch, getAuthHeaders, API_BASE_URL } from "./client";
import type { Customer, StampResponse } from "../types/api";

export async function getCustomer(businessId: string, customerId: string): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${businessId}/${customerId}`);
}

export async function addStamp(
  customerId: string,
  scannerId?: string
): Promise<StampResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/stamps/${customerId}`, {
    method: "POST",
    headers: {
      ...headers,
      ...(scannerId && { "X-Scanner-User-Id": scannerId }),
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Customer not found");
    }
    throw new Error("Failed to add stamp");
  }

  return response.json();
}

export async function redeemReward(
  customerId: string,
  scannerId?: string
): Promise<StampResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/stamps/${customerId}/redeem`, {
    method: "POST",
    headers: {
      ...headers,
      ...(scannerId && { "X-Scanner-User-Id": scannerId }),
    },
  });

  if (!response.ok) {
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
