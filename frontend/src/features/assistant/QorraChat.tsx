import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkle,
  ArrowUp,
  FileText,
  WarningCircle,
  Clock,
  User,
  ArrowsClockwise,
  Info,
  LightbulbFilament,
} from "@phosphor-icons/react";
import { assistantApi, type AssistantChatResponse } from "../../api/endpoints";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  isFallback?: boolean;
  timestamp: Date;
}

const SAMPLE_QUESTIONS = [
  "How do I apply for leave?",
  "Who approves travel requests?",
  "What tools does the design team use?",
];

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-semibold text-[#f7f8f8] mt-4 mb-2 first:mt-0 tracking-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold text-[#f7f8f8] mt-3.5 mb-1.5 first:mt-0 tracking-tight">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98] mt-3 mb-1 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-2 first:mt-0 last:mb-0 leading-relaxed text-[#d0d6e0]">
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
    <th className="px-3.5 py-2.5 font-semibold text-[#f7f8f8] border-b border-white/[0.08] text-xs uppercase tracking-wider bg-white/[0.03]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3.5 py-2.5 text-[#d0d6e0] leading-relaxed align-top">
      {children}
    </td>
  ),
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-mono text-[#f7f8f8] border border-white/[0.08]">
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
    <pre className="my-3 p-3 rounded-lg bg-[#08080a] border border-white/[0.08] overflow-x-auto text-xs font-mono text-[#f7f8f8]">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-indigo-500/50 pl-3.5 my-2.5 text-xs italic text-[#8a8f98] bg-white/[0.02] py-1.5 rounded-r">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-t border-white/[0.08] my-3.5" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors cursor-pointer"
    >
      {children}
    </a>
  ),
};

