export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqChoice = {
  message: {
    role?: string;
    content?: string;
  };
  finish_reason?: string | null;
};

type GroqResponse = {
  choices: GroqChoice[];
};

function getGroqApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY in environment variables.");
  }
  return apiKey;
}

export async function callGroq(
  model: string = "llama-3.3-70b-versatile",
  messages: LlmMessage[],
  maxTokens: number = 2000,
  temperature: number = 0.7
): Promise<GroqResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getGroqApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${rawText}`);
    }

    const data = JSON.parse(rawText) as {
      choices?: Array<{
        message?: { role?: string; content?: string };
        finish_reason?: string | null;
      }>;
    };

    if (!data.choices?.length) {
      throw new Error("Groq API returned no choices.");
    }

    return {
      choices: [
        {
          message: data.choices[0].message ?? { content: "" },
          finish_reason: data.choices[0].finish_reason ?? null,
        },
      ],
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function extractTextContent(data: GroqResponse): string {
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export function tryParseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return fallback;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return fallback;
    }
  }
}

export const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
] as const;

export const GROQ_MODEL = {
  CHAT: "llama-3.3-70b-versatile",
  REWRITE: "llama-3.3-70b-versatile",
  ANALYZE: "llama-3.3-70b-versatile",
} as const;

export type GroqModel = (typeof GROQ_MODELS)[number];