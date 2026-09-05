import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: { default: "Aura CRM", template: "%s · Aura" },
  description: "Client, project and pipeline workspace.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#13110e" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Stamped on <html> before anything paints, so there is no theme flash.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      suppressHydrationWarning
    >
      <body className={`${inter.variable} ${fraunces.variable}`}>
        <ThemeProvider initial={theme}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--surface)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-md)",
                fontFamily: "var(--font-inter)",
                boxShadow: "var(--shadow-md)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
