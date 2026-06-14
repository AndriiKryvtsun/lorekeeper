// Avatar upload constraints, shared by client and server. Raster-only allow-list: SVG is
// rejected (stored-XSS risk) and so is any non-image type. Pure (no env/IO) so it runs on both.

export const AVATAR_ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export type AvatarMime = (typeof AVATAR_ALLOWED_MIME)[number];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export type AvatarValidation =
  | { ok: true; mime: AvatarMime }
  | { ok: false; reason: "type" | "size" };

export function isAllowedAvatarMime(type: string): type is AvatarMime {
  return (AVATAR_ALLOWED_MIME as readonly string[]).includes(type);
}

// Map an allowed MIME to a file extension (used to derive the server-side storage path).
export function avatarExtension(mime: AvatarMime): string {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}

export function validateAvatar(input: { type: string; size: number }): AvatarValidation {
  if (!isAllowedAvatarMime(input.type)) return { ok: false, reason: "type" };
  if (input.size <= 0 || input.size > AVATAR_MAX_BYTES) return { ok: false, reason: "size" };
  return { ok: true, mime: input.type };
}
