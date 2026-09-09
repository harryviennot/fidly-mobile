import { describe, expect, it } from "bun:test";
import { loadOptionalModule } from "./optional-native";

describe("loadOptionalModule", () => {
  it("returns the module when it loads", () => {
    const fake = { GoogleSignin: {} };
    const result = loadOptionalModule(() => fake);
    expect(result.available).toBe(true);
    expect(result.module).toBe(fake);
  });

  it("swallows a throwing loader", () => {
    // What TurboModuleRegistry.getEnforcing does when the native half is
    // absent -- in Expo Go, for every third-party native module.
    const result = loadOptionalModule<{ x: number }>(() => {
      throw new Error(
        "Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found"
      );
    });
    expect(result.available).toBe(false);
    expect(result.module).toBeNull();
  });

  it("treats a module that fails its readiness check as unavailable", () => {
    const result = loadOptionalModule(
      () => ({ GoogleSignin: undefined }),
      (m) => !!m.GoogleSignin
    );
    expect(result.available).toBe(false);
    expect(result.module).toBeNull();
  });

  it("treats a null module as unavailable", () => {
    const result = loadOptionalModule<null>(() => null);
    expect(result.available).toBe(false);
  });

  it("does not run the readiness check when loading threw", () => {
    let checked = false;
    loadOptionalModule<number>(
      () => {
        throw new Error("nope");
      },
      () => {
        checked = true;
        return true;
      }
    );
    expect(checked).toBe(false);
  });
});
