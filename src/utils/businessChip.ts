import type { Business } from "@/types/api";

// Decides what fills a business chip: the server-built chip, else the
// business logo, else the icon, else the name's initials.

export type BusinessChipInput = Pick<Business, "name"> &
  Partial<Pick<Business, "logo_url" | "icon_original_url" | "icon_url" | "logo_chip">>;

export type ResolvedBusinessChip =
  | { kind: "chip"; src: string; background: string }
  | { kind: "logo"; src: string }
  | { kind: "initials"; text: string };

// First letter of each of the first two words, uppercased.
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join("");
}

export function resolveBusinessChip(business: BusinessChipInput): ResolvedBusinessChip {
  const chip = business.logo_chip;
  if (chip?.image_url) {
    return { kind: "chip", src: chip.image_url, background: chip.background };
  }

  const image = business.logo_url || business.icon_original_url || business.icon_url;
  if (image) {
    return { kind: "logo", src: image };
  }

  return { kind: "initials", text: initialsOf(business.name) };
}
