import { describe, expect, it } from "bun:test";
import {
  chipGeometry,
  resolveBusinessChip,
  withFailedSource,
  type ResolvedBusinessChip,
} from "./businessChip";

const CHIP = { image_url: "https://cdn.test/chip-ab12cd34ef56.png", background: "#1A2B3C" };
const LOGO = "https://cdn.test/logo.png";
const ICON_ORIGINAL = "https://cdn.test/icon-original.png";
const ICON = "https://cdn.test/icon.png";

describe("resolveBusinessChip: which image fills the chip", () => {
  it.each<[string, Parameters<typeof resolveBusinessChip>[0], ResolvedBusinessChip]>([
    [
      "server chip wins over every other image",
      {
        name: "Cafe Rouge",
        logo_chip: CHIP,
        logo_url: LOGO,
        icon_original_url: ICON_ORIGINAL,
        icon_url: ICON,
      },
      { kind: "chip", src: CHIP.image_url, background: CHIP.background },
    ],
    [
      "chip null falls back to the logo",
      { name: "Cafe Rouge", logo_chip: null, logo_url: LOGO },
      { kind: "logo", src: LOGO },
    ],
    [
      "chip absent from the payload falls back to the logo",
      { name: "Cafe Rouge", logo_url: LOGO },
      { kind: "logo", src: LOGO },
    ],
    [
      "chip without an image falls back to the logo",
      { name: "Cafe Rouge", logo_chip: { image_url: "", background: "#000000" }, logo_url: LOGO },
      { kind: "logo", src: LOGO },
    ],
    [
      "logo wins over the icons",
      { name: "Cafe Rouge", logo_url: LOGO, icon_original_url: ICON_ORIGINAL, icon_url: ICON },
      { kind: "logo", src: LOGO },
    ],
    [
      "no logo: the original icon",
      { name: "Cafe Rouge", logo_chip: null, logo_url: null, icon_original_url: ICON_ORIGINAL, icon_url: ICON },
      { kind: "logo", src: ICON_ORIGINAL },
    ],
    [
      "no logo and no original icon: the icon",
      { name: "Cafe Rouge", logo_url: null, icon_original_url: null, icon_url: ICON },
      { kind: "logo", src: ICON },
    ],
    [
      "empty strings count as missing",
      { name: "Cafe Rouge", logo_url: "", icon_original_url: "", icon_url: ICON },
      { kind: "logo", src: ICON },
    ],
    [
      "nothing at all: initials",
      { name: "Cafe Rouge" },
      { kind: "initials", text: "CR" },
    ],
    [
      "every image null: initials",
      { name: "Cafe Rouge", logo_chip: null, logo_url: null, icon_original_url: null, icon_url: null },
      { kind: "initials", text: "CR" },
    ],
  ])("%s", (_case, business, expected) => {
    expect(resolveBusinessChip(business)).toEqual(expected);
  });
});

describe("resolveBusinessChip: initials", () => {
  it.each([
    ["Cafe Rouge", "CR"],
    ["inefable", "I"],
    ["la petite boulangerie", "LP"],
    ["  Maison   Dupont  ", "MD"],
    ["Marie-Claire Dupont", "MD"],
    ["Élan Bakery", "ÉB"],
    ["Boulangerie\tDu\nCoin", "BD"],
    ["", ""],
    ["   ", ""],
  ])("%j gives %j", (name, text) => {
    expect(resolveBusinessChip({ name })).toEqual({ kind: "initials", text });
  });
});

describe("resolveBusinessChip: images that failed to load", () => {
  const FULL = {
    name: "Cafe Rouge",
    logo_chip: CHIP,
    logo_url: LOGO,
    icon_original_url: ICON_ORIGINAL,
    icon_url: ICON,
  };

  it.each<[string, string[], ResolvedBusinessChip]>([
    ["nothing failed: the chip", [], { kind: "chip", src: CHIP.image_url, background: CHIP.background }],
    ["chip deleted after a recompute: the logo on paper", [CHIP.image_url], { kind: "logo", src: LOGO }],
    ["chip and logo failed: the original icon", [CHIP.image_url, LOGO], { kind: "logo", src: ICON_ORIGINAL }],
    ["chip, logo and original icon failed: the icon", [CHIP.image_url, LOGO, ICON_ORIGINAL], { kind: "logo", src: ICON }],
    [
      "every image failed (offline first launch): initials",
      [CHIP.image_url, LOGO, ICON_ORIGINAL, ICON],
      { kind: "initials", text: "CR" },
    ],
    ["only the logo failed: the chip is kept", [LOGO], { kind: "chip", src: CHIP.image_url, background: CHIP.background }],
  ])("%s", (_case, failed, expected) => {
    expect(resolveBusinessChip(FULL, new Set(failed))).toEqual(expected);
  });

  it("a failing logo with no icon falls back to initials", () => {
    expect(resolveBusinessChip({ name: "Cafe Rouge", logo_url: LOGO }, new Set([LOGO]))).toEqual({
      kind: "initials",
      text: "CR",
    });
  });

  it("a recomputed chip has a new URL and is tried even though the old one failed", () => {
    const recomputed = { image_url: "https://cdn.test/chip-ffeeddccbbaa.png", background: "#1A2B3C" };
    expect(
      resolveBusinessChip({ ...FULL, logo_chip: recomputed }, new Set([CHIP.image_url])),
    ).toEqual({ kind: "chip", src: recomputed.image_url, background: recomputed.background });
  });
});

describe("withFailedSource", () => {
  it("adds the failed source to a new set", () => {
    const before = new Set<string>();
    const after = withFailedSource(before, CHIP.image_url);
    expect(after.has(CHIP.image_url)).toBe(true);
    expect(before.size).toBe(0);
  });

  it("returns the same set when the source is already recorded, so no re-render follows", () => {
    const before = new Set([LOGO]);
    expect(withFailedSource(before, LOGO)).toBe(before);
  });
});

describe("chipGeometry: the 3:2 chip contract", () => {
  it.each([36, 40, 48])("height %d: width 1.5x, radius 0.17x, logo margin 0.16x", (height) => {
    const geometry = chipGeometry(height);
    expect(geometry.width / geometry.height).toBeCloseTo(1.5, 10);
    expect(geometry.height).toBe(height);
    expect(geometry.radius).toBeCloseTo(height * 0.17, 10);
    expect(geometry.logoMargin).toBeCloseTo(height * 0.16, 10);
  });
});
