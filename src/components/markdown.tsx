import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../lib/utils";

const inline = ["strong", "em", "del", "code", "a", "img"];
const description = [...inline, "p", "br", "h1", "h2", "blockquote", "pre", "ul", "ol", "li"];
const note = [...description, "h3", "table", "thead", "tbody", "tr", "th", "td", "input", "hr"];

const allowedElements = { inline, description, note };

export type MarkdownLevel = keyof typeof allowedElements;

const link: Components["a"] = ({ node: _node, ...props }) => (
  <a {...props} target="_blank" rel="noopener noreferrer" />
);

const image: Components["img"] = ({ node: _node, ...props }) => (
  <img {...props} loading="lazy" referrerPolicy="no-referrer" />
);

const altText: Components["img"] = ({ alt }) => alt;

export function Markdown({
  children,
  level,
  className,
}: {
  children: string;
  level: MarkdownLevel;
  className?: string;
}) {
  const markdown = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      allowedElements={allowedElements[level]}
      unwrapDisallowed
      skipHtml
      components={{ a: link, img: level === "inline" ? altText : image }}
    >
      {children}
    </ReactMarkdown>
  );
  return level === "inline" ? (
    markdown
  ) : (
    <div className={cn("markdown", className)}>{markdown}</div>
  );
}
