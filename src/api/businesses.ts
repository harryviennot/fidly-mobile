import { apiFetch } from "./client";

export interface SignupQRResponse {
  qr_code: string;
  signup_url: string;
  business_name: string;
}

export async function getBusinessSignupQR(
  businessId: string
): Promise<SignupQRResponse> {
  return apiFetch<SignupQRResponse>(`/businesses/${businessId}/signup-qr`);
}
