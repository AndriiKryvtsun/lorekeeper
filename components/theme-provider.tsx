"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Wraps next-themes. Configured by the root layout with attribute="class",
// defaultTheme="system", enableSystem — so the theme follows prefers-color-scheme and
// can be toggled explicitly via the `.dark` class.
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
