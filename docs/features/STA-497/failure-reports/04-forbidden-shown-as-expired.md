CASE: SES-04 (case added by this issue)
VERDICT: FAILED
SEVERITY: EDGE
RUN: code trace, 2026-10-23, scanner `dev` @ d74fd67
SURFACE: scanner app, stamp screen load error
ACCOUNT: an employee removed from the team, or on an inactive business

## Failed at

Scan a card after the owner removed the employee from the team.

## Expected

The error says the employee has no access to this business, the same message the stamp and redeem paths already show for a 403 (`errors.accessDenied`).

## Actual

`loadErrorKey` (`src/utils/apiErrors.ts:140`) maps 401 **and** 403 to `errors.unauthorized`: "Your session has expired. Sign in again to keep scanning." The backend sends 403 for no membership, wrong role, or an inactive business (`backend/app/core/permissions.py:158-180`), none of which a new sign-in fixes. The employee is sent to sign in again for nothing.

## Evidence

`src/utils/apiErrors.test.ts` pinned the wrong mapping (`403 → errors.unauthorized`); this issue corrects that case.

## State at time of failure

- Session: valid; membership removed, or business not `active`.

## Aftermath

- RESET performed: none needed.
