export const THEME_COOKIE = "crm-theme";

export type Theme = "light" | "dark" | "system";

export function parseTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}
