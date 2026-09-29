import { describe, expect, it } from "bun:test";
import { blendColors, isLightColor, normalizeColor, parseRgb } from "./colors";

describe("every colour format the data could hold is read", () => {
  it.each([
    ["rgb(206, 61, 2)", { r: 206, g: 61, b: 2 }],
    ["rgb(206,61,2)", { r: 206, g: 61, b: 2 }],
    ["RGB( 206 , 61 , 2 )", { r: 206, g: 61, b: 2 }],
    ["rgba(206, 61, 2, 0.5)", { r: 206, g: 61, b: 2 }],
    ["#ce3d02", { r: 206, g: 61, b: 2 }],
    ["#CE3D02", { r: 206, g: 61, b: 2 }],
    ["  #ce3d02  ", { r: 206, g: 61, b: 2 }],
    ["#ce3d02ff", { r: 206, g: 61, b: 2 }],
    ["#fff", { r: 255, g: 255, b: 255 }],
    ["#fffa", { r: 255, g: 255, b: 255 }],
    ["ce3d02", { r: 206, g: 61, b: 2 }],
  ])("%p", (input, expected) => {
    expect(parseRgb(input)).toEqual(expected);
  });

  it.each([["", null], ["not a colour", null], ["#12", null], ["#ggg", null], [undefined, null], [null, null]])(
    "%p is unreadable",
    (input, expected) => {
      expect(parseRgb(input as unknown as string)).toBe(expected);
    }
  );

  it("normalizes to the rgb() form the rest of the app works in", () => {
    expect(normalizeColor("#ce3d02")).toBe("rgb(206, 61, 2)");
    expect(normalizeColor("rgba(206, 61, 2, 0.4)")).toBe("rgb(206, 61, 2)");
    expect(normalizeColor("nope")).toBeNull();
  });

  it("blends and judges a hex colour like its rgb twin", () => {
    expect(blendColors("#ce3d02", "rgb(255, 255, 255)", 0.95)).toBe(
      blendColors("rgb(206, 61, 2)", "rgb(255, 255, 255)", 0.95)
    );
    expect(isLightColor("#ffffff")).toBe(true);
    expect(isLightColor("#091f00")).toBe(false);
  });
});
