// Same-origin check for state-changing route handlers (defense-in-depth alongside Server
// Actions' built-in CSRF protection). Browsers send `Origin` on cross-site state-changing
// requests; a missing or mismatched Origin is rejected.
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
