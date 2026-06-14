import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

// Renders model output as Markdown with a sanitizing rehype pass and NO rehype-raw, so raw
// HTML in the model output is never parsed/executed. `dangerouslySetInnerHTML` is never used.
export function SafeMarkdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{children}</ReactMarkdown>
    </div>
  );
}
