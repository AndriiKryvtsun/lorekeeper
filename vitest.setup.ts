// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveAttribute, …)
// with Vitest's expect. Harmless for node-environment tests; used by jsdom component tests.
import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia, which next-themes calls. Provide a minimal stub
// in DOM test environments only.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
