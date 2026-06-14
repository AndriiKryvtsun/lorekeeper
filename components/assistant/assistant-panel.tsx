"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

import { ProposalCard } from "@/components/assistant/proposal-card";
import { SafeMarkdown } from "@/components/assistant/safe-markdown";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  campaignId: string;
  open: boolean;
  onClose: () => void;
  // Called once when a reply finishes streaming (used by the launcher's unread indicator).
  onReplyComplete: () => void;
};

// The docked chat panel. PRESENTATION ONLY: it reuses the same `useChat` client and posts to
// the same `/api/assistant` endpoint (via the rewrite) as before — grounding, ownership, rate
// limits, budget, and sanitized rendering are unchanged. Default export so it can be loaded
// with `next/dynamic` on first open. Kept mounted after first open (visibility-toggled via
// `hidden`) so the conversation survives collapse/expand and in-app navigation.
export default function AssistantPanel({
  campaignId,
  open,
  onClose,
  onReplyComplete,
}: Props) {
  const { messages, sendMessage, status, error, clearError } = useChat();
  const [input, setInput] = useState("");
  // Completion-only announcement: SR users hear the finished reply once, not per token.
  const [announcement, setAnnouncement] = useState("");
  const prevStatus = useRef(status);
  const busy = status === "submitted" || status === "streaming";

  // Move focus to the input when the panel opens (no focus trap; page stays usable).
  useEffect(() => {
    if (open) {
      (document.getElementById("assistant-input") as HTMLInputElement | null)?.focus();
    }
  }, [open]);

  // Announce the latest assistant reply when streaming settles (status → "ready").
  useEffect(() => {
    if (prevStatus.current !== "ready" && status === "ready") {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        const text = last.parts
          .map((p) => (p.type === "text" ? p.text : ""))
          .join("");
        if (text) {
          setAnnouncement(text);
          onReplyComplete();
        }
      }
    }
    prevStatus.current = status;
  }, [status, messages, onReplyComplete]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text }, { body: { campaignId } });
  }

  return (
    <div
      id="assistant-panel"
      role="region"
      aria-label="Campaign assistant"
      hidden={!open}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-40 flex flex-col border-border bg-background pb-[env(safe-area-inset-bottom)] motion-safe:transition-opacity sm:inset-auto sm:bottom-20 sm:right-4 sm:h-[70vh] sm:w-[380px] sm:rounded-lg sm:border sm:shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Campaign assistant</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Close assistant"
          onClick={onClose}
        >
          Close
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <EmptyState
            title="Ask a question"
            description="Answers come only from this campaign's own data. You can also ask me to create, update, or delete an entity."
          />
        ) : (
          messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            const proposals = m.parts.filter((p) => p.type === "data-proposal");
            return (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "rounded-md bg-secondary p-3"
                    : "rounded-md border border-border p-3"
                }
              >
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {m.role === "user" ? "You" : "Assistant"}
                </p>
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap">{text}</p>
                ) : (
                  <SafeMarkdown>{text}</SafeMarkdown>
                )}
                {proposals.map((p, i) => (
                  <div key={i} className="mt-3">
                    <ProposalCard raw={(p as { data: unknown }).data} />
                  </div>
                ))}
              </div>
            );
          })
        )}
        {busy ? <p className="text-sm text-muted-foreground">Thinking…</p> : null}
      </div>

      {error ? (
        <div className="px-4">
          <ErrorState
            title="Assistant error"
            description="Something went wrong. Please try again."
            onRetry={clearError}
          />
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-3">
        <label htmlFor="assistant-input" className="sr-only">
          Your message
        </label>
        <Input
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this campaign…"
          autoComplete="off"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || input.trim().length === 0}>
          Send
        </Button>
      </form>

      {/* Completion-only live region (announces the finished reply once, not per token). */}
      <div aria-live="polite" role="log" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
