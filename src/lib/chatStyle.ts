export type ChatTone = "professional" | "casual" | "anxious" | "direct";
export type ChatLength = "short" | "medium" | "long";
export type ConfidenceLevel = "low" | "medium" | "high";

export type UserChatStyle = {
  tone: ChatTone;
  responseLength: ChatLength;
  confidenceLevel: ConfidenceLevel;
};

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function inferChatStyle(message: string): UserChatStyle {
  const lower = message.toLowerCase();
  const words = countWords(message);

  const anxiousSignals = [
    "scared",
    "worried",
    "anxious",
    "nervous",
    "confused",
    "help me",
    "i don't know",
    "not sure",
    "stress",
    "afraid",
  ];

  const directSignals = [
    "fix this",
    "what next",
    "tell me",
    "give me",
    "just",
    "now",
    "fast",
    "quick",
  ];

  const professionalSignals = [
    "please advise",
    "could you",
    "interview",
    "resume",
    "cv",
    "job description",
    "ats",
    "improve",
    "recommend",
  ];

  const hasAnxious = anxiousSignals.some((s) => lower.includes(s));
  const hasDirect = directSignals.some((s) => lower.includes(s));
  const hasProfessional = professionalSignals.some((s) => lower.includes(s));

  let tone: ChatTone = "casual";
  if (hasAnxious) tone = "anxious";
  else if (hasDirect || words <= 5) tone = "direct";
  else if (hasProfessional) tone = "professional";

  let responseLength: ChatLength = "medium";
  if (words <= 6) responseLength = "short";
  else if (words >= 25) responseLength = "long";

  let confidenceLevel: ConfidenceLevel = "medium";
  if (hasAnxious || lower.includes("?") || lower.includes("not sure")) confidenceLevel = "low";
  else if (lower.includes("do this") || lower.includes("i want") || lower.includes("let's")) confidenceLevel = "high";

  return {
    tone,
    responseLength,
    confidenceLevel,
  };
}