import type { NextApiRequest, NextApiResponse } from "next";
import { callGroq, extractTextContent, GROQ_MODEL } from "@/lib/llm-client";

type UserStyle = {
  tone?: "professional" | "casual" | "anxious" | "direct";
  responseLength?: "short" | "medium" | "long";
  confidenceLevel?: "low" | "medium" | "high";
};

type FlaggedSection = {
  id: string;
  section: string;
  originalText: string;
  aiLikelihood: number;
  reason: string;
  humanRewrite: string;
};

type ChatResponse =
  | {
      success: true;
      response: string;
      model: string;
    }
  | {
      success: false;
      error: string;
    };

function buildStyleInstructions(userStyle?: UserStyle) {
  const tone = userStyle?.tone ?? "casual";
  const responseLength = userStyle?.responseLength ?? "medium";
  const confidence = userStyle?.confidenceLevel ?? "medium";

  const toneInstruction =
    tone === "anxious"
      ? "Be calm, supportive, reassuring, and clear."
      : tone === "direct"
      ? "Be concise, direct, practical, and action-oriented."
      : tone === "professional"
      ? "Be polished, structured, and professional."
      : "Be natural, friendly, and helpful.";

  const lengthInstruction =
    responseLength === "short"
      ? "Keep the reply short, around 3 to 6 sentences or compact bullets."
      : responseLength === "long"
      ? "Give a detailed response with clear reasoning and step-by-step guidance."
      : "Keep the reply medium-length with enough detail to be useful.";

  const confidenceInstruction =
    confidence === "low"
      ? "The user may be uncertain. Reduce overwhelm, explain simply, and suggest the next best step."
      : confidence === "high"
      ? "The user sounds decisive. Focus on execution and results."
      : "Balance clarity with guidance.";

  return `${toneInstruction} ${lengthInstruction} ${confidenceInstruction}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "POST only" });
  }

  const {
    message,
    cvContext = "",
    jdContext = "",
    atsBefore,
    atsAfter,
    missingSkills = [],
    flaggedSections = [],
    rewrittenCv = "",
    userStyle,
    chatHistory = [],
  } = req.body as {
    message?: string;
    cvContext?: string;
    jdContext?: string;
    atsBefore?: number;
    atsAfter?: number;
    missingSkills?: string[];
    flaggedSections?: FlaggedSection[];
    rewrittenCv?: string;
    userStyle?: UserStyle;
    chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!message?.trim() || message.length > 2000) {
    return res.status(400).json({
      success: false,
      error: "Message is required and must be under 2000 characters.",
    });
  }

  try {
    const styleInstructions = buildStyleInstructions(userStyle);

    const compactFlagged = flaggedSections
      .slice(0, 5)
      .map(
        (item) =>
          `${item.section} | AI ${item.aiLikelihood}/100 | reason: ${item.reason} | rewrite: ${item.humanRewrite.slice(
            0,
            220
          )}`
      )
      .join("\n");

    const systemPrompt = `
You are an intelligent CV, ATS, JD, and interview coach inside a resume optimization app.

Your job:
- help the user improve their CV
- explain ATS scores
- explain missing skills
- explain which parts sound AI-generated
- guide them on how to improve rewritten content
- answer interview/job-fit questions using the provided CV/JD context
- be practical, accurate, and grounded in the supplied analysis
- do not invent experience or qualifications for the user

Behavior instructions:
${styleInstructions}

Ground truth context:
ATS before rewrite: ${typeof atsBefore === "number" ? atsBefore : "unknown"}
ATS after rewrite: ${typeof atsAfter === "number" ? atsAfter : "unknown"}
Missing skills: ${Array.isArray(missingSkills) ? missingSkills.slice(0, 15).join(", ") : "unknown"}

Flagged AI-like sections:
${compactFlagged || "None"}

CV context:
${cvContext.slice(0, 4000)}

JD context:
${jdContext.slice(0, 3000)}

Rewritten CV preview:
${rewrittenCv.slice(0, 3000)}

Rules:
- Prefer actionable answers over generic motivation
- If the user asks what to do next, prioritize the highest-impact improvement
- If asked about interview prep, tailor to missing skills and JD
- If asked whether something sounds AI-generated, explain why using the context
- If context is missing, say so briefly and still help
`.trim();

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...chatHistory.slice(-8).map((m) => ({
        role: m.role,
        content: m.content.slice(0, 1200),
      })),
      { role: "user" as const, content: message.trim() },
    ];

    const data = await callGroq(GROQ_MODEL.CHAT, messages, 1000, 0.5);
    const response = extractTextContent(data) || "Tell me what you want help with in your CV or JD.";

    return res.status(200).json({
      success: true,
      response,
      model: GROQ_MODEL.CHAT,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Chat unavailable right now.",
    });
  }
}