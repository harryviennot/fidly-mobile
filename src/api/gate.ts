import { apiFetch } from "./client";

export interface AppGateResponse {
  update_required: boolean;
  store_url: string | null;
  min_version: string | null;
  current_version: string | null;
}

/**
 * Force-update check. Unauthenticated — the installed version + platform ride
 * along as the X-App-Version / X-Client-Platform headers injected by apiFetch,
 * so this works before (and without) a logged-in session.
 *
 * The backend owns the comparison; the caller just reads `update_required`.
 */
export async function fetchAppGate(): Promise<AppGateResponse> {
  return apiFetch<AppGateResponse>("/public/app-gate");
}
