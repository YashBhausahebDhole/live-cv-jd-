import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { inferChatStyle } from "@/lib/chatStyle";

type FlaggedSection = {
  id: string;
  blockIndex: number;
  section: string;
  originalText: string;
  aiLikelihood: number;
  reason: string;
  humanRewrite: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  cvContext: string;
  jdContext: string;
  atsBefore: number;
  atsAfter: number;
  missingSkills: string[];
  flaggedSections: FlaggedSection[];
  rewrittenCv: string;
};

const quickPrompts = [
  "How can I improve my ATS score first?",
  "Which flagged sections should I prioritize?",
  "What interview questions should I prepare for?",
  "Does my rewritten CV still sound AI-generated?",
];

function Avatar({ role }: { role: "user" | "assistant" }) {
  if (role === "user") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
        You
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-sm font-bold text-white shadow-lg">
      AI
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
    </div>
  );
}

export default function ChatbotPanel({
  cvContext,
  jdContext,
  atsBefore,
  atsAfter,
  missingSkills,
  flaggedSections,
  rewrittenCv,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hey — I’m your AI career coach. Ask me about ATS score, flagged AI-like resume sections, missing skills, interview prep, or how to improve your rewritten CV.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const trimmedHistory = useMemo(
    () =>
      messages.filter((m) => !(m.role === "assistant" && m.content.startsWith("Hey —"))).slice(-10),
    [messages]
  );

  async function sendMessage(text?: string) {
    const finalText = (text ?? input).trim();
    if (!finalText || loading) return;

    setErr("");
    const userMessage: ChatMessage = { role: "user", content: finalText };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const userStyle = inferChatStyle(finalText);

      const response = await fetch("/api/llm/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: finalText,
          cvContext,
          jdContext,
          atsBefore,
          atsAfter,
          missingSkills,
          flaggedSections,
          rewrittenCv,
          userStyle,
          chatHistory: trimmedHistory,
        }),
      });

      const raw = await response.text();
      let json:
        | {
            success?: boolean;
            response?: string;
            error?: string;
          }
        | null = null;

      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`Server returned non-JSON response: ${raw.slice(0, 180)}`);
      }

      if (!response.ok || !json?.success || !json.response) {
        throw new Error(json?.error || "Chat request failed");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json.response!,
        },
      ]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-sky-100"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            ATS {atsBefore} → {atsAfter}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            Flagged {flaggedSections.length}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            Missing {missingSkills.length}
          </span>
        </div>
      </div>

      <div className="rounded-[30px] border border-white/60 bg-white/80 p-4 shadow-sm">
        <div className="max-h-[460px] space-y-4 overflow-auto pr-1">
          {messages.map((msg, index) => (
            <div
              key={`${msg.role}-${index}`}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && <Avatar role="assistant" />}

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`max-w-[82%] rounded-[26px] px-4 py-3 text-sm leading-6 shadow-sm ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-800 ring-1 ring-slate-200"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </motion.div>

              {msg.role === "user" && <Avatar role="user" />}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <Avatar role="assistant" />
              <div className="rounded-[26px] bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        {err && (
          <div className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
            {err}
          </div>
        )}

        <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about ATS score, missing skills, flagged AI sections, interview prep, or rewrite quality..."
            className="min-h-[100px] w-full resize-none border-0 bg-transparent text-sm text-slate-900 outline-none"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Kalik answers using your CV, JD, ATS, and flagged sections.
            </div>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Send
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}