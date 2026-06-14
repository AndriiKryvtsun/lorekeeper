"use client";

import Image from "next/image";
import { useState } from "react";

import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { validateAvatar } from "@/lib/validation/avatar";
import { api } from "~/trpc/react";

// Re-encode the selected image to WebP via a canvas. This strips EXIF metadata (the canvas
// pipeline carries no metadata) and normalizes the format — no image-processing dependency.
async function reencodeToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9),
  );
  if (!blob) throw new Error("Encoding failed");
  return blob;
}

// Avatar upload. Validates type/size on the client (raster-only, SVG rejected), strips EXIF by
// re-encoding, uploads to the user's OWN folder in the `avatars` bucket (bucket RLS enforces
// the folder), then asks the server to store the URL (server re-validates + derives the path).
export function AvatarUploader({
  userId,
  initialUrl,
}: {
  userId: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const setAvatar = api.profile.setAvatar.useMutation();

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const check = validateAvatar({ type: file.type, size: file.size });
    if (!check.ok) {
      toast({
        title:
          check.reason === "type"
            ? "Only PNG, JPEG, or WebP images are allowed"
            : "Image is too large (max 2 MB)",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      const webp = await reencodeToWebp(file);
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.storage
        .from("avatars")
        .upload(`${userId}/avatar.webp`, webp, { upsert: true, contentType: "image/webp" });
      if (error) throw error;
      const profile = await setAvatar.mutateAsync({ contentType: "image/webp" });
      // Cache-bust so the refreshed image shows immediately.
      setUrl(profile.avatarUrl ? `${profile.avatarUrl}?v=${Date.now()}` : null);
      toast({ title: "Avatar updated" });
    } catch {
      toast({ title: "Could not upload avatar", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-secondary">
        {url ? (
          <Image src={url} alt="Your avatar" width={64} height={64} unoptimized />
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor="avatar-input">Avatar</Label>
        <input
          id="avatar-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={onChange}
          className="block text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {busy ? "Uploading…" : "PNG, JPEG, or WebP. Max 2 MB."}
        </p>
      </div>
    </div>
  );
}
