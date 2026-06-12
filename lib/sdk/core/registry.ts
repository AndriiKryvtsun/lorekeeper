// Generic provider registry. Isomorphic and env-agnostic: it knows only ids → adapters and
// a resolution order supplied via SelectionConfig. Server code derives that config from
// `~/env`; client code supplies client-safe config. This keeps the core pure/testable and
// makes "switch provider = config change, not caller-code change" true.

import {
  NoProviderConfiguredError,
  UnknownProviderError,
} from "@/lib/sdk/core/errors";
import type { ProviderId, SelectionConfig } from "@/lib/sdk/core/types";

export class Registry<TPort> {
  private readonly adapters = new Map<ProviderId, TPort>();

  constructor(private readonly capability: string) {}

  register(id: ProviderId, adapter: TPort): this {
    this.adapters.set(id, adapter);
    return this;
  }

  has(id: ProviderId): boolean {
    return this.adapters.has(id);
  }

  // Returns the adapter for an id, or throws a clear UnknownProviderError.
  get(id: ProviderId): TPort {
    const adapter = this.adapters.get(id);
    if (adapter === undefined) {
      throw new UnknownProviderError(
        `Unknown provider "${id}" for capability "${this.capability}"`,
        { capability: this.capability, providerId: id },
      );
    }
    return adapter;
  }

  // The active adapter for the given selection.
  resolve(selection: SelectionConfig): TPort {
    if (!selection || !selection.active) {
      throw new NoProviderConfiguredError(
        `No active provider configured for capability "${this.capability}"`,
        { capability: this.capability },
      );
    }
    return this.get(selection.active);
  }

  // Ordered provider ids: active first, then fallbacks (de-duplicated).
  order(selection: SelectionConfig): ProviderId[] {
    if (!selection || !selection.active) {
      throw new NoProviderConfiguredError(
        `No active provider configured for capability "${this.capability}"`,
        { capability: this.capability },
      );
    }
    return [...new Set([selection.active, ...(selection.fallback ?? [])])];
  }

  // Runs `fn` against the active provider, falling back to the next configured provider on
  // error. Rethrows the last error if every provider fails.
  async callWithFallback<R>(
    selection: SelectionConfig,
    fn: (adapter: TPort, id: ProviderId) => Promise<R>,
  ): Promise<R> {
    const ids = this.order(selection);
    let lastError: unknown;
    for (const id of ids) {
      const adapter = this.get(id);
      try {
        return await fn(adapter, id);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
}
