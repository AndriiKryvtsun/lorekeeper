// Shared SDK types. Isomorphic.

export type ProviderId = string;

// How a capability chooses its active provider and ordered fallbacks. On the server this
// is derived from `~/env` inside `lib/sdk/server`; on the client it is supplied from
// client-safe configuration.
export type SelectionConfig = {
  active: ProviderId;
  fallback?: ProviderId[];
};
