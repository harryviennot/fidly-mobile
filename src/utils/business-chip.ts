// Decides what fills a business chip: the server-built chip, else the
// business logo, else the icon, else the name's initials.

export interface BusinessChipInput {
  name: string;
  logo_chip?: { image_url: string; background: string } | null;
  logo_url?: string | null;
  icon_original_url?: string | null;
  icon_url?: string | null;
}

export type ResolvedBusinessChip =
  | { kind: "chip"; src: string; background: string }
  | { kind: "logo"; src: string }
  | { kind: "initials"; text: string };

// Colours of the fallback chips (logo contained on paper, initials on muted).
export const CHIP_PAPER = "#FAFAF8";
export const CHIP_MUTED = "#F0EDE7";
export const CHIP_MUTED_INK = "#5A5A5A";

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
