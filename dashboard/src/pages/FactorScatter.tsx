import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { loadFactorStats, loadSignalDoc } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";
import type { FactorStats, SignalDoc } from "../types";

const METRICS: { key: string; label: string; fmt: (s: FactorStats) => number | null }[] = [
  { key: "sharpe_ratio", label: "Sharpe Ratio", fmt: (s) => s.sharpe_ratio },
  { key: "ann_return", label: "Ann. Return", fmt: (s) => s.ann_return * 100 },
  { key: "ann_volatility", label: "Ann. Volatility", fmt: (s) => s.ann_volatility * 100 },
  { key: "t_stat", label: "t-Statistic", fmt: (s) => s.t_stat },
  { key: "max_drawdown", label: "Max Drawdown", fmt: (s) => s.max_drawdown * 100 },
  { key: "pct_positive", label: "% Positive Months", fmt: (s) => s.pct_positive * 100 },
  { key: "n_months", label: "Months of Data", fmt: (s) => s.n_months },
  { key: "mean_monthly", label: "Mean Monthly Ret", fmt: (s) => s.mean_monthly * 100 },
  { key: "skewness", label: "Skewness", fmt: (s) => s.skewness },
  { key: "kurtosis", label: "Excess Kurtosis", fmt: (s) => s.kurtosis },
  { key: "best_month", label: "Best Month", fmt: (s) => s.best_month * 100 },
  { key: "worst_month", label: "Worst Month", fmt: (s) => s.worst_month * 100 },
];

const CAT_COLORS: Record<string, string> = {
  valuation: "#3b82f6",
  momentum: "#ef4444",
  profitability: "#10b981",
  investment: "#f59e0b",
  risk: "#8b5cf6",
  volatility: "#ec4899",
  liquidity: "#14b8a6",
  accruals: "#f97316",
  leverage: "#a855f7",
  size: "#06b6d4",
};

export default function FactorScatter() {
  const { data: stats, loading: l1 } = useData(useCallback(() => loadFactorStats(), []));
  const { data: docs, loading: l2 } = useData(useCallback(() => loadSignalDoc(), []));
  const [xMetric, setXMetric] = useState("t_stat");
  const [yMetric, setYMetric] = useState("sharpe_ratio");
  const [colorBy, setColorBy] = useState<"category" | "none">("category");

  const docLookup = useMemo(() => {
    const m: Record<string, SignalDoc> = {};
    if (docs) for (const d of docs) if (d.Acronym) m[d.Acronym] = d;
    return m;
  }, [docs]);

  if (l1 || l2) return <LoadingSpinner />;
  if (!stats) return <div className="text-red-400">No data</div>;

  const xDef = METRICS.find((m) => m.key === xMetric)!;
  const yDef = METRICS.find((m) => m.key === yMetric)!;

  const factors = Object.values(stats);

  // Group by category for coloring
  const grouped: Record<string, FactorStats[]> = {};
  for (const f of factors) {
    const cat = colorBy === "category" ? (docLookup[f.name]?.["Cat.Economic"] || "other") : "all";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  }

  const traces = Object.entries(grouped).map(([cat, facs]) => ({
    x: facs.map((f) => xDef.fmt(f)),
    y: facs.map((f) => yDef.fmt(f)),
    text: facs.map((f) => f.name),
    type: "scatter" as const,
    mode: "markers" as const,
    name: cat,
    marker: {
      size: 7,
      color: CAT_COLORS[cat] || "#94a3b8",
      opacity: 0.7,
    },
    hovertemplate: `%{text}<br>${xDef.label}: %{x:.3f}<br>${yDef.label}: %{y:.3f}<extra>${cat}</extra>`,
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#94a3b8]">
        Plot any factor statistic against any other on a scatter chart, colored by economic category. For example, plot Sharpe ratio vs. volatility to find high-Sharpe low-vol factors, or t-stat vs. max drawdown to see the risk-return frontier. Click any point to view the factor's details.
      </p>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-xs text-[#64748b]">X-axis:</label>
        <select value={xMetric} onChange={(e) => setXMetric(e.target.value)}
          className="px-2 py-1.5 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9] focus:outline-none focus:border-[#3b82f6]">
          {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <label className="text-xs text-[#64748b]">Y-axis:</label>
        <select value={yMetric} onChange={(e) => setYMetric(e.target.value)}
          className="px-2 py-1.5 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9] focus:outline-none focus:border-[#3b82f6]">
          {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <label className="text-xs text-[#64748b]">Color:</label>
        <select value={colorBy} onChange={(e) => setColorBy(e.target.value as any)}
          className="px-2 py-1.5 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9] focus:outline-none focus:border-[#3b82f6]">
          <option value="category">Economic Category</option>
          <option value="none">None</option>
        </select>
      </div>

      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <Plot
          data={traces}
          layout={{
            height: 600,
            margin: { t: 20, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { title: xDef.label, gridcolor: "#334155", zerolinecolor: "#475569" },
            yaxis: { title: yDef.label, gridcolor: "#334155", zerolinecolor: "#475569" },
            legend: { font: { size: 9 }, bgcolor: "rgba(30,41,59,0.8)" },
            hovermode: "closest",
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}
