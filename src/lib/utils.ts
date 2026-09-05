import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * One pinned locale for every date, time and money format.
 *
 * Not the visitor's locale on purpose: the server renders in its own locale and
 * the browser in the reader's, so "undefined" produces a different string on
 * each side and React tears the tree down as a hydration mismatch.
 */
export const LOCALE = "en-GB";

/** "Mounir Smeli" -> "MS" */
export function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/* ------------------------------------------------------------------ money */

/**
 * Algerian dinar, rendered as "35,500 DA".
 *
 * Built by hand rather than through Intl currency formatting, which writes DZD
 * as "DZD 35,500" in English locales and "35 500,00 DA" in French ones.
 * Change CURRENCY_SUFFIX here and every amount in the app follows.
 */
export const CURRENCY = "DZD";
const CURRENCY_SUFFIX = "DA";

const numberFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function money(value: number | null | undefined) {
  return `${numberFmt.format(value ?? 0)} ${CURRENCY_SUFFIX}`;
}

/** Short form for stat tiles and cards: 1 250 000 becomes "1.25M DA". */
export function compactMoney(value: number | null | undefined) {
  const n = value ?? 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M ${CURRENCY_SUFFIX}`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k ${CURRENCY_SUFFIX}`;
  }
  return `${sign}${abs} ${CURRENCY_SUFFIX}`;
}

/** Deterministic accent for a given string, so avatars/tags stay stable. */
const ACCENTS = ["clay", "amber", "sage", "indigo", "plum", "rose"] as const;
export type Accent = (typeof ACCENTS)[number];

export function accentFor(seed: string): Accent {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function relativeTime(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(LOCALE, { month: "short", day: "numeric" });
}
