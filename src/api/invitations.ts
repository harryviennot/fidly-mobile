import { apiFetch } from "./client";
import { normalizeJoinCode } from "../lib/join-code";

/** What the app shows before asking someone to commit: "Join Café Lumière?" */
export interface JoinCodePreview {
  business_name: string;
  business_logo_url: string | null;
  business_accent_color: string | null;
  role: string;
  invitee_name: string | null;
  inviter_name: string;
  expires_at: string;
}

export interface JoinCodeRedeemResult {
  business_id: string;
  business_name: string;
  role: string;
  /** Lets the app open the matching onboarding without a second round trip. */
  program_type: "stamp" | "points" | null;
}

export interface JoinCodeCheck {
  usable: boolean;
  /** Why not, as the same error codes redemption uses. Null when usable. */
  reason: string | null;
}

/**
 * Is this code worth creating an account for?
 *
 * The only join endpoint that answers without a session, and it says nothing
 * about which business the code belongs to. It exists because everything else
 * needs a session, which put the account before the answer: a signed-out
 * employee who mistyped one character created an account and verified their
 * email before hearing the code was wrong.
 */
export async function checkJoinCode(code: string): Promise<JoinCodeCheck> {
  return apiFetch<JoinCodeCheck>(
    `/invitations/code/${encodeURIComponent(normalizeJoinCode(code))}/check`
  );
}

/**
 * Look up a code without spending it. Requires a session: the code is a short
 * guessable credential, so the endpoint is authenticated and rate-limited.
 */
export async function previewJoinCode(code: string): Promise<JoinCodePreview> {
  return apiFetch<JoinCodePreview>(
    `/invitations/code/${encodeURIComponent(normalizeJoinCode(code))}/preview`
  );
}

/** Spend the code: creates the membership and marks the invitation accepted. */
export async function redeemJoinCode(code: string): Promise<JoinCodeRedeemResult> {
  return apiFetch<JoinCodeRedeemResult>(
    `/invitations/code/${encodeURIComponent(normalizeJoinCode(code))}/redeem`,
    { method: "POST" }
  );
}
