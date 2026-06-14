// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SafeMarkdown } from "@/components/assistant/safe-markdown";

describe("SafeMarkdown sanitization", () => {
  it("strips raw <script> tags from model output", () => {
    const { container } = render(
      <SafeMarkdown>{`Hello\n\n<script>alert('xss')</script>`}</SafeMarkdown>,
    );
    expect(container.querySelector("script")).toBeNull();
  });

  it("does not render raw HTML elements (img with onerror)", () => {
    const { container } = render(
      <SafeMarkdown>{`<img src=x onerror="alert(1)" />`}</SafeMarkdown>,
    );
    const img = container.querySelector("img");
    // Either the img is stripped entirely or has no event-handler attribute.
    expect(img?.getAttribute("onerror") ?? null).toBeNull();
  });

  it("renders ordinary markdown", () => {
    const { container } = render(<SafeMarkdown>{`**bold** text`}</SafeMarkdown>);
    expect(container.querySelector("strong")?.textContent).toBe("bold");
  });
});
