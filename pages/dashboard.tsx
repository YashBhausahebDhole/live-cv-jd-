import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabaseClient";
import type { DetectedSection } from "@/components/DetectedSectionsPanel";
import ChatbotPanel from "@/components/ChatbotPanel";
import RewriteEditorPanel, {
  type EditableRewriteBlock,
} from "@/components/RewriteEditorPanel";
import InterviewSimulatorPanel, {
  type InterviewEvaluation,
  type InterviewQuestion,
} from "@/components/InterviewSimulatorPanel";

type Suggestions = {
  improvedBullets: string[];
  missingSkills: string[];
  atsKeywords: string[];
  interviewQuestions: string[];
  notes: string[];
};

type AnalysisApiSuccess = {
  results: {
    original: { genai_score: number; ats_score: number };
    rewritten: { genai_score: number; ats_score: number };
    bestModel: string;
    evaluations: Array<{ model: string; genai_score: number; reasoning: string }>;
    rewrittenCv: string;
    cvSkills: {
      cv_skills: string[];
      jd_skills: string[];
      missing_skills: string[];
      match_score: number;
    };
    parsedCvText: string;
    parsedJdText: string;
  };
};

type DetectAiSuccess = {
  success: true;
  overallGenAiScore: number;
  flaggedSections: DetectedSection[];
  cvBlocks: string[];
};

type ApiError = {
  error?: string;
};

type Row = {
  id: string;
  created_at: string;
  overall_score: number | null;
  original_ats_score: number | null;
  rewritten_ats_score: number | null;
  genai_score: number | null;
  rewritten_genai_score?: number | null;
  missing_keywords: string[] | null;
  llm_suggestions?: Suggestions | null;
  llm_model?: string | null;
  cv_text?: string | null;
  jd_text?: string | null;
  rewritten_cv?: string | null;
  flagged_sections?: DetectedSection[] | null;
  cv_blocks?: string[] | null;
};

type UploadPayload = {
  name: string;
  mimeType: string;
  base64: string;
};

function hasResults(data: AnalysisApiSuccess | ApiError | null): data is AnalysisApiSuccess {
  return !!data && "results" in data;
}

