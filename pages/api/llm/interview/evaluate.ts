import type { NextApiRequest, NextApiResponse } from "next";
import { callGroq, extractTextContent, GROQ_MODEL, tryParseJson } from "@/lib/llm-client";

type EvaluationScores = {
  relevance: number;
  technicalDepth: number;
  communication: number;
  confidence: number;
  overall: number;
};

type InterviewEvaluation = {
  questionId: string;
  scores: EvaluationScores;
  strengths: string[];
  missingPoints: string[];
  improvedAnswer: string;
  recruiterImpression: string;
};

type SuccessResponse = {
  success: true;
  evaluation: InterviewEvaluation;
};

type ErrorResponse = {
  success: false;
  error: string;
};

type ResponseBody = SuccessResponse | ErrorResponse;

function clampScore(value: unknown, fallback = 60): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function fallbackEvaluation(questionId: string, answer: string): InterviewEvaluation {
  const hasLength = answer.trim().split(/\s+/).length >= 25;
  const hasNumbers = /\d/.test(answer);
  const hasStructure = /because|for example|specifically|result|impact|used|built|implemented/i.test(
    answer
  );

  const relevance = hasLength ? 72 : 55;
  const technicalDepth = hasNumbers || hasStructure ? 70 : 52;
  const communication = hasLength ? 74 : 58;
  const confidence = hasStructure ? 72 : 57;
  const overall = Math.round((relevance + technicalDepth + communication + confidence) / 4);

  return {
    questionId,
    scores: {
      relevance,
      technicalDepth,
      communication,
      confidence,
      overall,
    },
    strengths: hasLength
      ? ["Your answer addresses the question directly.", "Your response has reasonable detail."]
      : ["You attempted the question directly."],
    missingPoints: [
      "Add more concrete details from your actual project or experience.",
      "Include measurable results, tools, or outcomes where possible.",
      "Use a clearer answer structure: situation, action, result.",
    ],
    improvedAnswer:
      "A stronger answer would briefly explain the context, describe the exact tools or methods you used, and finish with the result or impact you achieved.",
    recruiterImpression:
      overall >= 70
        ? "Reasonably solid answer, but it can be made more specific and memorable."
        : "The answer needs more structure, detail, and concrete evidence.",
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "POST only" });
  }

  const {
    questionId = "",
    question = "",
    questionType = "behavioral",
    whyAsked = "",
    answer = "",
    cvText = "",
    jdText = "",
    roleFocus = "Target Role",
  } = req.body as {
    questionId?: string;
    question?: string;
    questionType?: string;
    whyAsked?: string;
    answer?: string;
    cvText?: string;
    jdText?: string;
    roleFocus?: string;
  };

  if (!questionId.trim() || !question.trim() || !answer.trim()) {
    return res.status(400).json({
      success: false,
      error: "questionId, question, and answer are required.",
    });
  }

  try {
    const prompt = `
You are an expert technical interviewer and interview coach.

Evaluate the candidate's answer to the interview question.

Return JSON only in this format:
{
  "scores": {
    "relevance": 82,
    "technicalDepth": 75,
    "communication": 80,
    "confidence": 78,
    "overall": 79
  },
  "strengths": [
    "Strong alignment with the question",
    "Good project ownership explanation"
  ],
  "missingPoints": [
    "Could mention measurable impact",
    "Needs clearer structure"
  ],
  "improvedAnswer": "A stronger version of the answer...",
  "recruiterImpression": "Good answer overall, but would benefit from more specifics."
}

Scoring guidance:
- relevance: how directly the answer addresses the question
- technicalDepth: quality of technical explanation, tools, methods, detail
- communication: clarity, structure, readability
- confidence: how convincing and assured the answer sounds
- overall: balanced summary score

Rules:
- be fair and practical
- do not be overly harsh
- improvedAnswer must stay truthful and based on the candidate's likely background
- strengths and missingPoints should be concise
- return valid JSON only

Role Focus:
${roleFocus}

Question Type:
${questionType}

Why Asked:
${whyAsked}

Question:
${question}

Candidate Answer:
${answer}

Relevant CV context:
${cvText.slice(0, 3500)}

Relevant JD context:
${jdText.slice(0, 2500)}
`.trim();

    const data = await callGroq(
      GROQ_MODEL.CHAT,
      [
        {
          role: "system",
          content: "You are an expert interview evaluator. Return valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      1800,
      0.4
    );

    const parsed = tryParseJson<{
      scores?: {
        relevance?: number;
        technicalDepth?: number;
        communication?: number;
        confidence?: number;
        overall?: number;
      };
      strengths?: string[];
      missingPoints?: string[];
      improvedAnswer?: string;
      recruiterImpression?: string;
    }>(extractTextContent(data), {});

    const evaluation: InterviewEvaluation = {
      questionId,
      scores: {
        relevance: clampScore(parsed.scores?.relevance, 68),
        technicalDepth: clampScore(parsed.scores?.technicalDepth, 64),
        communication: clampScore(parsed.scores?.communication, 70),
        confidence: clampScore(parsed.scores?.confidence, 66),
        overall: clampScore(parsed.scores?.overall, 67),
      },
      strengths:
        Array.isArray(parsed.strengths) && parsed.strengths.length
          ? parsed.strengths.slice(0, 4).map((s) => String(s).trim()).filter(Boolean)
          : ["The answer addresses the question in a relevant way."],
      missingPoints:
        Array.isArray(parsed.missingPoints) && parsed.missingPoints.length
          ? parsed.missingPoints.slice(0, 4).map((s) => String(s).trim()).filter(Boolean)
          : ["Add more specifics, measurable impact, and clearer structure."],
      improvedAnswer:
        parsed.improvedAnswer?.trim() ||
        "A stronger answer would explain the context, the exact actions taken, and the result achieved.",
      recruiterImpression:
        parsed.recruiterImpression?.trim() ||
        "This answer is acceptable, but it would be stronger with more detail and evidence.",
    };

    return res.status(200).json({
      success: true,
      evaluation,
    });
  } catch (error) {
    console.error("interview evaluate error:", error);

    return res.status(200).json({
      success: true,
      evaluation: fallbackEvaluation(questionId, answer),
    });
  }
}