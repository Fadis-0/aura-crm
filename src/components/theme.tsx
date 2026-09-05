"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
};

const ThemeContext = createContext<Ctx>({
  theme: "system",
  setTheme: () => {},
  resolved: "light",
});

export const useTheme = () => useContext(ThemeContext);

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/**
 * The chosen theme arrives from a cookie the server already read, so the very
 * first painted frame is correct. No boot script, no flash, nothing for
 * hydration to disagree about.
 */
export function ThemeProvider({
  initial,
  children,
}: {
  initial: Theme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initial);
  const [resolved, setResolved] = useState<"light" | "dark">(
    initial === "system" ? "light" : initial,
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);

    const compute = () =>
      setResolved(theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme);
    compute();

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", compute);
    return () => mq.removeEventListener("change", compute);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.cookie = `${THEME_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-full transition-colors",
              active ? "bg-surface text-ink shadow-soft" : "text-ink-4 hover:text-ink-2",
            )}
          >
            <Icon size={14} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
