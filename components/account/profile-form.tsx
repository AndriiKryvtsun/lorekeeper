"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { updateProfileSchema } from "@/lib/validation/profile";
import { api } from "~/trpc/react";

// Edit display name + bio. Validated client-side with the shared schema and re-validated by the
// server. Stored text is rendered as plain text elsewhere (never raw HTML).
export function ProfileForm({
  initial,
}: {
  initial: { displayName: string | null; bio: string | null };
}) {
  const form = useForm<typeof updateProfileSchema._input>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { displayName: initial.displayName ?? "", bio: initial.bio ?? "" },
  });
  const errors = form.formState.errors;
  const update = api.profile.updateMyProfile.useMutation({
    onSuccess: () => toast({ title: "Profile saved" }),
    onError: () => toast({ title: "Could not save profile", variant: "destructive" }),
  });

  const onSubmit = form.handleSubmit((values) => update.mutate(values));

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div className="space-y-1">
        <Label htmlFor="displayName">Display name</Label>
        <Input id="displayName" aria-invalid={!!errors.displayName} {...form.register("displayName")} />
        {errors.displayName ? (
          <p role="alert" className="text-sm text-destructive">{errors.displayName.message}</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" rows={3} aria-invalid={!!errors.bio} {...form.register("bio")} />
        {errors.bio ? (
          <p role="alert" className="text-sm text-destructive">{errors.bio.message}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
