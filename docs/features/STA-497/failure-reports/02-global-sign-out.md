CASE: SES-02 (case added by this issue)
VERDICT: FAILED
SEVERITY: CORE
RUN: code trace, 2026-10-23, web/showcase/admin `dev`
SURFACE: dashboard (web), showcase, admin → scanner app
ACCOUNT: an owner who also scans on their phone, or a login shared across phones

## Failed at

Sign in to the scanner, then log out of the dashboard on a laptop with the same account.

## Expected

Logging out of one browser or device only ends that one session. The scanner phone stays signed in.

## Actual

These call `supabase.auth.signOut()` with no options. The default scope is `global` (`GoTrueClient.js:3141`), which revokes every refresh token the user has:

- `web/src/contexts/auth-provider.tsx:163` (the dashboard's Log out)
- `web/src/components/invite/InviteEmailNotice.tsx:34`, `web/src/components/invite/InviteAlreadyAccepted.tsx:31` ("switch account" on an invite)
- `showcase/lib/auth/use-has-session.ts:38`, `showcase/lib/supabase/auth-provider.tsx:252`
- `admin/src/middleware.ts:68` (a non-superadmin landing on the admin panel), `admin/src/components/admin-sidebar.tsx:88`

At its next refresh the scanner gets a non-retryable refresh error, supabase-js deletes the stored session, and the employee lands on the welcome screen.

## Evidence

Code trace only. Decision recorded on STA-497: local scope everywhere, no "log out everywhere" action (Harry, 2026-10-23).

## State at time of failure

- Session: the same account signed in on the scanner and in a browser.

## Aftermath

- RESET performed: none needed.

## Hypothesis (optional, clearly speculative)

Owners who scan themselves are probably the most frequent victims.
