import { apiFetch } from "./client";
import type { Membership } from "../types/api";

export async function getUserMemberships(userId: string): Promise<Membership[]> {
  return apiFetch<Membership[]>(`/memberships/user/${userId}`);
}

export async function getBusinessMembers(
  businessId: string
): Promise<Membership[]> {
  return apiFetch<Membership[]>(`/memberships/business/${businessId}`);
}
