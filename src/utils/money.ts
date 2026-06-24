/**
 * Locale-aware money input + points conversion helpers for the points keypad.
 *
 * The amount the employee types is the purchase/ticket price. The backend
 * converts it to points with round-half-up (`int(price * rate + 0.5)`); we
 * mirror that exactly here so the live "≈ +N pts" preview never disagrees with
 * the result the server returns.
 */
import { getLocales } from "expo-localization";

// Generous client-side caps so a keypad typo can't mint an absurd balance — the
// backend also rejects `> 1_000_000` and `<= 0`, these are just the first line.
const MAX_INTEGER_DIGITS = 7; // up to 9 999 999
const MAX_DECIMALS = 2;

let cachedSeparator: string | null = null;
let cachedSymbol: string | null = null;

/** The device's decimal separator ("," in FR, "." in en-US). Defaults to ".". */
export function getDecimalSeparator(): string {
  if (cachedSeparator !== null) return cachedSeparator;
  try {
    const sep = getLocales()?.[0]?.decimalSeparator;
    cachedSeparator = sep === "," || sep === "." ? sep : ".";
  } catch {
    cachedSeparator = ".";
  }
  return cachedSeparator;
}

/** The device's currency symbol. Defaults to "€" (FR-first platform). */
export function getCurrencySymbol(): string {
  if (cachedSymbol !== null) return cachedSymbol;
  try {
    cachedSymbol = getLocales()?.[0]?.currencySymbol || "€";
  } catch {
    cachedSymbol = "€";
  }
  return cachedSymbol;
}

/**
 * Apply one keypad press to the current raw amount string and return the next
 * raw string. `key` is a digit "0"–"9", the locale separator, or "backspace".
 * Enforces: a single separator, at most MAX_DECIMALS decimals, at most
 * MAX_INTEGER_DIGITS integer digits, and no leading-zero runs.
 */
export function applyKeypadInput(
  current: string,
  key: string,
  separator: string = getDecimalSeparator()
): string {
  if (key === "backspace") return current.slice(0, -1);

  if (key === separator) {
    if (current.includes(separator)) return current; // only one separator
    if (current === "") return `0${separator}`; // ".5" → "0.5"
    return current + separator;
  }

  // Digit
  if (!/^[0-9]$/.test(key)) return current;

  const [intPart = "", decPart] = current.split(separator);

  if (current.includes(separator)) {
    if ((decPart ?? "").length >= MAX_DECIMALS) return current;
    return current + key;
  }

  // Integer side: avoid "00…" and respect the integer-digit cap.
  if (current === "0") return key === "0" ? current : key;
  if (intPart.length >= MAX_INTEGER_DIGITS) return current;
  return current + key;
}

/** Parse a raw separator-formatted string to a JS number (0 when empty/invalid). */
export function parseAmount(raw: string, separator: string = getDecimalSeparator()): number {
  if (!raw) return 0;
  const normalized = raw.split(separator).join(".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Points credited for a price at a given rate — mirrors backend round-half-up. */
export function previewPoints(amount: number, rate: number | null | undefined): number {
  const r = typeof rate === "number" && rate > 0 ? rate : 1;
  if (!(amount > 0)) return 0;
  return Math.floor(amount * r + 0.5);
}
