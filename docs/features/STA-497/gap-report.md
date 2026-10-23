# Gap Report: STA-497

AUDITED: 2026-10-23 by `coverage-auditor` (fresh context: failure reports, diff, tests)
VERDICT: DRIFT + GAPS FOUND. Closed below, except three items that need a waiver.

## Closed

| Gap / drift | Resolution |
|---|---|
| R01 cold start with an expired stored session never ran the init-lock refresh | `auth-listener.test.ts` "refreshes the stored session at launch instead of signing out": pre-populated expired session, both app listeners, `autoRefreshToken: true`. Fails (deadlock) with the old listener. |
| `supabase.ts` token-cache listener untested | Moved into `trackAccessToken` (`lib/auth/auth-listener.ts`); every listener test registers it and checks it holds the newest token. |
| Fake GoTrue accepted a reused refresh token | `fake-supabase.ts` refuses a refresh token used twice (`refresh_token_already_used`). |
| No test for a 401 retry racing the auto-refresh | "survives a 401 retry and the auto-refresh asking for a new token at once". |
| Sign-out test's assertions held vacuously | Moved to `sign-out.test.ts`; `signedInPhone` asserts the session is in storage under the wiped key before signing out. |
| R05: an implementation writing the key on every rewrite would pass | "rewrites a session with a single data write, never touching the key" counts key-store writes. |
| Counter-reuse test compared the random prefix | Compares the ciphertext bodies of the same plaintext. |
| Damaged `v2:` values untested | "reads %s as no session rather than crashing" (cut-off value, value with no ciphertext). |
| `business-context` wiring (read-before-update, argument order) untested | The previous/current tracking is `createSelectionOwner` (`business-selection.ts`); tests replay render sequences, including A → nobody → B and a dead session at cold start. |
| R02 checks only rejected a zero-argument call | web/showcase/scanner lint selector rejects any `auth.signOut(...)` without `scope: "local"`; admin guard does the same by regex. |
| Lint rule never proven to fire | `sign-out-scope.test.ts` in web, showcase and scanner runs ESLint on probes (6 rejected shapes, 2 accepted). With the old narrow selector 4 cases fail. |
| Admin guard passed on an empty scan | Asserts `src/middleware.ts` is in the scanned set. |
| Scanner's own sign-out had no scope guard | Same lint rule in `scanner-app/eslint.config.js`. |
| Drift: `appUser` removed; startup branch's `clearPendingJoinCode()`; shop forgotten on A → B; one-way `v2` format | Recorded in the Fix sections of failure reports 01, 03 and 05. |

## Open, need a waiver from Harry

1. **R03 restore through `BusinessProvider`** (two shops, B stored, relaunch opens B). Only the pure pieces are tested: the scanner has no React component test runner (jest-expo not set up). Covered on device by SES-03.
2. **`auth-context` wiring**: the provider calling `signOutOfThisDevice()` and no longer running the startup expiry check. Same reason; covered by SES-06 and SES-01.
3. **`encrypted-store` `removeItem` error branch**: a failed data removal skips the key delete and is only logged. Low risk; no test.

## Waivers

(filled only with Harry's explicit waiver)
