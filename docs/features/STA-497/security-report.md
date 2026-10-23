# Security Report: STA-497

REVIEWED: 2026-10-23 by `security-reviewer` (diff + touched files)
VERDICT: FINDINGS (1 MED, 1 LOW; no HIGH)

## Findings

- **[MED] A sign-out that cannot reach Supabase keeps the session on the phone.** auth-js returns before deleting the stored session when the revoke fails (offline, timeout, 5xx), and the app ignored the error. On a shared phone the next person was signed in as the employee who left. The refresh fix made this reliably reachable.
  - **Resolved:** `signOutThisDevice` (`src/lib/auth/sign-out.ts`) deletes the stored session when the revoke fails, unless someone signed in meanwhile. Failure report 06, `sign-out.test.ts`, runbook SES-06.
  - Web, showcase and admin have the same early return (cookies kept), but the user sees they are still signed in there. Not changed.
- **[LOW] Nothing can revoke a user's other sessions any more.** With every sign-out local, an owner who signs in with Google or Apple (no password to change) or the superadmin has no self-service way to end a stolen session.
  - **Not changed here.** Harry chose local sign-out with no "log out everywhere" action (2026-10-23). Raised with him as a possible follow-up: a "Sign out of all devices" action (`scope: "others"`) in web account settings and admin, allow-listed by the lint rule and the admin guard.

## Checked and sound

- The stored shop choice is only applied if it is one of the user's own memberships, and the backend checks membership on every scan.
- `scope: "local"` still revokes the current session on the server. The admin middleware still gates on a server-verified `getUser()` and `app_metadata.is_superadmin`.
- AES-256-CTR with a random 32-byte key and a fresh random 16-byte counter per write. The old and `v2` formats cannot be confused, and a malformed value reads as no session. There is no MAC, which was already the case.
- The removed startup expiry branch could not run on a phone with a correct clock (auth-js never returns an expired session).
- No secrets in the new logs or test fixtures.
