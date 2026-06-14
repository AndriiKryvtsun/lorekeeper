"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The panel (and its useChat client) is loaded only on first open. Eager launcher, lazy panel.
const AssistantPanel = dynamic(
  () => import("@/components/assistant/assistant-panel"),
  { ssr: false },
);

const LAUNCHER_CLASS =
  "fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg mb-[env(safe-area-inset-bottom)]";

// Docked, campaign-scoped assistant launcher. Mounted in the authenticated app shell; enabled
// ONLY within a campaign route (campaignId from the route). Holds open/closed + unread state at
// the shell level so it persists across in-app navigation; the panel is keyed by campaignId so
// switching campaigns resets the conversation. Non-modal disclosure — never traps focus.
export function AssistantWidget() {
  const params = useParams();
  const raw = params?.campaignId;
  const campaignId = typeof raw === "string" ? raw : undefined;

  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [unread, setUnread] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // Reset transient widget state when the active campaign changes (the panel also remounts via
  // its key, clearing the conversation).
  useEffect(() => {
    setOpen(false);
    setHasOpened(false);
    setUnread(false);
  }, [campaignId]);

  // Outside a campaign route: a disabled launcher with a hint (kept visible for discoverability).
  if (!campaignId) {
    return (
      <button
        type="button"
        disabled
        aria-disabled
        title="Open a campaign to use the assistant"
        aria-label="Campaign assistant (open a campaign to use it)"
        className={cn(buttonVariants({ size: "icon" }), LAUNCHER_CLASS)}
      >
        <span aria-hidden>💬</span>
      </button>
    );
  }

  function openPanel() {
    setHasOpened(true);
    setOpen(true);
    setUnread(false);
  }

  function closePanel() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  return (
    <>
      {hasOpened ? (
        <AssistantPanel
          key={campaignId}
          campaignId={campaignId}
          open={open}
          onClose={closePanel}
          onReplyComplete={() => {
            if (!open) setUnread(true);
          }}
        />
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        aria-expanded={open}
        aria-controls="assistant-panel"
        aria-label={
          unread ? "Open campaign assistant, new reply" : "Open campaign assistant"
        }
        onClick={() => (open ? closePanel() : openPanel())}
        className={cn(buttonVariants({ size: "icon" }), LAUNCHER_CLASS)}
      >
        <span aria-hidden>💬</span>
        {unread ? (
          <span
            aria-hidden
            className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-background bg-destructive"
          />
        ) : null}
      </button>
    </>
  );
}
