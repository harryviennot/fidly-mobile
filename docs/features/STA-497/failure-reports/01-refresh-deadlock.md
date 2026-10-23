CASE: SES-01 (case added by this issue; no runbook case covered a long-open scanner)
VERDICT: FAILED
SEVERITY: BLOCKER
RUN: code trace + regression test, 2026-10-23, scanner `dev` @ d74fd67, auth-js 2.101.1
SURFACE: scanner app, native builds (iOS + Android)
ACCOUNT: any signed-in employee

## Failed at

The scanner stays open (foreground) past the first background token refresh, then a scan is made.

## Expected

A scan works however long the scanner has been open. The access token refreshes in the background every ~hour and the employee never sees a sign-in prompt.

## Actual

- About 58 min after sign-in, the auto-refresh tick takes the auth lock and calls `_callRefreshToken`, which awaits every `onAuthStateChange` listener (`GoTrueClient.js:3882`, `:3914-3922`).
- The app's listener (`src/contexts/auth-context.tsx:227-240`) awaits `fetchAppUser()`, which runs `supabase.from("users")`. supabase-js attaches the token through `auth.getSession()` (`supabase-js/dist/index.cjs:523`), which queues behind the held lock (`GoTrueClient.js:2235-2251`, no timeout on that path). The refresh never completes, and every later auth call queues behind it.
- The module-level token cache (`src/lib/supabase.ts:108`) got the new token, so scans keep working for one more hour. After that every request gets a 401. `fetchCore.ts` calls `refreshSession()`, which is stuck in the same queue, times out after 8 s and throws "Not authenticated". The stamp screen shows "Your session has expired. Sign in again to keep scanning."
- Signing in again works (sign-in does not take the lock) but the jammed queue remains: the next refresh never runs, so it fails again an hour later. Killing and relaunching the app clears it.
- Tapping "Sign out" in a jammed app clears the screen, but `supabase.auth.signOut()` queues behind the lock too, so the stored tokens are never removed (fits STA-73's "logout button intermittently not working").

Also in this report: the startup check at `auth-context.tsx:196-208` calls `signOut({ scope: "local" })`, revoking the session on the server, whenever `expires_at` is in the past after `getSession()`. `getSession()` already refreshes within 90 s of expiry, so this fires only when the phone's clock runs more than an hour fast, and then on every launch.

## Evidence

- `src/lib/auth/auth-listener.test.ts` (this issue) reproduces it with a real supabase-js client, a fake `fetch` and in-memory storage: with the listener as written, `refreshSession()` never resolves.
- Field report STA-439 (DWICHBRO): "after the app stays open a long time scans fail; relaunch fixes it".

## State at time of failure

- Session: signed in, app in the foreground for more than ~2 h, or relaunched with an expired access token (the startup refresh runs inside the same lock).
- Relevant data: none specific; every account is affected.

## Aftermath

- RESET performed: none needed.
- Dependents skipped: none.

## Hypothesis (optional, clearly speculative)

This is the "app logs users out" complaint and STA-439's H2; both should stop once a build with the fix is installed.
