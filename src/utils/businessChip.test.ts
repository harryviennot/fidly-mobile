import { describe, expect, it } from "bun:test";
import { resolveBusinessChip, type ResolvedBusinessChip } from "./businessChip";

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
