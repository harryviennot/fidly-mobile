CASE: SES-06 (case added by this issue)
VERDICT: FAILED
SEVERITY: CORE
RUN: security review + regression test, 2026-10-23, scanner `fix/sta-497-scanner-session`
SURFACE: scanner app, native builds
ACCOUNT: two employees sharing one shop phone

## Failed at

Employee A taps Sign out while the phone has no connection (or the revoke call times out or gets a 5xx), then hands the phone over.

## Expected

The phone forgets A's session. The next person who opens the app sees the welcome screen and cannot act as A.

## Actual

auth-js `_signOut` (`GoTrueClient.js:3155-3165`) returns `{ error }` before `_removeSession()` when the revoke call fails with anything but 401/403/404. The app ignored that result (`auth-context.tsx`: `signOut({ scope: "local" }).catch(() => {})`), so only React state was cleared. The encrypted session stayed in storage, and the next cold start or auto-refresh signed A back in for whoever held the phone: A's shops, A's role, and every stamp booked to A.

Before the refresh fix this was worse, not better: a jammed auth lock meant sign-out never reached storage at all, online or not.

## Evidence

`src/lib/auth/sign-out.test.ts`: with the old behavior (revoke error ignored), the "offline" and "503" cases fail; a fresh client on the same storage still finds A's session.

## State at time of failure

- Session: A signed in; no network, or Supabase answering 5xx, at the moment of sign-out.

## Aftermath

- RESET performed: none needed.

## Fix

`signOutThisDevice` (`src/lib/auth/sign-out.ts`) deletes the stored session itself when the revoke fails, unless someone else signed in while it was failing (their session is kept). The session itself stays valid on the server until its refresh token is next used or revoked, but its only copy was on this phone.
