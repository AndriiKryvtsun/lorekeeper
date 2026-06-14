"use client";

import { Turnstile } from "@marsidev/react-turnstile";

// Cloudflare Turnstile widget. Reports the token to the parent form; clears it on
// expiry/error so the action fails closed without a fresh token. Falls back to the
// Turnstile always-pass test key when no site key is configured (dev/test).
const TEST_SITE_KEY = "1x00000000000000000000AA";

// Read the public site key directly from `process.env` (Next inlines NEXT_PUBLIC_* statically).
// We deliberately avoid the `~/env` proxy here: this var is OPTIONAL, so when it is unset Next
// does not inline it and t3-env's client proxy cannot tell an absent optional client var from a
// server var — accessing it via `env` then throws "server-side env var on the client".
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? TEST_SITE_KEY;

export function CaptchaField({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const siteKey = SITE_KEY;
  return (
    <Turnstile
      siteKey={siteKey}
      onSuccess={onToken}
      onExpire={() => onToken("")}
      onError={() => onToken("")}
    />
  );
}
