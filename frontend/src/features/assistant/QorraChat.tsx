import React, { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  FileText,
  WarningCircle,
  ArrowsClockwise,
  CalendarBlank,
  AirplaneTilt,
  Wrench,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
} from "@phosphor-icons/react";
import { assistantApi, type AssistantChatResponse } from "../../api/endpoints";
import { MarkdownRenderer } from "../../components/common/MarkdownRenderer";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  isFallback?: boolean;
  timestamp: Date;
}

const EXAMPLE_PROMPTS = [
  {
    icon: CalendarBlank,
    title: "Leave & PTO Policy",
    description: "How do I apply for annual, sick, or personal time off?",
    query: "How do I apply for annual or sick leave?",
  },
  {
    icon: AirplaneTilt,
    title: "Travel & Expenses",
    description: "Who approves travel requests and expense reimbursements?",
    query: "Who approves travel requests and expense reimbursements?",
  },
  {
    icon: Wrench,
    title: "Tools & Equipment",
    description: "What software and hardware does my department provide?",
    query: "What tools and software does my department use?",
  },
];

export const QorraChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Streaming text simulation state
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [streamedLength, setStreamedLength] = useState<number>(0);

  // Message feedback & copy tracking
  const [feedback, setFeedback] = useState<
    Record<string, "up" | "down" | null>
  >({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamIntervalRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, streamedLength]);

  // Handle streaming text animation
  useEffect(() => {
    if (!streamingMsgId) return;

    const currentMsg = messages.find((m) => m.id === streamingMsgId);
    if (!currentMsg) {
      setStreamingMsgId(null);
      return;
    }

    const fullText = currentMsg.content;
    if (streamedLength >= fullText.length) {
      setStreamingMsgId(null);
      return;
    }

    // Advance streaming by ~4-6 characters every 16ms
    const timer = window.setTimeout(() => {
      setStreamedLength((prev) => Math.min(fullText.length, prev + 5));
    }, 16);

    return () => clearTimeout(timer);
  }, [streamingMsgId, streamedLength, messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? inputQuestion).trim();
    if (!query || isLoading) return;

    // If currently streaming, finish stream immediately
    if (streamingMsgId) {
      setStreamingMsgId(null);
    }

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

      const newId = `qorra-${crypto.randomUUID()}`;
      const assistantMessage: ChatMessage = {
        id: newId,
        role: "assistant",
        content: data.answer,
        sources: data.sources || [],
        isFallback: Boolean(data.isFallback),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Trigger streaming effect for new assistant answer
      setStreamingMsgId(newId);
      setStreamedLength(0);
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

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const handleFeedback = (id: string, type: "up" | "down") => {
    setFeedback((prev) => ({
      ...prev,
      [id]: prev[id] === type ? null : type,
    }));
  };

  const handleResetChat = () => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    setStreamingMsgId(null);
    setMessages([]);
    setInputQuestion("");
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full w-full select-text font-sans overflow-hidden">
      {/* Header bar (subtle & quiet) */}
      <header className="px-6 sm:px-8 py-2.5 flex items-center justify-between shrink-0">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
          {/* <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[#14161a] border border-white/[0.08] flex items-center justify-center text-[#f7f8f8]">
              <Sparkle size={14} weight="bold" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#f7f8f8] tracking-tight">
                Qorra
              </span>
              <span className="text-[#3a3f4a]">•</span>
              <span className="text-[11px] text-[#8a8f98]">Workspace AI</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                Grounded
              </span>
            </div>
          </div> */}

          {hasMessages && (
            <button
              type="button"
              onClick={handleResetChat}
              className="flex items-center gap-1.5 px-2 py-2 rounded-md text-xs text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-white/[0.04] transition-colors cursor-pointer ml-auto"
              title="Start fresh conversation"
            >
              <ArrowsClockwise size={13} />
              <span>New Chat</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Message Stream — Dedicated Scroll Container */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth px-6 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto w-full flex flex-col min-h-full">
          {!hasMessages ? (
            /* ============================================================== */
            /* EMPTY STATE (Reference Image 2 — Welcome to Qorra / Linear Style) */
            /* ============================================================== */
            <div className="my-auto flex flex-col items-center justify-center text-center animate-fade-up max-w-xl mx-auto w-full py-8">
              {/* Ambient Watermark Icon */}

              <h1 className="text-2xl font-medium tracking-tight text-[#f7f8f8] mb-1.5">
                Welcome to Qorra
              </h1>
              <p className="text-sm text-[#8a8f98] mb-8 max-w-md leading-relaxed">
                Ask anything about company onboarding, policies, leave
                guidelines, or internal workflows.
              </p>

              {/* Central Fully Rounded Chatbox */}
              <div className="w-full bg-[#0f1013] border border-white/[0.08] hover:border-white/[0.14] focus-within:border-white/[0.25] rounded-3xl p-3.5 sm:p-4 text-left transition-all duration-200 shadow-sm focus-within:shadow-md mb-8">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Qorra..."
                  className="w-full bg-transparent text-sm text-[#f7f8f8] placeholder-[#5a5e6b] resize-none outline-none px-1 py-0.5 leading-relaxed"
                />

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.03] mt-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#8a8f98]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Company Knowledge Base</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputQuestion.trim() || isLoading}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer ${
                      inputQuestion.trim() && !isLoading
                        ? "bg-white text-black hover:bg-[#e2e4e9] shadow-xs active:scale-90"
                        : "bg-white/[0.06] text-[#5a5e6b] cursor-not-allowed"
                    }`}
                    title="Send message"
                  >
                    <ArrowUp size={14} weight="bold" />
                  </button>
                </div>
              </div>

              {/* Example Prompts Grid (Reference Image 2) */}
              <div className="w-full text-left">
                <div className="flex items-center justify-between text-xs text-[#8a8f98] mb-3 px-1">
                  <span>Get started with some examples</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {EXAMPLE_PROMPTS.map((item, idx) => {
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(item.query)}
                        className="group p-4 rounded-xl bg-[#0f1013] border border-white/[0.06] hover:border-white/[0.16] hover:bg-[#14161a] transition-all duration-200 text-left cursor-pointer flex flex-col justify-between gap-3 shadow-2xs hover:-translate-y-0.5"
                      >
                        <div className="text-[#8a8f98] group-hover:text-[#f7f8f8] transition-colors">
                          <IconComponent size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#f7f8f8] tracking-tight group-hover:text-white transition-colors">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-[#8a8f98] mt-1 line-clamp-2 leading-relaxed">
                            {item.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* ACTIVE CHAT STREAM (Reference Image 1)                          */
            /* ============================================================== */
            <div className="space-y-6 pb-24">
              {/* Top Centered Timestamp Header */}
              <div className="text-center my-2">
                <span className="text-[11px] text-[#5a5e6b] font-normal tracking-wide">
                  Today {formatTimestamp(messages[0]?.timestamp || new Date())}
                </span>
              </div>

              {messages.map((msg) => (
                <div key={msg.id} className="animate-fade-up">
                  {msg.role === "user" ? (
                    /* User Message: Clean rounded bubble on the right */
                    <div className="flex justify-end">
                      <div className="max-w-md sm:max-w-lg bg-[#181a20] text-[#f7f8f8] text-sm px-4 py-2.5 rounded-2xl rounded-tr-md shadow-xs leading-relaxed select-text whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    /* Assistant Message: Clean typography directly on canvas */
                    <div className="flex flex-col gap-2 max-w-2xl py-1">
                      {/* Fallback Unverified Banner */}
                      {msg.isFallback && (
                        <div className="flex items-center gap-2 py-1 text-amber-400 text-xs font-medium">
                          <WarningCircle size={14} weight="fill" />
                          <span>
                            Unverified in knowledge base • Verified with HR
                          </span>
                        </div>
                      )}

                      {/* Assistant Text Content */}
                      <div className="text-sm leading-relaxed text-[#ededef] select-text">
                        {streamingMsgId === msg.id ? (
                          <div>
                            <MarkdownRenderer
                              content={msg.content.slice(0, streamedLength)}
                            />
                            <span className="inline-block w-1.5 h-3.5 bg-[#f7f8f8] ml-0.5 align-middle animate-cursor" />
                          </div>
                        ) : (
                          <MarkdownRenderer content={msg.content} />
                        )}
                      </div>

                      {/* Source Document Citation Badges */}
                      {msg.sources &&
                        msg.sources.length > 0 &&
                        !msg.isFallback && (
                          <div className="pt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-[#5a5e6b] flex items-center gap-1 mr-1">
                              <FileText size={12} />
                              Sources:
                            </span>
                            {msg.sources.map((src, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] text-[11px] font-sans text-[#8a8f98] border border-white/[0.06]"
                              >
                                <span className="w-1 h-1 rounded-full bg-emerald-400" />
                                {src}
                              </span>
                            ))}
                          </div>
                        )}

                      {/* Action Bar (ThumbsUp, ThumbsDown, Copy) — Reference Image 1 */}
                      {streamingMsgId !== msg.id && (
                        <div className="flex items-center gap-3 pt-2 text-[#5a5e6b]">
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "up")}
                            className={`p-1 rounded hover:text-[#f7f8f8] transition-colors cursor-pointer ${
                              feedback[msg.id] === "up" ? "text-white" : ""
                            }`}
                            title="Helpful"
                          >
                            <ThumbsUp
                              size={14}
                              weight={
                                feedback[msg.id] === "up" ? "fill" : "regular"
                              }
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedback(msg.id, "down")}
                            className={`p-1 rounded hover:text-[#f7f8f8] transition-colors cursor-pointer ${
                              feedback[msg.id] === "down" ? "text-white" : ""
                            }`}
                            title="Not helpful"
                          >
                            <ThumbsDown
                              size={14}
                              weight={
                                feedback[msg.id] === "down" ? "fill" : "regular"
                              }
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="p-1 rounded hover:text-[#f7f8f8] transition-colors cursor-pointer flex items-center gap-1"
                            title="Copy response"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check size={14} className="text-emerald-400" />
                                <span className="text-[10px] text-emerald-400">
                                  Copied
                                </span>
                              </>
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking / Searching Documents Animation */}
              {isLoading && (
                <div className="flex items-center gap-2.5 text-xs text-[#8a8f98] animate-fade-up py-2">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#8a8f98] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 rounded-full bg-[#8a8f98] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-[#8a8f98] animate-bounce" />
                  </div>
                  <span className="text-sm font-sans text-[#5a5e6b]">
                    Searching workspace documents & drafting response...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* FULLY ROUNDED BOTTOM CHATBOX (Docked at bottom, NOT absolute!)  */}
      {/* ============================================================== */}
      {hasMessages && (
        <div className="shrink-0 px-6 sm:px-8 pt-2 pb-5 bg-[#090a0c]">
          <div className="max-w-3xl mx-auto w-full">
            {error && (
              <div className="mb-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center justify-between">
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

            {/* Fully rounded chatbox */}
            <div className="bg-[#0f1013] border border-white/[0.08] hover:border-white/[0.14] focus-within:border-white/[0.25] rounded-3xl p-3 sm:p-3.5 transition-all duration-200">
              <textarea
                ref={inputRef}
                rows={1}
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Reply..."
                disabled={isLoading}
                className="w-full bg-transparent text-sm text-[#f7f8f8] placeholder-[#5a5e6b] resize-none outline-none px-2 py-1 max-h-32 leading-relaxed"
              />

              <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.03] mt-1.5 px-1">
                <div className="flex items-center gap-1.5 text-[11px] text-[#5a5e6b]">
                  {/* <span className="w-2 h-2 rounded-full bg-emerald-400/80" /> */}
                  <span>Grounded in company docs</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#5a5e6b] hidden sm:inline">
                    Enter to send
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputQuestion.trim() || isLoading}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer ${
                      inputQuestion.trim() && !isLoading
                        ? "bg-white text-black hover:bg-[#e2e4e9] shadow-xs active:scale-90"
                        : "bg-white/[0.06] text-[#5a5e6b] cursor-not-allowed"
                    }`}
                    title="Send message"
                  >
                    <ArrowUp size={14} weight="bold" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
