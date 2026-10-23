CASE: none (storage-layer fault; no manual case can trigger it reliably)
VERDICT: FAILED
SEVERITY: EDGE
RUN: code trace + regression test, 2026-10-23, scanner `dev` @ d74fd67
SURFACE: scanner app, native builds
ACCOUNT: any

## Failed at

A session write (sign-in or token refresh) that is interrupted between its two storage writes.

## Expected

An interrupted or failed write leaves the previous session readable. The employee stays signed in.

## Actual

`src/lib/large-secure-store.ts` makes a fresh AES key on every `setItem`, saves it to SecureStore (`:40-43`), then saves the data encrypted with it to AsyncStorage (`:109`). If the app is killed between the two, or the AsyncStorage write fails, SecureStore holds the new key and AsyncStorage the old data. The next read decrypts garbage. supabase-js judges the session invalid and deletes it (`GoTrueClient.js:3804-3811`): a permanent logout.

## Evidence

`src/lib/auth/encrypted-store.test.ts` (this issue): a second write whose data write fails must leave the first value readable.

## State at time of failure

- Session: signed in; the process dies or storage errors during a refresh.

## Aftermath

- RESET performed: none needed.

## Hypothesis (optional, clearly speculative)

Rare, since refreshes only run in the foreground. Check Sentry for "LargeSecureStore.getItem error" or `refresh_token_already_used` once the connector is authorised.
