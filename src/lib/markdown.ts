import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

/** Renders Markdown to sanitized HTML safe for v-html. */
export function renderMarkdown(source: string | null | undefined): string {
  if (!source) return "";
  const raw = md.render(source);
  return DOMPurify.sanitize(raw);
}
