import type { InvoiceItem } from "@/lib/types";

/** One line of a facture, before tax. */
export function lineTotal(item: Pick<InvoiceItem, "quantity" | "unit_price">) {
  return (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
}

/**
 * What the document adds up to. Rounded to the dinar, because that is the
 * figure printed, and a total that disagrees with its own lines is worse than
 * a lost centime.
 */
export function invoiceTotals(
  items: Pick<InvoiceItem, "quantity" | "unit_price">[],
  taxRate: number,
) {
  const subtotal = Math.round(items.reduce((sum, i) => sum + lineTotal(i), 0));
  const tax = Math.round((subtotal * (Number(taxRate) || 0)) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

/* ------------------------------------------------- the amount in words --
 * Algerian factures carry the total written out, so it is spelled in French
 * to match the rest of the printed document.
 */

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit",
  "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
];

const TENS: Record<number, string> = {
  20: "vingt",
  30: "trente",
  40: "quarante",
  50: "cinquante",
  60: "soixante",
  80: "quatre-vingt",
};

/** `scaled` is set when the number is followed by "mille", which makes the
 *  plural s on "vingts" and "cents" drop: quatre-vingt mille, deux cent mille. */
function under100(n: number, scaled = false): string {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;

  // 70s count from soixante and 90s from quatre-vingt, so those two borrow
  // the teens rather than having tens words of their own.
  if (n >= 70 && n < 80) {
    return n === 71 ? "soixante et onze" : `soixante-${under100(n - 60)}`;
  }
  if (n >= 90) return `quatre-vingt-${under100(n - 80)}`;

  const base = n >= 80 ? 80 : Math.floor(n / 10) * 10;
  const rest = n - base;
  if (rest === 0) {
    return base === 80 ? (scaled ? "quatre-vingt" : "quatre-vingts") : TENS[base];
  }
  if (rest === 1 && base !== 80) return `${TENS[base]} et un`;
  return `${TENS[base]}-${UNITS[rest]}`;
}

function under1000(n: number, scaled = false): string {
  if (n < 100) return under100(n, scaled);

  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds === 1 ? "cent" : `${UNITS[hundreds]} cent`;

  if (rest === 0) {
    return hundreds === 1 ? "cent" : `${UNITS[hundreds]} cent${scaled ? "" : "s"}`;
  }
  return `${head} ${under100(rest, scaled)}`;
}

/** 1 250 040 becomes "un million deux cent cinquante mille quarante". */
export function numberToFrench(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "zéro";

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (billions) {
    parts.push(billions === 1 ? "un milliard" : `${under1000(billions)} milliards`);
  }
  if (millions) {
    parts.push(millions === 1 ? "un million" : `${under1000(millions)} millions`);
  }
  if (thousands) {
    parts.push(thousands === 1 ? "mille" : `${under1000(thousands, true)} mille`);
  }
  if (rest) parts.push(under1000(rest));

  return parts.join(" ");
}

/** The line a facture closes with, capitalised as it is printed. */
export function amountInWords(total: number): string {
  const dinars = Math.floor(Math.abs(total));
  const centimes = Math.round((Math.abs(total) - dinars) * 100);

  const words = `${numberToFrench(dinars)} dinar${dinars === 1 ? "" : "s"} algérien${
    dinars === 1 ? "" : "s"
  }`;
  const withCentimes =
    centimes > 0 ? `${words} et ${numberToFrench(centimes)} centimes` : words;

  return withCentimes.charAt(0).toUpperCase() + withCentimes.slice(1);
}
