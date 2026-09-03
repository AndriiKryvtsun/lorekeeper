"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

import { ProposalCard } from "@/components/assistant/proposal-card";
import { SafeMarkdown } from "@/components/assistant/safe-markdown";
import { SourceChoice } from "@/components/enrichment/source-choice";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ENVELOPE_PART,
  isRetryableEnvelope,
  type ActionEnvelope,
  type PendingAction,
} from "@/lib/validation/assistant-actions";
import { MAX_HISTORY_TURNS } from "@/lib/validation/assistant";

// The enrichment source choice arrives as a clarification OPTION rather than its own outcome:
// it is a question with a fixed set of answers and nothing confirmable. Its payload is what
// SourceChoice already consumes, so the draft-review flow below it is unchanged.
type SourceChoiceData = {
  kind: "npc" | "character";
  campaignId: string;
  query: string;
  recommended: "srd-likely" | "original" | "ambiguous";
};

const ENRICHMENT_SOURCE_OPTION = "enrichment-source";

// The unfinished write to continue, taken from the MOST RECENT envelope. Deriving it from the
// messages rather than storing it means a proposal, a success, or an error clears it on its own —
// there is no stale client state to resurrect an abandoned write.
function pendingFromMessages(
  messages: { parts: { type: string; data?: unknown }[] }[],
): PendingAction | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const envelopes = messages[i]!.parts.filter((p) => p.type === ENVELOPE_PART);
    const latest = envelopes.at(-1);
    if (!latest) continue;
    const envelope = latest.data as ActionEnvelope;
    return envelope.outcome === "clarification" ? envelope.pending : undefined;
  }
  return undefined;
}

// The write path's envelope, carried by the one typed stream part. Rendering is driven by
// `outcome` — never by parsing the assistant's text.
function EnvelopeView({ envelope }: { envelope: ActionEnvelope }) {
  switch (envelope.outcome) {
    case "proposal":
      return (
        <div className="mt-3">
          <ProposalCard raw={envelope.proposal} generated={envelope.generated} />
        </div>
      );
    case "clarification": {
      const source = envelope.options?.find((o) => o.id === ENRICHMENT_SOURCE_OPTION);
      // The question itself is the assistant's text; only an option set needs rendering.
      if (!source) return null;
      return <SourceChoice {...(source.data as unknown as SourceChoiceData)} />;
    }
    case "success":
      return (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {envelope.entity} “{envelope.title}” was saved.
        </p>
      );
    case "validation_error":
    case "operation_error":
    case "transport_error":
      // The message is already shown as the assistant's text; this is the accessible alert.
      return (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {envelope.message}
        </p>
      );
    default:
      // An outcome this client does not know: show a generic error and offer nothing
      // confirmable. Never treated as success.
      return (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Something went wrong, so nothing was changed.
        </p>
      );
  }
}

// Starter prompts shown in the empty state. They double as guidance on how to phrase requests:
// a grounded question, an SRD lookup (by creature name), and an original generation. Clicking
// one fills the input so the user can edit and send.
const EXAMPLE_PROMPTS = [
  "Who are the NPCs in this campaign?",
  "Add a goblin",
  "Create an original NPC: a nervous harbor guard named Sela",
] as const;

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
  const { messages, sendMessage, regenerate, status, error, clearError } = useChat();
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
    // Send a BOUNDED tail of the conversation, plus this message. The server needs the recent
    // turns so an answer to a clarification can continue the same write, but it rejects an
    // over-long list — so the window is capped here and the panel keeps showing everything.
    const history = [
      ...messages.slice(-MAX_HISTORY_TURNS).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.parts.map((p) => (p.type === "text" ? p.text : "")).join(""),
      })),
      { role: "user", content: text },
    ];
    // If the last reply asked a question, send back the write it belongs to so this answer
    // continues it instead of being classified afresh.
    const pending = pendingFromMessages(messages);
    void sendMessage(
      { text },
      { body: { campaignId, history, ...(pending ? { pending } : {}) } },
    );
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
          <div className="space-y-4">
            <EmptyState
              title="Ask about your campaign"
              description="I answer only from this campaign's own data. I can also add an NPC or character — name a known creature and I'll look it up in the open SRD, or describe an original one and I'll draft it. Nothing is saved until you confirm."
            />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Try asking:</p>
              <ul className="space-y-1">
                {EXAMPLE_PROMPTS.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      onClick={() => setInput(example)}
                      className="w-full rounded-md border border-border px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            // Every write-path outcome arrives as this one part.
            const envelopes = m.parts
              .filter((p) => p.type === ENVELOPE_PART)
              .map((p) => (p as { data: ActionEnvelope }).data);
            const retryable = envelopes.some(isRetryableEnvelope);
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
                {envelopes.map((envelope, i) => (
                  <EnvelopeView key={`env-${i}`} envelope={envelope} />
                ))}
                {retryable ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={busy}
                    onClick={() => void regenerate()}
                  >
                    Try again
                  </Button>
                ) : null}
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
          placeholder="Ask a question, or add an NPC (e.g. “add a goblin”)…"
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
