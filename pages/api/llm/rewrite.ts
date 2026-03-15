import type { NextApiRequest, NextApiResponse } from "next";
import { callGroq, extractTextContent, GROQ_MODEL, tryParseJson } from "@/lib/llm-client";

type RewriteSuccess = {
  rewritten: string;
  improvements: string[];
  confidence: number;
  keywordMatches: number;
  wordCount: { original: number; rewritten: number };
  model: string;
};

type RewriteError = { error: string };

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RewriteSuccess | RewriteError>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { cvSection, jdKeywords = [], genaiScore = 0 } = req.body as {
    cvSection?: string;
    jdKeywords?: string[];
    genaiScore?: number;
  };

  if (!cvSection?.trim() || cvSection.trim().length < 20 || cvSection.trim().length > 4000) {
    return res.status(400).json({ error: "cvSection is required and must be between 20 and 4000 characters." });
  }

  try {
    const keywordsStr = Array.isArray(jdKeywords) ? jdKeywords.slice(0, 10).join(", ") : "";

    const prompt = `
Rewrite this CV section to sound more human, specific, credible, and ATS-friendly.
Do not invent fake experience.
Keep the meaning aligned with the original.
Use relevant keywords naturally.

GenAI score estimate: ${genaiScore}%
Suggested keywords: ${keywordsStr || "None"}

Original text:
${cvSection}

Return JSON only:
{
  "rewritten": "rewritten section here",
  "improvements": ["More specific wording", "Better ATS alignment", "Cleaner phrasing"],
  "confidence": 0.88,
  "keywordMatches": 4
}
`.trim();

    const data = await callGroq(
      GROQ_MODEL.REWRITE,
      [
        { role: "system", content: "You are an expert CV editor. Return valid JSON only." },
        { role: "user", content: prompt },
      ],
      1400,
      0.4
    );

    const raw = extractTextContent(data);
    const parsed = tryParseJson<{
      rewritten?: string;
      improvements?: string[];
      confidence?: number;
      keywordMatches?: number;
    }>(raw, {});

    const rewritten = parsed.rewritten?.trim() || cvSection.trim();
    const improvements = Array.isArray(parsed.improvements) && parsed.improvements.length
      ? parsed.improvements.slice(0, 5)
      : ["Improved readability", "Better ATS alignment", "More human phrasing"];

    return res.status(200).json({
      rewritten,
      improvements,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.85))),
      keywordMatches: Math.max(0, Number(parsed.keywordMatches ?? 0)),
      wordCount: {
        original: countWords(cvSection),
        rewritten: countWords(rewritten),
      },
      model: GROQ_MODEL.REWRITE,
    });
  } catch (error) {
    console.error("Rewrite error:", error);
    return res.status(500).json({ error: "Rewrite failed." });
  }
}