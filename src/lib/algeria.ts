/** The 58 wilayas, in official order. The code is the number people know. */
export const WILAYAS = [
  "01 — Adrar",
  "02 — Chlef",
  "03 — Laghouat",
  "04 — Oum El Bouaghi",
  "05 — Batna",
  "06 — Béjaïa",
  "07 — Biskra",
  "08 — Béchar",
  "09 — Blida",
  "10 — Bouira",
  "11 — Tamanrasset",
  "12 — Tébessa",
  "13 — Tlemcen",
  "14 — Tiaret",
  "15 — Tizi Ouzou",
  "16 — Alger",
  "17 — Djelfa",
  "18 — Jijel",
  "19 — Sétif",
  "20 — Saïda",
  "21 — Skikda",
  "22 — Sidi Bel Abbès",
  "23 — Annaba",
  "24 — Guelma",
  "25 — Constantine",
  "26 — Médéa",
  "27 — Mostaganem",
  "28 — M'Sila",
  "29 — Mascara",
  "30 — Ouargla",
  "31 — Oran",
  "32 — El Bayadh",
  "33 — Illizi",
  "34 — Bordj Bou Arréridj",
  "35 — Boumerdès",
  "36 — El Tarf",
  "37 — Tindouf",
  "38 — Tissemsilt",
  "39 — El Oued",
  "40 — Khenchela",
  "41 — Souk Ahras",
  "42 — Tipaza",
  "43 — Mila",
  "44 — Aïn Defla",
  "45 — Naâma",
  "46 — Aïn Témouchent",
  "47 — Ghardaïa",
  "48 — Relizane",
  "49 — Timimoun",
  "50 — Bordj Badji Mokhtar",
  "51 — Ouled Djellal",
  "52 — Béni Abbès",
  "53 — In Salah",
  "54 — In Guezzam",
  "55 — Touggourt",
  "56 — Djanet",
  "57 — El M'Ghair",
  "58 — El Meniaa",
] as const;

export const WILAYA_OPTIONS = WILAYAS.map((w) => ({ value: w, label: w }));

/**
 * A CCP account's RIP: 20 digits, usually written in groups. Spaces and dashes
 * are allowed while typing and stripped before checking.
 */
export function normaliseRip(value: string) {
  return value.replace(/[\s-]/g, "");
}

export function isValidRip(value: string) {
  const digits = normaliseRip(value);
  return /^\d{10,24}$/.test(digits);
}

/** 1234567890 12 -> "1234567890 12" in readable groups of four. */
export function formatRip(value: string | null | undefined) {
  if (!value) return "";
  const digits = normaliseRip(value);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}
