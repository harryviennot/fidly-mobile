# Google Sign-In fails on the native app (works on the web scanner)

Investigation + fix plan. Scope: `fidly-mobile` (Stampeo scanner), Supabase prod
project `rygjkpuiyinekdwmsont`, Google Cloud project `697360742144`.

## 1. Why web works and native does not

They are two completely different flows. That is the whole story.

**Web (`scan.stampeo.app`) uses the browser redirect flow.**
`signInWithProvider` falls through to `supabase.auth.signInWithOAuth()`
(`src/contexts/auth-context.tsx:275-284`), the browser goes to Supabase
`/authorize`, Supabase redirects to Google, Google comes back to Supabase
`/callback`, and the app exchanges the PKCE code in `login.tsx:100-153`.
The only Google credential involved is the **web OAuth client configured inside
Supabase**. The app never talks to Google directly.

Confirmed in prod auth logs, e.g. a `pkce` / provider `google` login with
`referer: https://scan.stampeo.app/login` succeeding at 09:52 today.

**Native (iOS / Android) uses the Google SDK + ID-token exchange.**
`src/contexts/auth-context.tsx:237-270` calls `GoogleSignin.signIn()`, takes
`result.data.idToken`, and posts it to `supabase.auth.signInWithIdToken()`.
This path depends on Google credentials that live in **`app.config.ts`, not in
Supabase**, plus a Google Cloud client registration per platform. None of the
web configuration helps it.

So a break in the native path is invisible to the web scanner, which is exactly
the symptom reported.

## 2. What the evidence says

Searched 24h of prod `auth_logs` for `grant_type = id_token` failures:
**zero**. There are successful google `id_token` logins (from the customer app,
which has its own working native setup) and successful apple `id_token` logins,
but not a single rejected Google ID token.

That is the important finding. If Supabase were rejecting the scanner's tokens
we would see 400s on `/token`. We see nothing, which means **the failure happens
on-device, before any request reaches Supabase**: `GoogleSignin.signIn()` is
throwing, and the `catch` at `auth-context.tsx:262-270` converts it into the
generic `errors.oauthFailed` toast (`AuthMethodChooser.tsx:38`). The real error
code is written to `console.log` only, so it is invisible in a release build.

## 3. Root causes, ranked

### A. Android has no Google OAuth client registered (most likely)

`app.config.ts:9-21` defines three **iOS** client IDs plus one **web** client ID.
There is no `google-services.json` in the repo and no Android client anywhere.

Android native sign-in does not read a client ID from JS. It resolves the caller
by looking up an **OAuth client of type "Android"** in the Google Cloud project
whose *package name* and *SHA-1 certificate fingerprint* match the installed
APK. If that client is missing or the SHA-1 does not match, the SDK throws
`DEVELOPER_ERROR` (`statusCodes.DEVELOPER_ERROR`, code 10) with no useful
message, before any network call. That matches the log evidence exactly.

With EAS + Google Play App Signing there are normally **two** fingerprints that
both need registering:
- the EAS **upload key** SHA-1 (`eas credentials -p android`), which signs
  internal/preview builds, and
- the **Play app signing key** SHA-1 (Play Console > Test and release > App
  integrity), which signs whatever users actually install.

Registering only one produces the classic "works on my internal build, broken
from the Play Store" pattern.

And there are three package names to cover: `com.hryvnt.stampeo.dev`,
`com.hryvnt.stampeo.preview`, `com.hryvnt.stampeo` (`app.config.ts:23-33`).

### B. iOS ID-token audience not authorized in Supabase (second most likely)

On iOS, the ID token Google returns is minted for the **iOS** client ID, so its
`aud` claim is `<ios-client>.apps.googleusercontent.com`, not the web client ID.
Supabase only accepts an ID token whose `aud` is in the Google provider's
**Authorized Client IDs** list. If the scanner's three iOS client IDs are not in
that list, `signInWithIdToken` returns 400 `Unacceptable audience in id_token`.

