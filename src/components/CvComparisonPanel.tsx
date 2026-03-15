type Props = {
  originalCv: string;
  rewrittenCv: string;
  atsBefore: number;
  atsAfter: number;
  genAiBefore: number;
  genAiAfter: number;
  onDownloadTxt: () => void;
  onDownloadDocx: () => void;
  onDownloadPdf: () => void;
};

function StatCard({
  label,
  value,
  sub,
  tone = "sky",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "sky" | "emerald" | "rose" | "indigo";
}) {
  const toneClass =
    tone === "emerald"
      ? "from-emerald-500/15 to-emerald-200/20 border-emerald-200"
      : tone === "rose"
      ? "from-rose-500/15 to-rose-200/20 border-rose-200"
      : tone === "indigo"
      ? "from-indigo-500/15 to-indigo-200/20 border-indigo-200"
      : "from-sky-500/15 to-sky-200/20 border-sky-200";

  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-600">{sub}</div>
    </div>
  );
}

function PreviewCard({
  title,
  content,
  tone,
}: {
  title: string;
  content: string;
  tone: "slate" | "emerald";
}) {
  return (
    <div
      className={`rounded-3xl border p-5 ${
        tone === "emerald"
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </div>
      <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-800">
        {content || "No content available yet."}
      </pre>
    </div>
  );
}

export default function CvComparisonPanel({
  originalCv,
  rewrittenCv,
  atsBefore,
  atsAfter,
  genAiBefore,
  genAiAfter,
  onDownloadTxt,
  onDownloadDocx,
  onDownloadPdf,
}: Props) {
  const atsDelta = atsAfter - atsBefore;
  const genAiDelta = genAiBefore - genAiAfter;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Original ATS"
          value={`${atsBefore}/100`}
          sub="Score before rewrite"
          tone="indigo"
        />
        <StatCard
          label="Improved ATS"
          value={`${atsAfter}/100`}
          sub={atsDelta > 0 ? `Improved by ${atsDelta} points` : "No ATS increase detected yet"}
          tone="emerald"
        />
        <StatCard
          label="Original GenAI Risk"
          value={`${genAiBefore}/100`}
          sub="Detected AI-likeness before rewrite"
          tone="rose"
        />
        <StatCard
          label="New GenAI Risk"
          value={`${genAiAfter}/100`}
          sub={genAiDelta > 0 ? `Reduced by ${genAiDelta} points` : "No reduction detected yet"}
          tone="sky"
        />
      </div>

      <div className="rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-900">
              CV preview comparison
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Review the original and the current live rewritten version before exporting.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onDownloadTxt}
              className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-300/30"
            >
              Download TXT
            </button>
            <button
              onClick={onDownloadDocx}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-sm"
            >
              Download DOCX
            </button>
            <button
              onClick={onDownloadPdf}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-sm"
            >
              Download PDF
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <PreviewCard title="Original CV preview" content={originalCv} tone="slate" />
          <PreviewCard title="Rewritten CV preview" content={rewrittenCv} tone="emerald" />
        </div>
      </div>
    </div>
  );
}