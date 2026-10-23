BRANCH: fix/sta-497-scanner-session (scanner-app) + fix/sta-497-local-signout (web, showcase, admin)
SCOPES: scanner-app, web, showcase, admin
ENVIRONMENT: dev only. No migration. SES-01 temporarily lowers the access-token expiry on the DEV Supabase project.

# Scanner Session Test Pass

Covers whether an employee stays signed in to the scanner: across token refreshes, after logging out somewhere else, across relaunches, and on access errors that are not about the session. Work top to bottom. SES-01 is the one that matters most and the slowest (about 15 minutes of waiting), so start it first and run SES-03 and SES-04 on a second device while it waits.

---

## SETUP: Before you start

Everything below runs against dev. Nothing touches production. A native dev build is required for SES-01, SES-03 and SES-05: the web scanner keeps its session in cookies and does not use the code these cases protect.

### Where things live

| Surface | URL / Command | Notes |
|---|---|---|
| Scanner app (native) | `cd scanner-app && npm run ios:dev` or `npm run android:dev` | Dev build on a real phone. Metro prints `[Auth] event=…` lines; SES-01 reads them. |
| Dashboard | `https://app.dev.stampeo.app` | Built from web `dev`, or run the web worktree with `bun run publicdev`. |
| Supabase dev | dashboard of project `ysdpjxzldqwlmhlwzdaq` | Only SES-01 changes a setting here (R1). |

### Accounts

All accounts are dev fixtures seeded by `backend/scripts/reset_dev_fixtures.py`. Staff use the password `StampeoSeed!2026`.

