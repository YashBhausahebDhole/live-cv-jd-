import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function ScoreCharts({
  latestScore,
  trend,
}: {
  latestScore: number;
  trend: { label: string; score: number }[];
}) {
  const pie = [
    { name: "Matched", value: latestScore },
    { name: "Missing", value: Math.max(0, 100 - latestScore) },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-64 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-2 text-sm text-white/70">Match split</div>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
              <Cell fill="#22c55e" />
              <Cell fill="#ef4444" />
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="h-64 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-2 text-sm text-white/70">Score trend</div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend}>
            <XAxis dataKey="label" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
