import type { Business } from "@/types/api";

// Decides what fills a business chip: the server-built chip, else the
// business logo, else the icon, else the name's initials. Images that failed
// to load are skipped, so the chip degrades one step at a time.

export type BusinessChipInput = Pick<Business, "name"> &
  Partial<Pick<Business, "logo_url" | "icon_original_url" | "icon_url" | "logo_chip">>;

export type ResolvedBusinessChip =
  | { kind: "chip"; src: string; background: string }
  | { kind: "logo"; src: string }
  | { kind: "initials"; text: string };

// The chip is 3:2 with a 0.17 corner radius, and a contained logo keeps a
// 0.16 margin; the same ratios as the dashboard.
export function chipGeometry(height: number) {
  return {
    width: height * 1.5,
    height,
    radius: height * 0.17,
    logoMargin: height * 0.16,
  };
}

// The failed set with `src` added; the same set when it is already there.
export function withFailedSource(failed: ReadonlySet<string>, src: string): ReadonlySet<string> {
  if (failed.has(src)) return failed;
  return new Set(failed).add(src);
}

// First letter of each of the first two words, uppercased.
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join("");
}

export function resolveBusinessChip(
  business: BusinessChipInput,
  failedSources: ReadonlySet<string> = new Set(),
): ResolvedBusinessChip {
  const chip = business.logo_chip;
  if (chip?.image_url && !failedSources.has(chip.image_url)) {
    return { kind: "chip", src: chip.image_url, background: chip.background };
  }

  const image = [business.logo_url, business.icon_original_url, business.icon_url].find(
    (src): src is string => !!src && !failedSources.has(src),
  );
  if (image) {
    return { kind: "logo", src: image };
  }

  return { kind: "initials", text: initialsOf(business.name) };
}