function hasDetectSuccess(data: DetectAiSuccess | ApiError | null): data is DetectAiSuccess {
  return !!data && "success" in data && data.success === true;
}

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function storageKeyForUser(userId: string) {
  return `cv-jd-coach-history:${userId}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`Could not encode ${file.name}`));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error(`Could not encode ${file.name}`));
        return;
      }
      resolve(base64);
    };

    reader.readAsDataURL(file);
  });
}

async function buildUploadPayload(file: File): Promise<UploadPayload> {
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    base64: await fileToBase64(file),
  };
}

function convertToEditableBlocks(sections: DetectedSection[]): EditableRewriteBlock[] {
  return sections.map((section) => ({
    ...section,
    editedRewrite: section.humanRewrite,
    isApplied: true,
  }));
}

function buildFinalCvFromEditableBlocks(blocks: string[], rewrites: EditableRewriteBlock[]) {
  const nextBlocks = [...blocks];

  for (const item of rewrites) {
    if (!item.isApplied) continue;
    if (item.blockIndex < 0 || item.blockIndex >= nextBlocks.length) continue;

    const value = item.editedRewrite.trim();
    if (!value) continue;

    nextBlocks[item.blockIndex] = value;
  }

  return {
    blocks: nextBlocks,
    fullText: nextBlocks.join("\n\n"),
  };
}

function Tile({
  label,
  value,
  sub,
  tone = "sky",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "sky" | "indigo" | "emerald" | "rose";
}) {
  const styles =
    tone === "emerald"
      ? "from-emerald-500/15 to-emerald-300/10 shadow-emerald-300/20"
      : tone === "indigo"
      ? "from-indigo-500/15 to-blue-300/10 shadow-indigo-300/20"
      : tone === "rose"
      ? "from-rose-500/15 to-pink-300/10 shadow-rose-300/20"
      : "from-sky-500/15 to-cyan-300/10 shadow-sky-300/20";

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.015 }}
      transition={{ duration: 0.2 }}
      className={cx(
        "rounded-3xl border border-white/60 bg-gradient-to-br backdrop-blur-xl",
        "p-5 shadow-xl",
        styles
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-600">{sub}</div>
    </motion.div>
  );
}

function Card({
  title,
  subtitle,
  children,
  right,
  glow = "sky",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  glow?: "sky" | "indigo" | "emerald" | "rose";
}) {
  const glowClass =
    glow === "emerald"
      ? "shadow-emerald-300/20"
      : glow === "indigo"
      ? "shadow-indigo-300/20"
      : glow === "rose"
      ? "shadow-rose-300/20"
      : "shadow-sky-300/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx(
        "rounded-[32px] border border-white/60 bg-white/65 backdrop-blur-2xl",
        "shadow-2xl",
        glowClass
      )}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6 md:px-8 md:pt-8">
        <div>
          <div className="text-2xl font-bold tracking-tight text-slate-900">{title}</div>
          {subtitle && <div className="mt-1 text-sm text-slate-600">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className="px-6 pb-6 pt-5 md:px-8 md:pb-8">{children}</div>
    </motion.div>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <motion.span
      whileHover={{ scale: 1.04 }}
      className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[12px] font-medium text-slate-800 shadow-sm"
    >
      {text}
    </motion.span>
  );
}

export default function Dashboard() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [history, setHistory] = useState<Row[]>([]);
  const [editableBlocks, setEditableBlocks] = useState<EditableRewriteBlock[]>([]);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [cvBlocks, setCvBlocks] = useState<string[]>([]);
  const [finalCv, setFinalCv] = useState("");
  const [originalCv, setOriginalCv] = useState("");
  const [atsBefore, setAtsBefore] = useState(0);
  const [atsAfter, setAtsAfter] = useState(0);
  const [genAiBefore, setGenAiBefore] = useState(0);
  const [genAiAfter, setGenAiAfter] = useState(0);

  const [interviewRoleFocus, setInterviewRoleFocus] = useState("Target Role");
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [interviewCurrentIndex, setInterviewCurrentIndex] = useState(0);
  const [interviewAnswers, setInterviewAnswers] = useState<Record<string, string>>({});
  const [interviewEvaluations, setInterviewEvaluations] = useState<
    Record<string, InterviewEvaluation>
  >({});
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewEvaluating, setInterviewEvaluating] = useState(false);
  const [interviewError, setInterviewError] = useState("");

  const latest = history[0] ?? null;
  const latestScore = latest?.overall_score ?? null;

  const flaggedSections = useMemo(
    () =>
      editableBlocks.map(({ editedRewrite: _edited, isApplied: _applied, ...rest }) => rest),
    [editableBlocks]
  );

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      window.location.href = "/login";
      return null;
    }

    setUserId(session.user.id);
    return session;
  }

  function loadLocalHistory(localUserId: string) {
    try {
      const raw = localStorage.getItem(storageKeyForUser(localUserId));
      const parsed = raw ? (JSON.parse(raw) as Row[]) : [];
      setHistory(parsed);

      if (parsed[0]?.cv_text) setOriginalCv(parsed[0].cv_text);
      if (parsed[0]?.rewritten_cv) setFinalCv(parsed[0].rewritten_cv);
      if (parsed[0]?.cv_blocks) setCvBlocks(parsed[0].cv_blocks ?? []);
      if (parsed[0]?.flagged_sections) {
        const blocks = convertToEditableBlocks(parsed[0].flagged_sections ?? []);
        setEditableBlocks(blocks);
        setActivePreviewId(blocks[0]?.id ?? null);
      }
      if (parsed[0]?.original_ats_score) setAtsBefore(parsed[0].original_ats_score ?? 0);
      if (parsed[0]?.rewritten_ats_score) setAtsAfter(parsed[0].rewritten_ats_score ?? 0);
      if (parsed[0]?.genai_score) setGenAiBefore(parsed[0].genai_score ?? 0);
      if (parsed[0]?.rewritten_genai_score) setGenAiAfter(parsed[0].rewritten_genai_score ?? 0);
    } catch {
      setHistory([]);
    }
  }

  function saveLocalHistory(localUserId: string, rows: Row[]) {
    localStorage.setItem(storageKeyForUser(localUserId), JSON.stringify(rows));
    setHistory(rows);
  }

  useEffect(() => {
    (async () => {
      const session = await requireSession();
      if (!session) return;
      loadLocalHistory(session.user.id);
    })();
  }, []);

  const previewComputed = useMemo(() => {
    if (!cvBlocks.length) {
      return { fullText: finalCv || originalCv, blocks: cvBlocks };
    }
    return buildFinalCvFromEditableBlocks(cvBlocks, editableBlocks);
  }, [cvBlocks, editableBlocks, finalCv, originalCv]);

  useEffect(() => {
    if (previewComputed.fullText) {
      setFinalCv(previewComputed.fullText);
    }
  }, [previewComputed.fullText]);

  useEffect(() => {
    const appliedCount = editableBlocks.filter((b) => b.isApplied).length;
    const reduction = Math.min(40, appliedCount * 8);
    setGenAiAfter(Math.max(5, genAiBefore - reduction));
    setAtsAfter(Math.min(98, atsBefore + Math.max(6, appliedCount * 3)));
  }, [editableBlocks, genAiBefore, atsBefore]);

  useEffect(() => {
    if (!userId || !history.length) return;

    const updatedRows = history.map((item, index) =>
      index === 0
        ? {
            ...item,
            rewritten_cv: previewComputed.fullText,
            rewritten_genai_score: genAiAfter,
            rewritten_ats_score: atsAfter,
          }
        : item
    );

    localStorage.setItem(storageKeyForUser(userId), JSON.stringify(updatedRows));
  }, [previewComputed.fullText, genAiAfter, atsAfter, history, userId]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function previewBlock(id: string) {
    setActivePreviewId(id);
  }

  function toggleApplyBlock(id: string) {
    setEditableBlocks((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isApplied: !item.isApplied } : item
      )
    );
    setActivePreviewId(id);
  }

  function updateEditedText(id: string, value: string) {
    setEditableBlocks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, editedRewrite: value } : item))
    );
    setActivePreviewId(id);
  }

  function resetEditedText(id: string) {
    setEditableBlocks((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, editedRewrite: item.humanRewrite } : item
      )
    );
    setActivePreviewId(id);
  }

  function applyAllBlocks() {
    setEditableBlocks((prev) => prev.map((item) => ({ ...item, isApplied: true })));
  }

  function clearAllBlocks() {
    setEditableBlocks((prev) => prev.map((item) => ({ ...item, isApplied: false })));
  }

  async function generateInterviewQuestions() {
    setInterviewError("");

    if (!originalCv.trim() || !(latest?.jd_text ?? "").trim()) {
      setInterviewError("Run CV + JD analysis first to generate interview questions.");
      return;
    }

    setInterviewLoading(true);

    try {
      const response = await fetch("/api/llm/interview/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cvText: originalCv,
          jdText: latest?.jd_text ?? "",
        }),
      });

      const raw = await response.text();
      let json:
        | {
            success?: boolean;
            roleFocus?: string;
            questions?: InterviewQuestion[];
            error?: string;
          }
        | null = null;

      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`Interview route returned non-JSON response: ${raw.slice(0, 180)}`);
      }

      if (!response.ok || !json?.success || !json.questions?.length) {
        throw new Error(json?.error || "Failed to generate interview questions.");
      }

      setInterviewRoleFocus(json.roleFocus || "Target Role");
      setInterviewQuestions(json.questions);
      setInterviewCurrentIndex(0);
      setInterviewAnswers({});
      setInterviewEvaluations({});
    } catch (e) {
      setInterviewError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setInterviewLoading(false);
    }
  }

  function changeInterviewAnswer(questionId: string, value: string) {
    setInterviewAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  }

  function nextInterviewQuestion() {
    setInterviewCurrentIndex((prev) =>
      prev < interviewQuestions.length - 1 ? prev + 1 : prev
    );
  }

  function prevInterviewQuestion() {
    setInterviewCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }

  async function evaluateCurrentInterviewAnswer() {
    const currentQuestion = interviewQuestions[interviewCurrentIndex];
    if (!currentQuestion) return;

    const answer = interviewAnswers[currentQuestion.id] ?? "";
    if (!answer.trim()) {
      setInterviewError("Write an answer first before evaluation.");
      return;
    }

    setInterviewError("");
    setInterviewEvaluating(true);

    try {
      const response = await fetch("/api/llm/interview/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          question: currentQuestion.question,
          questionType: currentQuestion.type,
          whyAsked: currentQuestion.whyAsked,
          answer,
          cvText: originalCv,
          jdText: latest?.jd_text ?? "",
          roleFocus: interviewRoleFocus,
        }),
      });

      const raw = await response.text();
      let json:
        | {
            success?: boolean;
            evaluation?: InterviewEvaluation;
            error?: string;
          }
        | null = null;

      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`Interview evaluation returned non-JSON response: ${raw.slice(0, 180)}`);
      }

      if (!response.ok || !json?.success || !json.evaluation) {
        throw new Error(json?.error || "Failed to evaluate the answer.");
      }

      if (!response.ok || !json?.success || !json.evaluation) {
  throw new Error(json?.error || "Failed to evaluate the answer.");
}

const evaluation: InterviewEvaluation = json.evaluation;

setInterviewEvaluations((prev: Record<string, InterviewEvaluation>) => ({
  ...prev,
  [evaluation.questionId]: evaluation,
}));
  async function uploadAndAnalyze() {
    setAnalyzeErr("");
    setOkMsg("");
    setEditableBlocks([]);
    setActivePreviewId(null);
    setInterviewQuestions([]);
    setInterviewAnswers({});
    setInterviewEvaluations({});
    setInterviewCurrentIndex(0);
    setInterviewError("");

    if (!cvFile || !jdFile) {
      setAnalyzeErr("Select both CV and JD files.");
      return;
    }

    setLoading(true);

    try {
      const session = await requireSession();
      if (!session) return;

      const [cvPayload, jdPayload] = await Promise.all([
        buildUploadPayload(cvFile),
        buildUploadPayload(jdFile),
      ]);

      const analyzeResponse = await fetch("/api/llm/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          cvFile: cvPayload,
          jdFile: jdPayload,
        }),
      });

      const analyzeRaw = await analyzeResponse.text();
      let analyzeJson: AnalysisApiSuccess | ApiError | null = null;

      try {
        analyzeJson = JSON.parse(analyzeRaw);
      } catch {
        throw new Error(`Server returned non-JSON response: ${analyzeRaw.slice(0, 180)}`);
      }

      if (!analyzeResponse.ok || !hasResults(analyzeJson)) {
        const message =
          analyzeJson && "error" in analyzeJson && typeof analyzeJson.error === "string"
            ? analyzeJson.error
            : "Analyze failed";

        throw new Error(message);
      }

      const detectResponse = await fetch("/api/llm/detect-ai-sections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          cvText: analyzeJson.results.parsedCvText,
          jdText: analyzeJson.results.parsedJdText,
        }),
      });

      const detectRaw = await detectResponse.text();
      let detectJson: DetectAiSuccess | ApiError | null = null;

      try {
        detectJson = JSON.parse(detectRaw);
      } catch {
        throw new Error(`Detect route returned non-JSON response: ${detectRaw.slice(0, 180)}`);
      }

      if (!detectResponse.ok || !hasDetectSuccess(detectJson)) {
        const message =
          detectJson && "error" in detectJson && typeof detectJson.error === "string"
            ? detectJson.error
            : "AI section detection failed";

        throw new Error(message);
      }

      const editable = convertToEditableBlocks(detectJson.flaggedSections);

      setCvBlocks(detectJson.cvBlocks ?? []);
      setOriginalCv(analyzeJson.results.parsedCvText);
      setEditableBlocks(editable);
      setActivePreviewId(editable[0]?.id ?? null);
      setAtsBefore(analyzeJson.results.original.ats_score);
      setAtsAfter(analyzeJson.results.rewritten.ats_score);
      setGenAiBefore(detectJson.overallGenAiScore || analyzeJson.results.original.genai_score);

      const rewriteResult = buildFinalCvFromEditableBlocks(detectJson.cvBlocks ?? [], editable);
      const rewrittenGenAi = Math.max(
        5,
        detectJson.overallGenAiScore - Math.min(45, editable.length * 8)
      );

      setFinalCv(rewriteResult.fullText);
      setGenAiAfter(rewrittenGenAi);

      const row: Row = {
        id: uuidv4(),
        created_at: new Date().toISOString(),
        overall_score: analyzeJson.results.original.ats_score,
        original_ats_score: analyzeJson.results.original.ats_score,
        rewritten_ats_score: analyzeJson.results.rewritten.ats_score,
        genai_score: detectJson.overallGenAiScore || analyzeJson.results.original.genai_score,
        rewritten_genai_score: rewrittenGenAi,
        missing_keywords: analyzeJson.results.cvSkills.missing_skills ?? [],
        llm_suggestions: null,
        llm_model: analyzeJson.results.bestModel,
        cv_text: analyzeJson.results.parsedCvText,
        jd_text: analyzeJson.results.parsedJdText,
        rewritten_cv: rewriteResult.fullText,
        flagged_sections: detectJson.flaggedSections,
        cv_blocks: detectJson.cvBlocks ?? [],
      };

      const updatedRows = [row, ...history].slice(0, 12);
      saveLocalHistory(session.user.id, updatedRows);
      setOkMsg("Analysis complete. You can now edit, apply, or revert each rewritten block.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setAnalyzeErr(message);
    } finally {
      setLoading(false);
    }
  }

  const appliedCount = editableBlocks.filter((b) => b.isApplied).length;

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen text-slate-900"
    >
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.30),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.22),_transparent_28%),linear-gradient(to_bottom_right,_#dff2ff,_#f7fbff)]" />

      <div className="mx-auto max-w-7xl px-5 py-6 md:px-8 lg:px-10">
        <header className="mb-8 flex flex-col gap-5 rounded-[32px] border border-white/60 bg-white/55 p-6 shadow-2xl shadow-sky-200/30 backdrop-blur-2xl md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Phase 3 — Editable Rewrite Studio + Interview Simulator
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
              CV + JD Optimizer
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Edit rewritten blocks manually, apply only the ones you want, and practice tailored
              interview questions from your CV and target JD.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-sm">
              {userId ? "Signed in and ready to optimize" : "Loading dashboard..."}
            </div>
            <motion.button
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={logout}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/30"
            >
              Logout
            </motion.button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile
            label="Original ATS"
            value={
              atsBefore ? `${atsBefore}/100` : latestScore === null ? "—" : `${latestScore}/100`
            }
            sub="Baseline resume performance"
            tone="indigo"
          />
          <Tile
            label="Improved ATS"
            value={atsAfter ? `${atsAfter}/100` : "—"}
            sub="Live score based on applied blocks"
            tone="emerald"
          />
          <Tile
            label="GenAI Risk"
            value={genAiBefore ? `${genAiBefore}/100` : "—"}
            sub="Detected AI-likeness in original"
            tone="rose"
          />
          <Tile
            label="Applied Blocks"
            value={String(appliedCount)}
            sub="Rewrites currently active"
            tone="sky"
          />
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <Card
            title="Upload your CV and Job Description"
            subtitle="Upload PDF, DOCX, or TXT and generate editable rewrite blocks."
            glow="indigo"
            right={
              <motion.button
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={uploadAndAnalyze}
                disabled={loading}
                className={cx(
                  "rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-xl",
                  "bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500",
                  "disabled:opacity-60"
                )}
              >
                {loading ? "Analyzing..." : "Upload & Analyze"}
              </motion.button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <motion.div
                whileHover={{ y: -3 }}
                className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-sm"
              >
                <div className="mb-3 text-sm font-semibold text-slate-700">Your CV</div>
                <input
                  className="block w-full rounded-2xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200 file:mr-3 file:rounded-xl file:border-0 file:bg-sky-100 file:px-4 file:py-2 file:font-medium file:text-slate-800 hover:file:bg-sky-200"
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                />
              </motion.div>

              <motion.div
                whileHover={{ y: -3 }}
                className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-sm"
              >
                <div className="mb-3 text-sm font-semibold text-slate-700">Job Description</div>
                <input
                  className="block w-full rounded-2xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200 file:mr-3 file:rounded-xl file:border-0 file:bg-sky-100 file:px-4 file:py-2 file:font-medium file:text-slate-800 hover:file:bg-sky-200"
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setJdFile(e.target.files?.[0] ?? null)}
                />
              </motion.div>
            </div>

            {(analyzeErr || okMsg) && (
              <div className="mt-5 space-y-3">
                {analyzeErr && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
                    {analyzeErr}
                  </div>
                )}
                {okMsg && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">
                    {okMsg}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-800">Detected missing keywords</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(latest?.missing_keywords ?? []).slice(0, 20).map((k, i) => (
                  <Chip key={`${k}-${i}`} text={k} />
                ))}
                {!latest?.missing_keywords?.length && (
                  <div className="text-sm text-slate-500">Run analysis to see keyword gaps.</div>
                )}
              </div>
            </div>
          </Card>

          <Card
            title="Quick project snapshot"
            subtitle="Your latest editing status at a glance."
            glow="sky"
          >
            <div className="grid gap-4">
              <div className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-700 p-5 text-white shadow-xl">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                  Current Status
                </div>
                <div className="mt-3 text-2xl font-bold">
                  {editableBlocks.length ? "Editable rewrite session active" : "No analysis yet"}
                </div>
                <div className="mt-2 text-sm text-slate-300">
                  {editableBlocks.length
                    ? `${editableBlocks.length} editable blocks ready`
                    : "Upload your CV and JD to generate editable rewrite controls."}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/60 bg-white/80 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Flagged Sections
                  </div>
                  <div className="mt-3 text-3xl font-bold text-slate-900">
                    {editableBlocks.length}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    AI-like blocks detected and editable
                  </div>
                </div>

                <div className="rounded-3xl border border-white/60 bg-white/80 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Interview Questions
                  </div>
                  <div className="mt-3 text-3xl font-bold text-slate-900">
                    {interviewQuestions.length}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Generated for interview practice
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-8">
          <Card
            title="Rewrite editor"
            subtitle="Edit, apply, or revert each rewrite block independently."
            glow="rose"
          >
            <RewriteEditorPanel
              blocks={editableBlocks}
              activeId={activePreviewId}
              onPreview={previewBlock}
              onToggleApply={toggleApplyBlock}
              onEditChange={updateEditedText}
              onResetEdit={resetEditedText}
              onApplyAll={applyAllBlocks}
              onClearAll={clearAllBlocks}
            />
          </Card>
        </div>

        <div className="mt-8">
          <Card
            title="Interview simulator"
            subtitle="Practice job-specific interview questions generated from your CV and the target JD."
            glow="emerald"
          >
            <InterviewSimulatorPanel
              roleFocus={interviewRoleFocus}
              questions={interviewQuestions}
              currentIndex={interviewCurrentIndex}
              answers={interviewAnswers}
              evaluations={interviewEvaluations}
              loading={interviewLoading}
              evaluating={interviewEvaluating}
              error={interviewError}
              onGenerate={generateInterviewQuestions}
              onEvaluate={evaluateCurrentInterviewAnswer}
              onChangeAnswer={changeInterviewAnswer}
              onNext={nextInterviewQuestion}
              onPrev={prevInterviewQuestion}
            />
          </Card>
        </div>

        <div className="mt-8">
          <Card
            title="AI career coach chat"
            subtitle="Ask about ATS score, rewritten blocks, missing skills, and interview preparation."
            glow="indigo"
          >
            <ChatbotPanel
              cvContext={originalCv}
              jdContext={latest?.jd_text ?? ""}
              atsBefore={atsBefore}
              atsAfter={atsAfter}
              missingSkills={latest?.missing_keywords ?? []}
              flaggedSections={flaggedSections}
              rewrittenCv={finalCv}
            />
          </Card>
        </div>
      </div>
    </motion.main>
  );
}