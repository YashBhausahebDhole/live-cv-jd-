import type { NextApiRequest, NextApiResponse } from "next";
import { callGroq, extractTextContent, GROQ_MODEL, tryParseJson } from "@/lib/llm-client";

type InterviewQuestion = {
  id: string;
  type: "behavioral" | "technical" | "project" | "jd-specific" | "hr";
  question: string;
  whyAsked: string;
};

type SuccessResponse = {
  success: true;
  roleFocus: string;
  questions: InterviewQuestion[];
};

type ErrorResponse = {
  success: false;
  error: string;
};

type ResponseBody = SuccessResponse | ErrorResponse;

function fallbackQuestions(roleFocus: string): InterviewQuestion[] {
  return [
    {
      id: "q1",
      type: "hr",
      question: "Can you introduce yourself and explain why you are a strong fit for this role?",
      whyAsked: "To assess clarity, confidence, and alignment with the job role.",
    },
    {
      id: "q2",
      type: "project",
      question: "Tell me about one project from your CV that best shows your technical strengths.",
      whyAsked: "To understand project ownership, technical depth, and communication.",
    },
    {
      id: "q3",
      type: "technical",
      question: `What technical skills do you think are most important for a ${roleFocus} role, and how have you used them?`,
      whyAsked: "To measure technical understanding and real experience.",
    },
    {
      id: "q4",
      type: "behavioral",
      question: "Describe a challenge you faced during a project and how you solved it.",
      whyAsked: "To test problem-solving and resilience.",
    },
    {
      id: "q5",
      type: "jd-specific",
      question: "Which requirement in the job description matches your background the best?",
      whyAsked: "To check job understanding and self-positioning.",
    },
    {
      id: "q6",
      type: "behavioral",
      question: "How do you handle deadlines, pressure, or multiple responsibilities?",
      whyAsked: "To assess work style and maturity.",
    },
  ];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "POST only" });
  }

  const { cvText = "", jdText = "" } = req.body as {
    cvText?: string;
    jdText?: string;
  };

  if (!cvText.trim() || !jdText.trim()) {
    return res.status(400).json({
      success: false,
      error: "cvText and jdText are required.",
    });
  }

  try {
    const prompt = `
You are an expert interview coach.

Using the candidate CV and the job description, generate 6 high-quality interview questions.

Rules:
- Questions must be tailored to the candidate profile and the job description
- Include a mix of:
  1. behavioral
  2. technical
  3. project
  4. jd-specific
  5. hr
- Each question must be realistic and recruiter-style
- Keep questions concise but strong
- Also provide a short "whyAsked" explanation
- Infer a short role focus title from the JD, such as "Data Analyst", "ML Engineer", "Software Developer", etc.

Return JSON only in this format:
{
  "roleFocus": "Machine Learning Engineer",
  "questions": [
    {
      "id": "q1",
      "type": "technical",
      "question": "Explain how you used machine learning in one of your projects.",
      "whyAsked": "To assess practical ML experience and communication clarity."
    }
  ]
}

CV:
${cvText.slice(0, 5000)}

Job Description:
${jdText.slice(0, 5000)}
`.trim();

    const data = await callGroq(
      GROQ_MODEL.CHAT,
      [
        {
          role: "system",
          content: "You are an expert interview coach. Return valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      1800,
      0.5
    );

    const parsed = tryParseJson<{
      roleFocus?: string;
      questions?: InterviewQuestion[];
    }>(extractTextContent(data), {
      roleFocus: "Target Role",
      questions: [],
    });

    const roleFocus = parsed.roleFocus?.trim() || "Target Role";

    const questions =
      Array.isArray(parsed.questions) && parsed.questions.length
        ? parsed.questions
            .filter(
              (q) =>
                q &&
                typeof q.question === "string" &&
                q.question.trim() &&
                typeof q.whyAsked === "string" &&
                q.whyAsked.trim()
            )
            .map((q, index) => ({
              id: q.id?.trim() || `q${index + 1}`,
              type:
                q.type === "behavioral" ||
                q.type === "technical" ||
                q.type === "project" ||
                q.type === "jd-specific" ||
                q.type === "hr"
                  ? q.type
                  : "behavioral",
              question: q.question.trim(),
              whyAsked: q.whyAsked.trim(),
            }))
            .slice(0, 6)
        : fallbackQuestions(roleFocus);

    return res.status(200).json({
      success: true,
      roleFocus,
      questions: questions.length ? questions : fallbackQuestions(roleFocus),
    });
  } catch (error) {
    console.error("interview generate error:", error);

    const fallbackRole = "Target Role";
    return res.status(200).json({
      success: true,
      roleFocus: fallbackRole,
      questions: fallbackQuestions(fallbackRole),
    });
  }
}