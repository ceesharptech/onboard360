import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export const defaultMarkdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-semibold text-[#f7f8f8] mt-3.5 mb-2 first:mt-0 tracking-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold text-[#f7f8f8] mt-3 mb-1.5 first:mt-0 tracking-tight">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98] mt-2.5 mb-1 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed text-[#d0d6e0]">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[#f7f8f8]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-[#d0d6e0]">{children}</em>,
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-5 my-2 space-y-1 text-[#d0d6e0]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-5 my-2 space-y-1 text-[#d0d6e0]">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed text-[#d0d6e0] pl-0.5">{children}</li>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-lg border border-white/[0.08] bg-[#0c0d11]">
      <table className="min-w-full divide-y divide-white/[0.08] text-xs text-left">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-white/[0.03] text-[#f7f8f8]">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-white/[0.04]">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-white/[0.02] transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 font-semibold text-[#f7f8f8] border-b border-white/[0.08] text-xs uppercase tracking-wider bg-white/[0.03]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-[#d0d6e0] leading-relaxed align-top">
      {children}
    </td>
  ),
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[11px] font-mono text-[#f7f8f8] border border-white/[0.08]">
          {children}
        </code>
      );
    }
    return (
      <code className={`font-mono text-xs text-[#f7f8f8] ${className || ""}`}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2.5 p-3 rounded-lg bg-[#08080a] border border-white/[0.08] overflow-x-auto text-xs font-mono text-[#f7f8f8]">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-indigo-500/50 pl-3.5 my-2 text-xs italic text-[#8a8f98] bg-white/[0.02] py-1.5 rounded-r">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),
};

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "",
}) => {
  if (!content) return null;

  return (
    <div className={`text-xs text-[#d0d6e0] leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={defaultMarkdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