| Use for | Account | Business / State |
|---|---|---|
| A one-shop scanner | `lea@patoune.seed.stampeo.app` | Scanner on Patoune (Starter, stamps). SES-01, SES-04. |
| A multi-shop user | the dev fixture owner (the script's `--owner`, a member of all six seeded shops; Harry signs in) | SES-02, SES-03. |

### Reset recipes

**R1: Short access tokens** (SES-01 only)

In the dev Supabase dashboard, set the access-token (JWT) expiry to `300` seconds. **Afterwards set it back to `3600`.** Every dev session is affected while it is lowered, so tell anyone testing dev.

**R2: Put Léa back on Patoune** (after SES-04)

```bash
docker exec fidelity-backend-1 python scripts/reset_dev_fixtures.py seed --only patoune --no-strips --yes
```

Or invite `lea@patoune.seed.stampeo.app` again from Patoune's Team page and accept as Léa.

**R3: Fresh install** (when a case leaves the phone in a state you can't read)

Delete the app from the phone and reinstall the dev build. That clears the stored session and the stored shop.

### Known state before you start

- **New runbook:** these cases are new with STA-497. The causes were traced in code and covered by unit tests (`src/lib/auth/*.test.ts`, `src/contexts/business-selection.test.ts`, `src/utils/apiErrors.test.ts`); none has been run on a device yet. The React providers themselves (`auth-context`, `business-context`) have no component tests in this repo, so SES-03 and SES-06 are the only proof of their wiring.
- **iOS release:** the field reports (STA-439, DWICHBRO) are on iOS. A pass on Android does not prove the iOS store build has the fix; check App Store Connect shows the release live before closing STA-439.
- **Known gap (offline):** SES-05 records today's offline cold-start behavior. It is expected to fail until the offline scanner work; it is EDGE and must not block the release.

---

## SES: Staying signed in

Run SES-01 first. If it fails, the main fix did not work and the rest of the pass is secondary.

### SES-01: Scans keep working across token refreshes [BLOCKER]

| Field | Content |
|---|---|
| WHY | The scanner used to jam its own auth client at the first background token refresh; about an hour later every scan said the session had expired, and only a relaunch helped. This proves the app refreshes again and again while it stays open. |
| DEPENDS | none |
| ACCOUNT | `lea@patoune.seed.stampeo.app` |
| STEPS | 1. Apply R1 (300 s tokens). 2. Sign in to the native dev build as Léa and open the camera on Patoune. 3. Keep the app in the foreground with the screen awake (Settings → Display → Auto-Lock: Never, or keep tapping) for 12 minutes. 4. Scan a Patoune customer's card and add a stamp. 5. Watch the Metro log during the wait. |
| EXPECT | The stamp goes through. Metro shows `[Auth] event=TOKEN_REFRESHED` roughly every 5 minutes (at least twice). You do NOT see "Your session has expired. Sign in again to keep scanning." You do NOT land on the welcome screen. |
| RESET | Set the JWT expiry back to 3600 (R1). |

### SES-02: Logging out of the dashboard leaves the scanner signed in [CORE]

| Field | Content |
|---|---|
| WHY | Dashboard, showcase and admin sign-outs used the global scope, which revoked the same account's scanner sessions on every phone. Owners who scan themselves, and teams sharing one login, were sent back to the welcome screen. |
| DEPENDS | SES-01 (refreshes work; a revoked session only shows at its next refresh) |
| ACCOUNT | the dev fixture owner |
| STEPS | 1. With R1 applied (300 s tokens), sign in to the scanner as the owner and pick any shop. 2. On a laptop, sign in to `app.dev.stampeo.app` with the same account. 3. Log out of the dashboard (profile menu → Log out). 4. Keep the scanner open in the foreground for 6 minutes, so it refreshes its token at least once. 5. Scan a card. |
| EXPECT | The scan works and the scanner is still on the lobby. The dashboard tab is signed out. You do NOT see the scanner's welcome or sign-in screen. |
| RESET | Set the JWT expiry back to 3600 (R1) once SES-01 to SES-05 are done. |

### SES-03: A multi-shop user keeps their shop after a relaunch [CORE]

| Field | Content |
|---|---|
| WHY | The stored shop was wiped on every cold start, so people on several shops landed on the shop picker each time they opened the app, which felt like being logged out. |
| DEPENDS | none |
| ACCOUNT | the dev fixture owner (member of six shops) |
| STEPS | 1. Sign in to the native dev build. 2. On the shop picker, pick Lustre (any shop that is not first in the list). 3. Kill the app from the app switcher. 4. Relaunch it. |
| EXPECT | The app opens on Lustre's lobby. You do NOT see the shop picker. Then sign out from the lobby and sign in again: this time the shop picker appears (signing out forgets the shop). |
| RESET | None. |

### SES-04: A removed team member is told they have no access, not that their session expired [EDGE]

| Field | Content |
|---|---|
| WHY | Opening a scanned card mapped a 403 to "Your session has expired". The backend sends 403 when the employee is no longer on the team, has the wrong role, or the business is inactive. Signing in again fixes none of those. |
| DEPENDS | none |
| ACCOUNT | `lea@patoune.seed.stampeo.app` on the phone; the dev fixture owner on the dashboard |
| STEPS | 1. Sign in to the scanner as Léa on Patoune and leave it on the camera. 2. As the owner, remove Léa from Patoune's Team page on the dashboard. 3. On the phone, scan a Patoune customer's card. |
| EXPECT | The error screen says "You do not have access to this business. Ask the owner to check your invitation." (fr: "Vous n'avez pas accès à ce commerce…"). You do NOT see "Your session has expired". |
| RESET | R2. |

### SES-05: Opening the scanner with no connection [EDGE, known gap]

| Field | Content |
|---|---|
| WHY | Records today's behavior for the offline scanner work. With no network and an expired access token, supabase-js reports no session even though the refresh token is still stored, so the app shows the welcome screen. The fix belongs to the offline scanner, not to STA-497. |
| DEPENDS | SES-01 (a signed-in session exists) |
| ACCOUNT | `lea@patoune.seed.stampeo.app` |
| STEPS | 1. With R1 still applied, sign in as Léa, then background the app for 6 minutes (longer than the token). 2. Turn on airplane mode. 3. Kill and relaunch the app. 4. Note what you see. 5. Turn airplane mode off and kill and relaunch again. |
| EXPECT | Known gap: step 4 shows the welcome screen. After step 5 the app opens signed in on Patoune's lobby without typing a password (the stored session survived). You do NOT see the scanner asking for a password at step 5. |
| RESET | Set the JWT expiry back to 3600 (R1). |

### SES-06: Signing out with no connection still signs out of the phone [CORE]

| Field | Content |
|---|---|
| WHY | On a shared shop phone, a sign-out that could not reach Supabase used to keep the session in storage, so the next person to open the app was silently signed in as the employee who left. |
| DEPENDS | none |
| ACCOUNT | `lea@patoune.seed.stampeo.app` |
| STEPS | 1. Sign in to the native dev build as Léa and open Patoune's lobby. 2. Turn on airplane mode. 3. Sign out from the lobby and confirm. 4. Kill the app. 5. Turn airplane mode off. 6. Relaunch the app. |
| EXPECT | Step 3 lands on the welcome screen. After step 6 the app is still on the welcome screen, signed out. You do NOT see Patoune's lobby or Léa's name anywhere. |
| RESET | None. |

---

## Execution rules (for the testing agent)

1. **Order.** Setup first. Then SES-01, then the rest; SES-03 and SES-04 can run on a second device while SES-01 waits. Keep R1 applied until SES-05 is done, then restore 3600 once.
2. **On BLOCKER failure:** write a failure report and stop: the main fix did not work.
3. **On CORE failure:** write a failure report, skip only its dependents, continue the run.
4. **On EDGE failure:** write a failure report, continue. SES-05 step 4 showing the welcome screen is the expected result, not a failure.
5. **On ambiguity:** consult WHY. If still ambiguous, report it as AMBIGUOUS with what you saw, so the runbook gets fixed.
6. **After any failure:** run the case's RESET before retrying or moving on.
7. **Reporting:** one failure report per failed case, using failure-report-template.md, filed in `docs/features/STA-497/failure-reports/` and as a comment on STA-497. Reference cases only by ID.
8. **Re-runs after fixes:** re-run the failed case and its dependents. Nothing else.
