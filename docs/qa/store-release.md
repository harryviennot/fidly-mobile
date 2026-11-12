BRANCH: fix/sta-553-ios-launch-crash (scanner-app)
SCOPES: scanner-app
ENVIRONMENT: the production store build, before it goes to review. No account needed: every case stops at the sign-in screen.

# Scanner Store Release Smoke Pass

Run this on every store build before submitting it for review, after EAS has built it and before anyone taps "Submit". It checks that the build that ships opens on a real phone, which no unit test, simulator run or dev build can prove. It takes five minutes.

---

## SETUP: Before you start

Nothing here signs in, so nothing touches production data.

### Where things live

| Surface | URL / Command | Notes |
|---|---|---|
| iOS build | TestFlight, app "Stampeo" | Use the build number EAS just printed. Use an iPhone on the newest iOS release. |
| Android build | Play Console internal testing track | `eas submit -p android --profile internal` |
| Build facts | `eas build:list --platform ios --limit 1` | Prints the version, build number and image of the last build. |

### Accounts

None. The cases stop at the sign-in screen.

### Reset recipes

**R1: Fresh install** (before each case)

Delete the Stampeo app from the phone, then install the build under test from TestFlight or the internal track.

### Known state before you start

- **STA-553 (fixed, pending re-verification):** iOS 2.3.3 (build 39) closed on launch for every user. It was built with Xcode 27 (EAS `latest`), and Expo SDK 54 lacks the scene life cycle that the iOS 27 SDK requires. The build now uses the `sdk-54` image (Xcode 26.0). `src/eas-build-image.test.ts` guards the image; only REL-01 on a real iPhone proves the build launches.
- **New runbook:** REL-01 is the case that would have caught STA-553. No earlier pass ran the store build.

---

## REL: The store build opens

### REL-01: The iOS store build opens on the newest iOS

SEVERITY: BLOCKER
DEPENDS: none
RESET: R1
WHY: A build can pass every test and still be stopped by iOS at launch when its Xcode doesn't match the app's Expo SDK. That crash happens before Sentry starts, so nothing reports it: this case is the only place it shows.

1. Install the build under test from TestFlight on an iPhone running the newest iOS release.
2. Open Stampeo and wait 10 seconds.

EXPECT:
- The sign-in screen appears and stays on screen.
- TestFlight shows the version and build number EAS printed.
- NOT: the app closes, flashes the splash screen and returns to the home screen, or shows a blank white screen.

### REL-02: The Android store build opens

SEVERITY: BLOCKER
DEPENDS: none
RESET: R1
WHY: Android builds on a different image and toolchain, so a pass on iOS says nothing about it.

1. Install the build under test from the Play internal testing track.
2. Open Stampeo and wait 10 seconds.

EXPECT:
- The sign-in screen appears and stays on screen.
- NOT: "Stampeo keeps stopping", or a return to the home screen.
