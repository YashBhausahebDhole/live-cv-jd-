import { motion } from "framer-motion";

export type InterviewQuestion = {
  id: string;
  type: "behavioral" | "technical" | "project" | "jd-specific" | "hr";
  question: string;
  whyAsked: string;
};

export type InterviewEvaluation = {
  questionId: string;
  scores: {
    relevance: number;
    technicalDepth: number;
    communication: number;
    confidence: number;
    overall: number;
  };
  strengths: string[];
  missingPoints: string[];
  improvedAnswer: string;
  recruiterImpression: string;
};

type Props = {
  roleFocus?: string;
  questions?: InterviewQuestion[];
  currentIndex?: number;
  answers?: Record<string, string>;
  evaluations?: Record<string, InterviewEvaluation>;
  loading?: boolean;
  evaluating?: boolean;
  error?: string;
  onGenerate: () => void;
  onEvaluate: () => void;
  onChangeAnswer: (questionId: string, value: string) => void;
  onNext: () => void;
  onPrev: () => void;
};

function typeTone(type: InterviewQuestion["type"]) {
  switch (type) {
    case "technical":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "behavioral":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "project":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "jd-specific":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "hr":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function ScoreTile({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}/100</div>
    </div>
  );
}

export default function InterviewSimulatorPanel({
  roleFocus = "Target Role",
  questions = [],
  currentIndex = 0,
  answers = {},
  evaluations = {},
  loading = false,
  evaluating = false,
  error = "",
  onGenerate,
  onEvaluate,
  onChangeAnswer,
  onNext,
  onPrev,
}: Props) {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const safeIndex =
    safeQuestions.length === 0
      ? 0
      : Math.min(Math.max(currentIndex, 0), safeQuestions.length - 1);

  const currentQuestion = safeQuestions[safeIndex];
  const total = safeQuestions.length;
  const currentEvaluation =
    currentQuestion && evaluations ? evaluations[currentQuestion.id] : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Interview session</div>
          <div className="mt-1 text-sm text-slate-600">
            Practice tailored interview questions based on the uploaded CV and JD.
          </div>
        </div>

        <button
          onClick={onGenerate}
          disabled={loading}
          className="rounded-2xl bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-60"
        >
          {loading ? "Generating..." : "Generate Questions"}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!safeQuestions.length && !loading && (
        <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">No interview session yet</div>
          <div className="mt-2 text-sm text-slate-600">
            Run CV + JD analysis first, then generate interview questions here.
          </div>
        </div>
      )}

      {!!safeQuestions.length && currentQuestion && (
        <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Role focus
                </div>
                <div className="mt-2 text-xl font-bold text-slate-900">{roleFocus}</div>
              </div>

              <div className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                {safeIndex + 1} / {total}
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {safeQuestions.map((q, i) => {
                const active = i === safeIndex;
                const answered = !!answers[q.id]?.trim();
                const evaluated = !!evaluations[q.id];

                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border p-3 transition ${
                      active
                        ? "border-sky-300 bg-sky-50 ring-2 ring-sky-100"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">Q{i + 1}</div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${typeTone(
                          q.type
                        )}`}
                      >
                        {q.type}
                      </span>
                    </div>

                    <div className="mt-2 line-clamp-2 text-sm text-slate-600">{q.question}</div>

                    <div className="mt-2 flex items-center gap-2 text-xs font-medium">
                      <span className={answered ? "text-emerald-700" : "text-slate-500"}>
                        {answered ? "Answer drafted" : "Not answered"}
                      </span>
                      <span className={evaluated ? "text-indigo-700" : "text-slate-400"}>
                        {evaluated ? "• Evaluated" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${typeTone(
                  currentQuestion.type
                )}`}
              >
                {currentQuestion.type}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                Interview question
              </span>
            </div>

            <div className="mt-4 text-2xl font-bold leading-9 text-slate-900">
              {currentQuestion.question}
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Why this is asked
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-700">
                {currentQuestion.whyAsked}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold text-slate-800">Your answer</div>
              <textarea
                value={answers[currentQuestion.id] ?? ""}
                onChange={(e) => onChangeAnswer(currentQuestion.id, e.target.value)}
                placeholder="Type your answer here..."
                className="min-h-[220px] w-full resize-y rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-900 outline-none"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={onPrev}
                disabled={safeIndex === 0}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>

              <button
                onClick={onEvaluate}
                disabled={evaluating || !(answers[currentQuestion.id] ?? "").trim()}
                className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {evaluating ? "Evaluating..." : "Evaluate Answer"}
              </button>

              <button
                onClick={onNext}
                disabled={safeIndex === total - 1}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Next
              </button>
            </div>

            {currentEvaluation && (
              <div className="mt-6 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <ScoreTile label="Relevance" value={currentEvaluation.scores.relevance} />
                  <ScoreTile label="Tech Depth" value={currentEvaluation.scores.technicalDepth} />
                  <ScoreTile
                    label="Communication"
                    value={currentEvaluation.scores.communication}
                  />
                  <ScoreTile label="Confidence" value={currentEvaluation.scores.confidence} />
                  <ScoreTile label="Overall" value={currentEvaluation.scores.overall} />
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Strengths
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      {currentEvaluation.strengths.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Missing points
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      {currentEvaluation.missingPoints.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Recruiter impression
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700">
                    {currentEvaluation.recruiterImpression}
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Better answer example
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {currentEvaluation.improvedAnswer}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}