The prod list is not empty (the customer app's native Google logins succeed), so
this is about whether the *scanner's* iOS client IDs were added when
commit `30cf9eb` introduced native OAuth in April. Worth verifying even though
cause A explains the Android half.

Also verify each iOS client's registered **bundle ID** matches its variant, and
that the reversed URL scheme (`app.config.ts:128`) is present in the built
`Info.plist` (it will be, since the plugin generates it, but check after a
prebuild).

### C. Code-level defects found while reading the flow

These do not by themselves explain a hard failure, but they hide it and cause
their own bugs.

1. **Cancellation is mishandled.** `@react-native-google-signin/google-signin`
   v13+ returns `{ type: "cancelled", data: null }` from `signIn()` instead of
   always throwing. `auth-context.tsx:243-248` only checks the thrown-error path,
   so a user who taps "cancel" falls into `if (!idToken)` and gets a
   "sign-in failed" error toast. This alone could be what "doesn't work
   properly" means to a tester on iOS.
2. **No `access_token` sent with the ID token.** Supabase already logs a warning
   on every one of these calls: *"ID token has a at_hash claim, but no
   access_token parameter was provided. In future versions, access_token will be
   mandatory."* This is a scheduled breakage.
3. **`hasPlayServices()` is called on iOS** (`auth-context.tsx:241`). Harmless
   today, meaningless there, and it is the first thing that can throw.
4. **The real error is discarded.** `AuthMethodChooser.tsx:38` replaces every
   failure with one generic string, and nothing is sent to Sentry even though
   Sentry is wired up (`app.config.ts:150-157`). This is why the bug cannot be
   diagnosed from production.
5. **`GoogleSignin.configure` is conditional on both IDs being present**
   (`auth-context.tsx:34-36`). If `extra` were ever missing one, sign-in fails
   silently with no configuration at all. Should throw or report instead.

## 4. Plan

### Step 0: make the failure visible (do this first, it is cheap and it settles A vs B)

In `src/contexts/auth-context.tsx`, surface the real cause instead of swallowing
it:
- return the Google `statusCodes` value and the Supabase error `message` +
  `status` from `signInWithProvider`,
- `Sentry.captureException` on the native Google branch with the code attached,
- in `AuthMethodChooser`, pass the underlying message through to `onError` in
  non-production variants (keep the friendly string for production users).

Then run a preview build on a physical Android device and a physical iPhone. The
answer will be one of:
- `DEVELOPER_ERROR` / code 10 on Android, no network call: **cause A**,
- Supabase 400 `Unacceptable audience in id_token`: **cause B**,
- `cancelled` mistaken for failure: **cause C1**.

### Step 1: fix Android registration (cause A)

In Google Cloud console, project `697360742144`, Credentials:
1. Create an **OAuth client ID > Android** for each package name in use:
   `com.hryvnt.stampeo`, `com.hryvnt.stampeo.preview`, `com.hryvnt.stampeo.dev`.
2. For each, add the SHA-1 fingerprints:
   - `eas credentials -p android` > select the build profile > read the
     **upload key** SHA-1,
   - Play Console > Test and release > App integrity > read the **app signing
     key** SHA-1 for production.
   A single Android client accepts one package + one SHA-1, so production
   typically needs two clients (upload key and Play signing key) for the same
   package name. Create both.
3. Leave `webClientId` in `app.config.ts` as-is. On Android the library uses it
   as `serverClientId`, which is what makes the returned ID token carry
   `aud = <web client>`, which is what Supabase already accepts.

No app code change is required for this step, but the app must be rebuilt only
if the fingerprints changed, not for the client registration itself.

### Step 2: authorize the iOS client IDs in Supabase (cause B)

Supabase dashboard > Authentication > Providers > Google > **Authorized Client
IDs**. Ensure the comma-separated list contains all of:

```
697360742144-bchjmu7c1vphnvg057ir8a606et5csup.apps.googleusercontent.com   # iOS production
697360742144-e3k0tsrgokgejokt867lc9q2uk6nvq2j.apps.googleusercontent.com   # iOS preview
697360742144-uvt8crdjvh3qpbm0kqlnai27n4qrnef5.apps.googleusercontent.com   # iOS development
697360742144-qc1frui0nd27bc8hke7rb3vls2u8fnhe.apps.googleusercontent.com   # web / Android serverClientId
```

plus whatever the customer app already has in there. Do **not** remove existing
entries: the customer app's native Google login depends on them and is currently
working.

Apply to the dev project (`ysdpjxzldqwlmhlwzdaq`) as well.

### Step 3: fix the client code (cause C)

In `src/contexts/auth-context.tsx`, native Google branch:

- gate `hasPlayServices()` behind `Platform.OS === "android"`,
- handle the v16 return shape: treat `result.type === "cancelled"` as a
  cancellation, same as the thrown `SIGN_IN_CANCELLED`,
- after `signIn()`, call `GoogleSignin.getTokens()` and pass
  `access_token` alongside `token` to `signInWithIdToken`, clearing the Supabase
  `at_hash` warning before it becomes an error,
- keep the Sentry reporting added in Step 0,
- make a missing `iosClientId` / `webClientId` in `expoConfig.extra` a loud
  failure rather than a silent skip of `configure()`.

Tests: this repo runs `bun test src`. Add a unit test around a small extracted
helper (something like `normalizeGoogleSignInResult`) covering success,
cancelled-by-return, cancelled-by-throw, and missing-idToken, so the
cancellation regression cannot come back. Write the test before the refactor.

### Step 4: verify

1. Preview build on a physical Android device installed from an internal Play
   track (not a direct APK), sign in with Google.
2. Preview build on a physical iPhone, sign in with Google, and separately tap
   cancel to confirm no error toast appears.
3. Confirm in prod `auth_logs` that a `grant_type: id_token`,
   `traits.provider: google` login lands with status 200 and **without** the
   `at_hash` warning.
4. Confirm `scan.stampeo.app` still logs in via the `pkce` path, i.e. nothing in
   Steps 1 to 3 regressed the web scanner.

## 5. What is explicitly not the problem

- The Supabase client setup (`src/lib/supabase.ts`) is correct for both targets:
  `createBrowserClient` with shared-domain cookies on web, `createClient` with
  `LargeSecureStore` on native.
- The deep-link callback route (`src/app/auth/callback.tsx`) is only used by the
  browser-redirect fallback, which native Google never reaches.
- The invite-only gate (`login.tsx:76-95`) applies identically on web and native,
  so it cannot explain a web/native divergence.
