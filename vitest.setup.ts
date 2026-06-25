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

// jsdom lacks several APIs that Radix's Popper (dropdown/select positioning) and pointer
// interactions rely on. Provide minimal stubs so menu components can be tested.
if (typeof window !== "undefined") {
  const g = globalThis as typeof globalThis & {
    ResizeObserver?: typeof ResizeObserver;
  };
  if (!g.ResizeObserver) {
    g.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
}
