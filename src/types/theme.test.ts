import { describe, expect, it } from "bun:test";
import { createThemeFromDesign, DEFAULT_THEME } from "./theme";
import type { CardDesign } from "./api";

const design = (fields: Partial<CardDesign>) => fields as CardDesign;

describe("the scanner theme never paints the screen in the raw brand colour", () => {
  it("a hex brand gives the same theme as its rgb() twin", () => {
    expect(createThemeFromDesign(design({ background_color: "#ce3d02", foreground_color: "#f1faee" }))).toEqual(
      createThemeFromDesign(
        design({ background_color: "rgb(206, 61, 2)", foreground_color: "rgb(241, 250, 238)" })
      )
    );
  });

  it("the background stays a light tint, never the brand itself", () => {
    const theme = createThemeFromDesign(design({ background_color: "#ce3d02" }));
    expect(theme.background).not.toBe(theme.primary);
    expect(theme.background).toBe("rgb(253, 245, 242)"); // 95% toward white
  });

  it("an unreadable brand falls back to the default theme's colours", () => {
    const theme = createThemeFromDesign(design({ background_color: "brand-red", foreground_color: "???" }));
    expect(theme.primary).toBe(DEFAULT_THEME.primary);
    expect(theme.primaryText).toBe(DEFAULT_THEME.primaryText);
    expect(theme.background).not.toBe("brand-red");
  });

  it("every colour it hands out is in rgb() form", () => {
    const theme = createThemeFromDesign(
      design({
        background_color: "#264653",
        foreground_color: "#f1faee",
        stamp_filled_color: "#2a9d8f",
        stamp_empty_color: "#e8e6e1",
        stamp_border_color: "#ddd9d0",
      })
    );
    for (const value of Object.values(theme)) expect(value).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });
});
