import { motion } from "framer-motion";

export type DetectedSection = {
  id: string;
  blockIndex: number;
  section: string;
  originalText: string;
  aiLikelihood: number;
  reason: string;
  humanRewrite: string;
};

type Props = {
  sections: DetectedSection[];
  selectedIds: string[];
  activePreviewId: string | null;
  onToggle: (id: string) => void;
  onPreview: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
};

function riskTone(score: number) {
  if (score >= 80) return "bg-rose-100 text-rose-700 border-rose-200";
  if (score >= 60) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-sky-100 text-sky-700 border-sky-200";
}

export default function DetectedSectionsPanel({
  sections,
  selectedIds,
  activePreviewId,
  onToggle,
  onPreview,
  onSelectAll,
  onClearAll,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Independent rewrite controls</div>
          <div className="text-xs text-slate-600">
            Each card maps to exactly one CV block. Preview or select them independently.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Select all
          </button>
          <button
            onClick={onClearAll}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Clear all
          </button>
        </div>
      </div>

      {!sections.length && (
        <div className="rounded-2xl bg-white/70 p-4 text-sm text-slate-600 ring-1 ring-white/60">
          No strongly AI-like sections were flagged.
        </div>
      )}

      <div className="grid gap-4">
        {sections.map((item, index) => {
          const checked = selectedIds.includes(item.id);
          const active = activePreviewId === item.id;

          return (
            <motion.div
              key={item.id}
              whileHover={{ y: -2 }}
              className={`rounded-3xl border bg-white/80 p-5 shadow-sm transition ${
                active ? "border-sky-300 ring-2 ring-sky-100" : "border-white/60"
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">
                      {index + 1}. {item.section}
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${riskTone(
                        item.aiLikelihood
                      )}`}
                    >
                      AI risk {item.aiLikelihood}/100
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-slate-600">{item.reason}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onPreview(item.id)}
                    className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700"
                  >
                    {active ? "Previewing" : "Preview"}
                  </button>

                  <button
                    onClick={() => onToggle(item.id)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                      checked
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {checked ? "Selected" : "Select rewrite"}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-100">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Original block
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                    {item.originalText}
                  </div>
                </div>

                <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Human rewrite
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                    {item.humanRewrite}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}