export const QorraChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm Qorra, your company onboarding & policy assistant. You can ask me anything about company policies, travel guidelines, tools, or onboarding workflows. All my answers are strictly grounded in your company's uploaded documents.",
      timestamp: new Date(),
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? inputQuestion).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuestion("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await assistantApi.chat(query);
      // Support both direct AssistantChatResponse and wrapped { data: AssistantChatResponse }
      const responseObj = response as unknown as Record<string, unknown>;
      const data: AssistantChatResponse =
        typeof responseObj.data === "object" &&
        responseObj.data !== null &&
        "answer" in responseObj.data
          ? (responseObj.data as AssistantChatResponse)
          : response;

      if (!data || typeof data.answer !== "string") {
        throw new Error(
          "Received invalid response structure from assistant service",
        );
      }

      const assistantMessage: ChatMessage = {
        id: `qorra-${crypto.randomUUID()}`,
        role: "assistant",
        content: data.answer,
        sources: data.sources || [],
        isFallback: Boolean(data.isFallback),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Unable to reach the assistant. Please try again.";

      setError(errorMessage);

      setMessages((prev) => [
        ...prev,
        {
          id: `qorra-err-${crypto.randomUUID()}`,
          role: "assistant",
          content:
            "The assistant is temporarily unavailable. Please try again in a moment or contact HR directly.",
          isFallback: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto w-full px-4 sm:px-6 select-text">
      {/* Top Header */}
      <div className="py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
            <Sparkle size={18} weight="fill" />
          </div> */}
          <div>
            <div className="flex items-center gap-2 pb-2">
              <h1 className="text-base font-medium text-[#f7f8f8] tracking-tight">
                Qorra AI Assistant
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Grounded RAG
              </span>
            </div>
            <p className="text-xs text-[#8a8f98]">
              Powered by company knowledge base • Zero hallucinations
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setMessages([
              {
                id: "welcome",
                role: "assistant",
                content:
                  "Conversation reset. How can I help you with company policies today?",
                timestamp: new Date(),
              },
            ])
          }
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.06] cursor-pointer"
          title="Start fresh conversation"
        >
          <ArrowsClockwise size={13} />
          <span>Clear Chat</span>
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6 scroll-smooth pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3.5 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {/* Assistant Avatar */}
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5 shadow-xs">
                <Sparkle size={15} weight="fill" />
              </div>
            )}

            {/* Message Bubble */}
            <div
              className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed transition-all ${
                msg.role === "user"
                  ? "bg-[#181a20] text-[#f7f8f8] border border-white/[0.08] shadow-sm rounded-tr-sm"
                  : msg.isFallback
                    ? "bg-amber-950/15 border border-amber-500/30 text-[#f7f8f8] rounded-tl-sm shadow-sm"
                    : "bg-[#0f1015] text-[#d0d6e0] border border-white/[0.06] rounded-tl-sm shadow-sm"
              }`}
            >
              {/* Fallback Banner Header if ungrounded / out of scope */}
              {msg.isFallback && (
                <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-amber-500/20 text-amber-400 text-xs font-medium">
                  <WarningCircle size={15} weight="fill" />
                  <span>Unverified in Knowledge Base</span>
                </div>
              )}

              {/* Message Content */}
              {msg.role === "user" ? (
                <div className="whitespace-pre-wrap select-text">
                  {msg.content}
                </div>
              ) : (
                <div className="select-text text-sm leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}

              {/* Source Document Citation Badges */}
              {msg.sources && msg.sources.length > 0 && !msg.isFallback && (
                <div className="mt-3.5 pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-[#8a8f98] font-medium flex items-center gap-1">
                    <FileText size={13} />
                    Sources cited:
                  </span>
                  {msg.sources.map((src, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/[0.08] text-xs font-mono text-[#d0d6e0] border border-white/[0.08] transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                      {src}
                    </span>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <div className="mt-2 text-[10px] text-[#5a5e6b] flex items-center justify-end gap-1">
                <Clock size={10} />
                <span>
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            {/* User Avatar */}
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[#d0d6e0] shrink-0 mt-0.5">
                <User size={14} />
              </div>
            )}
          </div>
        ))}

        {/* Loading / Generating State */}
        {isLoading && (
          <div className="flex gap-3.5 justify-start">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
              <Sparkle size={15} weight="fill" className="animate-pulse" />
            </div>
            <div className="bg-[#0f1015] border border-white/[0.06] rounded-2xl rounded-tl-sm p-4 text-xs text-[#8a8f98] flex items-center gap-2.5 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"></span>
                <span
                  className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></span>
                <span
                  className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                ></span>
              </div>
              <span className="font-mono text-[11px] text-[#a0a6b5]">
                Searching company documents & generating response
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Question Chips (PRD Questions) */}
      {messages.length <= 2 && (
        <div className="py-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-[#8a8f98] mb-2 font-medium">
            <LightbulbFilament size={13} className="text-amber-400" />
            <span>Suggested questions:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(q)}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.15] text-[#d0d6e0] hover:text-[#f7f8f8] transition-all text-left cursor-pointer disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Box Footer */}
      <div className="py-3 border-t border-white/[0.06] shrink-0">
        {error && (
          <div className="mb-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <WarningCircle size={14} />
              {error}
            </span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-400/80 hover:text-red-400 text-xs cursor-pointer font-medium"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="relative flex items-end bg-[#0e0f14] border border-white/[0.08] focus-within:border-white/25 rounded-xl transition-colors p-2.5 shadow-lg">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Qorra about company policies, leave, travel, or tools... (Enter to send)"
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-[#f7f8f8] placeholder-[#5a5e6b] resize-none outline-none max-h-32 px-1.5 py-1"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputQuestion.trim() || isLoading}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ml-2 cursor-pointer ${
              inputQuestion.trim() && !isLoading
                ? "bg-white text-black hover:bg-neutral-200"
                : "bg-white/[0.06] text-[#5a5e6b] cursor-not-allowed"
            }`}
            title="Send question"
          >
            <ArrowUp size={15} weight="bold" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-2 text-[11px] text-[#5a5e6b] px-1">
          <span className="flex items-center gap-1">
            <Info size={12} />
            Grounding is strictly enforced. Out-of-scope questions refer to HR.
          </span>
          <span>Shift + Enter for new line</span>
        </div>
      </div>
    </div>
  );
};
