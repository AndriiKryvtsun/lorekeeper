import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Landing } from "@/components/landing/landing";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

const TITLE = "LoreKeeper — your tabletop campaign companion";
const DESCRIPTION =
  "Organize your tabletop RPG campaigns, ask a grounded assistant about your own world, and keep every session's lore at your fingertips.";

// `/` is the only indexable page: it opts back into indexing (the rest of the app is
// `noindex` by default, set in the root layout) and supplies canonical + Open Graph/Twitter.
export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: "/",
      siteName: "LoreKeeper",
      type: "website",
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

// The single public entry point. The auth state is resolved on the SERVER so there is no
// client flash: authenticated users go straight to the dashboard; everyone else sees the
// public landing. No per-user data reaches the landing.
export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/campaigns");
  }
  return <Landing />;
}
