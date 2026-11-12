/**
 * Guards which Xcode builds the iOS app.
 *
 * An app built with the iOS 27 SDK (Xcode 27) must use UIKit's scene life
 * cycle, or iOS stops it at launch, before any JavaScript or Sentry runs. Expo
 * adds that life cycle from SDK 58 (SDK 57 behind `enableSceneSupport`), so an
 * older SDK must build on the image Expo pairs with it. EAS's `sdk-<major>`
 * alias (or `auto`) is that image; `latest` follows the newest Xcode whatever
 * the SDK.
 */

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

type BuildProfile = { ios?: { image?: string } };

const eas = JSON.parse(readFileSync(join(ROOT, "eas.json"), "utf8")) as {
  build: Record<string, BuildProfile>;
};
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};

const sdkMajor = pkg.dependencies.expo.replace(/^[~^]/, "").split(".")[0];

test("every iOS build runs on the image Expo pairs with the installed SDK", () => {
  const offImage = Object.entries(eas.build)
    .map(([profile, { ios }]) => ({ profile, image: ios?.image }))
    .filter(({ image }) => image !== undefined && image !== "auto" && image !== `sdk-${sdkMajor}`);

  expect(offImage).toEqual([]);
});
