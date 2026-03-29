import type { NextApiRequest, NextApiResponse } from "next";
import { callGroq, extractTextContent, GROQ_MODEL, tryParseJson } from "@/lib/llm-client";

export type DetectedSection = {
  id: string;
  blockIndex: number;
  section: string;
  originalText: string;
  aiLikelihood: number;
  reason: string;
  humanRewrite: string;
};

type DetectResponse =
  | {
      success: true;
      overallGenAiScore: number;
      flaggedSections: DetectedSection[];
      cvBlocks: string[];
    }
  | {
      success: false;
      error: string;
    };

function clampScore(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function splitCvIntoBlocks(cvText: string): string[] {
  const normalized = normalizeText(cvText);

  const paragraphBlocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length >= 24);

  if (paragraphBlocks.length >= 4) {
    return paragraphBlocks.slice(0, 30);
  }

  const lineBlocks = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 24);

  return lineBlocks.slice(0, 30);
}

function genericVerdict(text: string): {
  flagged: boolean;
  score: number;
  reason: string;
} {
  const lower = text.toLowerCase();

  const genericPhrases = [
    "highly motivated",
    "results-driven",
    "detail-oriented",
    "passionate about",
    "responsible for",
    "worked on",
    "dynamic professional",
    "innovative solutions",
    "fast-paced environment",
    "team player",
    "hardworking",
    "demonstrated ability",
    "seeking an opportunity",
    "leveraged",
    "utilized",
  ];

  let hits = 0;
  for (const phrase of genericPhrases) {
    if (lower.includes(phrase)) hits += 1;
  }

  const noNumbers = !/\d/.test(text);
  const longBlock = text.length > 140;
  const wordCount = text.split(/\s+/).length;
  const dense = wordCount > 28;

  const hasConcreteSkill =
    /\b(python|java|sql|aws|react|node|excel|tableau|power bi|tensorflow|pandas|spark)\b/i.test(
      text
    );

  const flagged =
    hits >= 2 ||
    (hits >= 1 && longBlock && noNumbers) ||
    (dense && noNumbers && !hasConcreteSkill);

  const score = Math.min(
    90,
    50 + hits * 10 + (longBlock ? 8 : 0) + (dense ? 6 : 0) + (noNumbers ? 6 : 0)
  );

  return {
    flagged,
    score,
    reason:
      "This block sounds generic, low-specificity, or overly polished compared with more natural human resume writing.",
  };
}

function heuristicRewrite(text: string): string {
  return text
    .replace(/highly motivated/gi, "motivated")
    .replace(/results-driven/gi, "focused on results")
    .replace(/responsible for/gi, "handled")
    .replace(/worked on/gi, "built")
    .replace(/utilized/gi, "used")
    .replace(/leveraged/gi, "used")
    .replace(/dynamic professional/gi, "professional")
    .replace(/passionate about/gi, "interested in")
    .trim();
}

function fallbackSections(blocks: string[]): DetectedSection[] {
  const results: DetectedSection[] = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const verdict = genericVerdict(blocks[i]);
    if (!verdict.flagged) continue;

    results.push({
      id: `fallback_${i}`,
      blockIndex: i,
      section: `Block ${i + 1}`,
      originalText: blocks[i],
      aiLikelihood: verdict.score,
      reason: verdict.reason,
      humanRewrite: heuristicRewrite(blocks[i]),
    });

    if (results.length >= 5) break;
  }

  return results;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DetectResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "POST only" });
  }

  const { cvText = "", jdText = "" } = req.body as {
    cvText?: string;
    jdText?: string;
  };

  if (!cvText.trim()) {
    return res.status(400).json({ success: false, error: "cvText is required." });
  }

  try {
    const cvBlocks = splitCvIntoBlocks(cvText);

    const prompt = `
You are an expert resume reviewer and AI-writing detector.

Review the CV blocks below and identify only the blocks that sound AI-generated, robotic, generic, repetitive, vague, or unnatural.

For each suspicious block return:
- id
- blockIndex
- section
- originalText
- aiLikelihood (0-100)
- reason
- humanRewrite

Rules:
- blockIndex must exactly match the block number below
- do not merge multiple blocks
- rewrite only that one block
- keep the rewrite truthful, natural, and ATS-friendly
- if no blocks are suspicious, return an empty array

Optional JD context:
${jdText.slice(0, 2200)}

CV blocks:
${cvBlocks.map((b, i) => `BLOCK_${i}:\n${b}`).join("\n\n")}

Return JSON only:
{
  "overallGenAiScore": 62,
  "flaggedSections": [
    {
      "id": "block_3",
      "blockIndex": 3,
      "section": "Professional Summary",
      "originalText": "Original text here",
      "aiLikelihood": 84,
      "reason": "Too generic and formulaic",
      "humanRewrite": "More natural rewritten version"
    }
  ]
}
`.trim();

    let flaggedSections: DetectedSection[] = [];
    let overallGenAiScore = 0;

    try {
      const data = await callGroq(
        GROQ_MODEL.CHAT,
        [
          { role: "system", content: "You are an expert CV reviewer. Return valid JSON only." },
          { role: "user", content: prompt },
        ],
        2200,
        0.4
      );

      const parsed = tryParseJson<{
        overallGenAiScore?: number;
        flaggedSections?: Array<{
          id?: string;
          blockIndex?: number;
          section?: string;
          originalText?: string;
          aiLikelihood?: number;
          reason?: string;
          humanRewrite?: string;
        }>;
      }>(extractTextContent(data), {
        overallGenAiScore: 0,
        flaggedSections: [],
      });

      overallGenAiScore = clampScore(parsed.overallGenAiScore, 0);

      const seen = new Set<number>();

      flaggedSections = Array.isArray(parsed.flaggedSections)
        ? parsed.flaggedSections
            .filter((item) => {
              const idx = Number(item?.blockIndex);
              if (!Number.isInteger(idx)) return false;
              if (idx < 0 || idx >= cvBlocks.length) return false;
              if (seen.has(idx)) return false;
              if (!item?.humanRewrite?.trim()) return false;
              seen.add(idx);
              return true;
            })
            .map((item, index) => {
              const idx = Number(item.blockIndex);
              return {
                id: item.id?.trim() || `block_${idx}_${index}`,
                blockIndex: idx,
                section: item.section?.trim() || `Block ${idx + 1}`,
                originalText: cvBlocks[idx] ?? item.originalText?.trim() ?? "",
                aiLikelihood: clampScore(item.aiLikelihood, 55),
                reason: item.reason?.trim() || "This block sounds overly generic or robotic.",
                humanRewrite: item.humanRewrite?.trim() || cvBlocks[idx] || "",
              };
            })
            .slice(0, 10)
        : [];
    } catch {
      flaggedSections = [];
      overallGenAiScore = 0;
    }

    if (!flaggedSections.length) {
      flaggedSections = fallbackSections(cvBlocks);
      if (!overallGenAiScore) {
        overallGenAiScore = flaggedSections.length
          ? Math.min(82, 30 + flaggedSections.length * 9)
          : 15;
      }
    }

    return res.status(200).json({
      success: true,
      overallGenAiScore,
      flaggedSections,
      cvBlocks,
    });
  } catch (error) {
    console.error("detect-ai-sections error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to detect AI-like sections.",
    });
  }
} 