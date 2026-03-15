import type { NextApiRequest, NextApiResponse } from "next";
import { callGroq, extractTextContent, GROQ_MODEL, tryParseJson } from "@/lib/llm-client";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

type UploadedFile = {
  name: string;
  mimeType: string;
  base64: string;
};

type SkillsResult = {
  cv_skills: string[];
  jd_skills: string[];
  missing_skills: string[];
  match_score: number;
};

type Evaluation = {
  model: string;
  genai_score: number;
  reasoning: string;
};

type AnalysisResult = {
  original: { genai_score: number; ats_score: number };
  rewritten: { genai_score: number; ats_score: number };
  bestModel: string;
  evaluations: Evaluation[];
  rewrittenCv: string;
  cvSkills: SkillsResult;
  parsedCvText: string;
  parsedJdText: string;
};

type AnalysisResponse = { results: AnalysisResult } | { error: string };

const fallbackSkills: SkillsResult = {
  cv_skills: [],
  jd_skills: [],
  missing_skills: [],
  match_score: 50,
};

function sanitizeScore(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function toBuffer(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

async function extractTextFromUploadedFile(file: UploadedFile): Promise<string> {
  const lowerName = file.name.toLowerCase().trim();
  const buffer = toBuffer(file.base64);

  if (lowerName.endsWith(".txt")) {
    return buffer.toString("utf8").trim();
  }

  if (lowerName.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (lowerName.endsWith(".pdf")) {
    const pdfParseModule = await import("@cedrugs/pdf-parse");
    const pdfParse = pdfParseModule.default;
    const parsed = await pdfParse(buffer);
    return (parsed.text || "").trim();
  }

  throw new Error(`Unsupported file type for "${file.name}". Please upload PDF, DOCX, or TXT files only.`);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalysisResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { cvFile, jdFile } = req.body as {
    cvFile?: UploadedFile;
    jdFile?: UploadedFile;
  };

  if (!cvFile || !jdFile) {
    return res.status(400).json({ error: "CV and JD files are required." });
  }

  try {
    const [parsedCvText, parsedJdText] = await Promise.all([
      extractTextFromUploadedFile(cvFile),
      extractTextFromUploadedFile(jdFile),
    ]);

    if (!parsedCvText.trim()) {
      return res.status(400).json({ error: "Could not extract text from the CV file." });
    }

    if (!parsedJdText.trim()) {
      return res.status(400).json({ error: "Could not extract text from the JD file." });
    }

    const trimmedCv = parsedCvText.trim().slice(0, 7000);
    const trimmedJd = parsedJdText.trim().slice(0, 7000);

    const skillsPrompt = `
Compare this CV against this job description.

CV:
${trimmedCv}

JD:
${trimmedJd}

Return JSON only:
{
  "cv_skills": ["React", "TypeScript"],
  "jd_skills": ["React", "TypeScript", "AWS"],
  "missing_skills": ["AWS"],
  "match_score": 78
}
`.trim();

    const skillsData = await callGroq(
      GROQ_MODEL.ANALYZE,
      [{ role: "user", content: skillsPrompt }],
      900,
      0.2
    );

    const parsedSkills = tryParseJson<Partial<SkillsResult>>(
      extractTextContent(skillsData),
      fallbackSkills
    );

    const cvSkills: SkillsResult = {
      cv_skills: Array.isArray(parsedSkills.cv_skills) ? parsedSkills.cv_skills.slice(0, 30) : [],
      jd_skills: Array.isArray(parsedSkills.jd_skills) ? parsedSkills.jd_skills.slice(0, 30) : [],
      missing_skills: Array.isArray(parsedSkills.missing_skills)
        ? parsedSkills.missing_skills.slice(0, 30)
        : [],
      match_score: sanitizeScore(parsedSkills.match_score, 50),
    };

    const models = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-20b",
    ];

    const genaiPrompt = `
Estimate how likely this CV text sounds AI-generated.

CV:
${trimmedCv}

Return JSON only:
{
  "genai_score": 0,
  "reasoning": "brief reason"
}
`.trim();

    const evaluations: Evaluation[] = await Promise.all(
      models.map(async (model) => {
        try {
          const data = await callGroq(model, [{ role: "user", content: genaiPrompt }], 500, 0.2);
          const parsed = tryParseJson<{ genai_score?: number; reasoning?: string }>(
            extractTextContent(data),
            { genai_score: 0, reasoning: "No reasoning returned." }
          );

          return {
            model,
            genai_score: sanitizeScore(parsed.genai_score, 0),
            reasoning: parsed.reasoning?.trim() || "No reasoning returned.",
          };
        } catch {
          return {
            model,
            genai_score: 0,
            reasoning: "Model evaluation failed.",
          };
        }
      })
    );

    const avgGenai = sanitizeScore(
      evaluations.reduce((sum, item) => sum + item.genai_score, 0) / evaluations.length,
      0
    );

    const bestModel =
      [...evaluations].sort((a, b) => b.genai_score - a.genai_score)[0]?.model || GROQ_MODEL.REWRITE;

    const rewritePrompt = `
Rewrite this CV to sound more human, more specific, and more ATS-friendly.
Keep it professional and truthful.
Naturally include relevant job keywords where appropriate.

Target JD skills:
${cvSkills.jd_skills.slice(0, 12).join(", ")}

CV:
${trimmedCv}
`.trim();

    const rewriteData = await callGroq(
      bestModel,
      [
        { role: "system", content: "You are an expert ATS CV editor." },
        { role: "user", content: rewritePrompt },
      ],
      1800,
      0.5
    );

    const rewrittenCv = extractTextContent(rewriteData) || trimmedCv;

    const missingCount = cvSkills.missing_skills.length;
    const atsBefore = sanitizeScore(
      100 - missingCount * 6 - avgGenai * 0.18 + cvSkills.match_score * 0.35,
      55
    );
    const atsAfter = sanitizeScore(Math.min(96, atsBefore + 12), atsBefore + 12);

    return res.status(200).json({
      results: {
        original: { genai_score: avgGenai, ats_score: atsBefore },
        rewritten: { genai_score: Math.max(5, avgGenai - 35), ats_score: atsAfter },
        bestModel,
        evaluations,
        rewrittenCv,
        cvSkills,
        parsedCvText,
        parsedJdText,
      },
    });
  } catch (error) {
    console.error("Analyze error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Analysis failed.",
    });
  }
}