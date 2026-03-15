import { motion } from "framer-motion";

export type EditableRewriteBlock = {
  id: string;
  blockIndex: number;
  section: string;
  originalText: string;
  aiLikelihood: number;
  reason: string;
  humanRewrite: string;
  editedRewrite: string;
  isApplied: boolean;
};

type Props = {
  blocks: EditableRewriteBlock[];
  activeId: string | null;
  onPreview: (id: string) => void;
  onToggleApply: (id: string) => void;
  onEditChange: (id: string, value: string) => void;
  onResetEdit: (id: string) => void;
  onApplyAll: () => void;
  onClearAll: () => void;
};

function riskTone(score: number) {
  if (score >= 80) return "bg-rose-100 text-rose-700 border-rose-200";
  if (score >= 60) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-sky-100 text-sky-700 border-sky-200";
}

export default function RewriteEditorPanel({
  blocks,
  activeId,
  onPreview,
  onToggleApply,
  onEditChange,
  onResetEdit,
  onApplyAll,
  onClearAll,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Editable rewrite blocks</div>
          <div className="text-xs text-slate-600">
            Edit each rewrite manually, then apply or revert it independently.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onApplyAll}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Apply all
          </button>
          <button
            onClick={onClearAll}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Clear all
          </button>
        </div>
      </div>

      {!blocks?.length && (
        <div className="rounded-2xl bg-white/70 p-4 text-sm text-slate-600 ring-1 ring-white/60">
          No rewrite blocks are available yet.
        </div>
      )}

      <div className="grid gap-4">
        {blocks?.map((item, index) => {
          const active = activeId === item.id;

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
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        item.isApplied
                          ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.isApplied ? "Applied" : "Not applied"}
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
                    onClick={() => onToggleApply(item.id)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                      item.isApplied
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {item.isApplied ? "Revert block" : "Apply block"}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-100">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Original block
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                    {item.originalText}
                  </div>
                </div>

                <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Editable rewrite
                    </div>
                    <button
                      onClick={() => onResetEdit(item.id)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      Reset text
                    </button>
                  </div>

                  <textarea
                    value={item.editedRewrite}
                    onChange={(e) => onEditChange(item.id, e.target.value)}
                    className="min-h-[180px] w-full resize-y rounded-2xl border border-emerald-200 bg-white p-4 text-sm leading-6 text-slate-800 outline-none"
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}