import { describe, expect, test } from "bun:test";
import { signUpMetadata } from "./sign-up-metadata";

describe("signUpMetadata", () => {
  test("carries the app's language so the code email is written in it", () => {
    expect(signUpMetadata("Inès", "pl")).toEqual({ name: "Inès", locale: "pl" });
  });
});
