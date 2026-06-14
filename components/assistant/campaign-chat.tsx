"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

import { ProposalCard } from "@/components/assistant/proposal-card";
import { SafeMarkdown } from "@/components/assistant/safe-markdown";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Grounded campaign Q&A chat. Posts to /api/assistant with the campaignId; renders assistant
// responses through the sanitizing markdown renderer (never raw HTML).
export function CampaignChat({ campaignId }: { campaignId: string }) {
  // No transport/api set: useChat uses its default transport (posts to /api/chat), which a
  // Next.js rewrite maps to /api/assistant. Keeps the AI SDK transport out of our client code.
  const { messages, sendMessage, status, error, clearError } = useChat();
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text }, { body: { campaignId } });
  }

  return (
    <section aria-label="Campaign assistant" className="space-y-4">
      <h2 className="text-lg font-semibold">Ask the campaign</h2>

      <div role="log" aria-live="polite" className="space-y-3">
        {messages.length === 0 ? (
          <EmptyState
            title="Ask a question"
            description="Answers come only from this campaign's own data."
          />
        ) : (
          messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            // Typed `data-proposal` parts carry a write proposal rendered as a confirm card.
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
        {busy ? (
          <p className="text-sm text-muted-foreground">Thinking…</p>
        ) : null}
      </div>

      {error ? (
        <ErrorState
          title="Assistant error"
          description="Something went wrong. Please try again."
          onRetry={clearError}
        />
      ) : null}

      <form onSubmit={onSubmit} className="flex gap-2">
        <label htmlFor="assistant-input" className="sr-only">
          Your question
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
          Ask
        </Button>
      </form>
    </section>
  );
}
