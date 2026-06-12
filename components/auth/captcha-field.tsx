"use client";

import { Turnstile } from "@marsidev/react-turnstile";

import { env } from "~/env";

// Cloudflare Turnstile widget. Reports the token to the parent form; clears it on
// expiry/error so the action fails closed without a fresh token. Falls back to the
// Turnstile always-pass test key when no site key is configured (dev/test).
const TEST_SITE_KEY = "1x00000000000000000000AA";

export function CaptchaField({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? TEST_SITE_KEY;
  return (
    <Turnstile
      siteKey={siteKey}
      onSuccess={onToken}
      onExpire={() => onToken("")}
      onError={() => onToken("")}
    />
  );
}
