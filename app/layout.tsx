import type { Metadata } from "next";
import { Geist, Geist_Mono, Spectral } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { env } from "~/env";
import { TRPCReactProvider } from "~/trpc/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif display family for headings — anchors the dark-fantasy/arcane identity. Exposed as
// the `--font-spectral` variable and mapped to the `--font-display` token in globals.css.
const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// App-wide metadata. The whole app is `noindex` by default; only the home page (`/`) opts
// back into indexing via its own `generateMetadata`. `metadataBase` resolves relative
// canonical/Open Graph URLs.
export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "LoreKeeper", template: "%s · LoreKeeper" },
  description: "Campaign companion for tabletop RPGs.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The proxy sets a per-request nonce on `x-nonce`; pass it to next-themes so its inline
  // theme script carries the nonce under the strict CSP (no inline-script violation/FOUC).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${spectral.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          nonce={nonce}
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
