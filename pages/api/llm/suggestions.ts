import type { NextApiRequest, NextApiResponse } from "next";
import { callGroq, extractTextContent, GROQ_MODEL, tryParseJson } from "@/lib/llm-client";

type SuggestionsPayload = {
  improvedBullets: string[];
  missingSkills: string[];
  atsKeywords: string[];
  interviewQuestions: string[];
  notes: string[];
};

type SuggestionsResponse = { suggestions: SuggestionsPayload } | { error: string };

const fallbackSuggestions = (missingSkills: string[]): SuggestionsPayload => ({
  improvedBullets: [
    "Tailored project and experience bullets to match the target role more closely.",
    "Emphasized measurable impact, tools used, and stronger action verbs.",
    "Reduced generic phrasing and made achievements sound more human and specific.",
  ],
  missingSkills: missingSkills.slice(0, 12),
  atsKeywords: missingSkills.slice(0, 12),
  interviewQuestions: [
    "How have you used these required skills in a real project or internship?",
    "Which missing skill would you learn first and how would you show it on your CV?",
    "Can you explain one project where your experience best matches this job description?",
  ],
  notes: [
    "Add keywords naturally into projects, experience, and skills sections.",
    "Avoid keyword stuffing; keep the CV truthful and readable.",
    "Prioritize the top 3 missing skills first.",
  ],
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuggestionsResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { missingSkills = [], cvText = "", jdText = "" } = req.body as {
    missingSkills?: string[];
    cvText?: string;
    jdText?: string;
  };

  if (!Array.isArray(missingSkills) || missingSkills.length === 0) {
    return res.status(400).json({ error: "missingSkills is required." });
  }

  try {
    const prompt = `
You are a CV coach.

Missing skills:
${missingSkills.slice(0, 12).join(", ")}

CV context:
${cvText.slice(0, 2500)}

JD context:
${jdText.slice(0, 2500)}

Return JSON only:
{
  "improvedBullets": ["bullet 1", "bullet 2", "bullet 3"],
  "missingSkills": ["skill 1", "skill 2"],
  "atsKeywords": ["keyword 1", "keyword 2"],
  "interviewQuestions": ["question 1", "question 2", "question 3"],
  "notes": ["note 1", "note 2", "note 3"]
}
`.trim();

    const data = await callGroq(
      GROQ_MODEL.CHAT,
      [
        {
          role: "system",
          content: "You are a CV and ATS coach. Return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      1200,
      0.4
    );

    const parsed = tryParseJson<Partial<SuggestionsPayload>>(
      extractTextContent(data),
      fallbackSuggestions(missingSkills)
    );

    const suggestions: SuggestionsPayload = {
      improvedBullets: Array.isArray(parsed.improvedBullets) && parsed.improvedBullets.length
        ? parsed.improvedBullets.slice(0, 6)
        : fallbackSuggestions(missingSkills).improvedBullets,
      missingSkills: Array.isArray(parsed.missingSkills) && parsed.missingSkills.length
        ? parsed.missingSkills.slice(0, 12)
        : missingSkills.slice(0, 12),
      atsKeywords: Array.isArray(parsed.atsKeywords) && parsed.atsKeywords.length
        ? parsed.atsKeywords.slice(0, 12)
        : missingSkills.slice(0, 12),
      interviewQuestions: Array.isArray(parsed.interviewQuestions) && parsed.interviewQuestions.length
        ? parsed.interviewQuestions.slice(0, 6)
        : fallbackSuggestions(missingSkills).interviewQuestions,
      notes: Array.isArray(parsed.notes) && parsed.notes.length
        ? parsed.notes.slice(0, 6)
        : fallbackSuggestions(missingSkills).notes,
    };

    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error("Suggestions error:", error);
    return res.status(500).json({ error: "Failed to generate suggestions." });
  }
}