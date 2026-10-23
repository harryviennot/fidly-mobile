CASE: SES-03 (case added by this issue)
VERDICT: FAILED
SEVERITY: EDGE
RUN: code trace + regression test, 2026-10-23, scanner `dev` @ d74fd67
SURFACE: scanner app, all builds
ACCOUNT: an employee on two or more shops

## Failed at

Select shop B, kill the app, relaunch.

## Expected

The app opens on shop B's lobby.

## Actual

`src/contexts/business-context.tsx:154-161` runs `removeStoredBusinessId()` whenever `userId` is empty. That includes the first render, while auth is still restoring the session. By the time memberships load, the stored id is gone, so an employee with several shops lands on the shop picker after every relaunch. It reads as "the app logged me out".

## Evidence

`src/contexts/business-selection.test.ts` (this issue).

## State at time of failure

- Session: signed in, two or more memberships, a shop selected before the relaunch.

## Aftermath

- RESET performed: none needed.

## Fix

The stored shop is dropped when a signed-in employee signs out, or when a different one replaces a live session. It is kept across a cold start, including a session that died while the app was closed followed by someone else signing in: the stored id is only applied if it is one of that person's memberships (`business-context.tsx`, `refreshMemberships`), so at most it preselects a shop they are on too.
