CASE: none (field report, no runbook case covers the store build's launch)
VERDICT: FAILED
SEVERITY: BLOCKER
RUN: 2026-11-13, App Store build 2.3.3 (39), EAS build eb4b7567, commit 69fa1a8
SURFACE: iOS App Store build
ACCOUNT: any (the app stops before sign-in)

## Failed at

Opening the Stampeo scanner app on an iPhone.

## Expected

The app opens on the sign-in screen, or on the lobby for a signed-in employee,
as iOS 2.3.1 did.

## Actual

The app closes as soon as it opens. Reported by Harry on iOS; not yet opened on
Android.

## Evidence

- Sentry `stampeo/scanner-app`: no iOS event from `Stampeo@2.3.3` at all. The
  only 2.3.3 events are Android (`SCANNER-APP-P`, Google sign-in). A crash that
  never reports means the app stops before the native Sentry SDK starts.
- Info.plist of the shipped IPA: `DTXcode 2710`, `DTXcodeBuild 27A9275`,
  `DTSDKName iphoneos27.1`, no `UIApplicationSceneManifest`.
- `eas.json` production iOS: `"image": "latest"`, which EAS resolves to
  `macos-tahoe-26.6-xcode-27.1`. Every earlier iOS build ran on an Xcode 26
  image; iOS 2.3.2 never shipped (build 36 failed on Xcode 27's pod-target check,
  fixed by #49).

## State at time of failure

- Session: irrelevant, the crash comes before any screen
- Preceding cases this run: none
- Relevant data: none

## Aftermath

- RESET performed: none needed
- Dependents skipped: every scanner case on the iOS store build
- Run continued: no

## Hypothesis (optional, clearly speculative)

Apps built with the iOS 27 SDK must use UIKit's scene life cycle or iOS stops
them at launch (expo/expo#46664, react/react-native#58545); Expo SDK 54 doesn't
have it. Building with an Xcode 26 image should launch again.
