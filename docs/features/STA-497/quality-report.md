# Quality Report: STA-497

REVIEWED: 2026-10-23 by `code-quality-reviewer` (fresh context, diff + touched files only)
DIFF: scanner-app d74fd67..e2d1271; web cc26982, showcase 4431bcd, admin 4fee6d5 (`fix/sta-497-local-signout`)
VERDICT: FINDINGS (all minor), all resolved below.

## Findings and resolution

| # | Finding | Resolution |
|---|---|---|
| 1 | `auth-listener.test.ts`: "two in a row is what a shift-long session goes through" contradicts the hourly fake. | Comment now says the second refresh only runs if the first released the lock. |
| 2 | `business-context.tsx`: "Clear business when user logs out" sat above the ref, and the effect also forgets the shop when the user changes. | Moved above the effect: "Reset on sign-out; drop the stored shop when its user leaves or changes." |
| 3 | `encrypted-store.ts`: one docstring described both store interfaces. | One line per interface. |
| 4 | `encrypted-store.ts`: logs tagged `LargeSecureStore.*` from the encryption module, the same tag the web branch uses. | Tagged `[encrypted-store] …`. Failure report 05 lists both tags for Sentry searches. |
| 5 | `large-secure-store.ts`: three method JSDocs repeated the names; "both stores" wrong on web. | Deleted. |
| 6 | `large-secure-store.ts`: "Encrypted storage adapter" not true on web. | "Supabase auth storage: encrypted on device, plain localStorage on web." |
| 7 | `apiErrors.test.ts`: comment duplicated the code comment and the case label. | Deleted from the test. |
| 8 | admin `src/test/` at the ~30-file threshold. | Guard moved to `src/utils/supabase/sign-out-scope.test.ts`, next to the clients; still scans all 534 source files. |
| 9 | `auth-listener.test.ts`: dead `/rest/v1/users` stub; `signedInScanner()` did not sign in; module-level counter reset in `beforeEach`. | Stub deleted; the helper is async and signs in; the counter lives in the fake's closure. |
| 10 | Legacy (counter 1) decrypt branch is a format-compatibility path. | Noted in the PR description: droppable once installed builds have rewritten their session (every refresh rewrites it in `v2`). |

File size, folder tree (scanner), flag-gated paths: none found. Optional, not done: `lib/auth-errors.ts` could move into `lib/auth/` in a later tidy.
