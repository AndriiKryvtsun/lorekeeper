import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Public marketing landing. Server Component (no per-user data) built from design-system
// primitives, light + dark. The only client island is the ThemeToggle.
const FEATURES = [
  {
    title: "Campaign & entity management",
    body: "Organize campaigns with their NPCs, locations, items, sessions, and player characters — all in one place, scoped to you.",
  },
  {
    title: "Grounded AI assistant",
    body: "Ask questions answered only from your campaign's own data — no invented facts — and propose changes you confirm before anything is written.",
  },
  {
    title: "Automatic session summaries",
    body: "Capture what happened each session and keep a running, searchable history of your story.",
  },
];

export function Landing() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Skip-to-content: visually hidden until focused, then jumps to #main. */}
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
      >
        Skip to content
      </a>

      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <span className="font-semibold">LoreKeeper</span>
          <nav aria-label="Primary" className="flex items-center gap-1">
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Sign up</Link>
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="hero-animate flex flex-col items-start gap-6">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Keep your campaign&rsquo;s lore at your fingertips
            </h1>
            <p className="max-w-prose text-lg text-muted-foreground">
              LoreKeeper is a companion for tabletop RPGs: organize your world, ask a
              grounded assistant about your own campaign, and never lose the thread between
              sessions.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">Get started</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            {/* Decorative illustration; meaning is conveyed by the heading and copy. */}
            <Image
              src="/globe.svg"
              alt=""
              aria-hidden
              width={420}
              height={420}
              priority
              className="dark:invert"
            />
          </div>
        </section>

        <section
          aria-labelledby="features-heading"
          className="mx-auto w-full max-w-6xl px-4 pb-20"
        >
          <h2 id="features-heading" className="sr-only">
            Features
          </h2>
          <ul className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {f.body}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          © LoreKeeper — your tabletop campaign companion.
        </div>
      </footer>
    </div>
  );
}
