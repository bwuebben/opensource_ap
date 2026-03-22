import { useCallback } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import LoadingSpinner from "../components/LoadingSpinner";

interface CrowdingData {
  dates: string[];
  avg_correlation: number[];
  top_factors: string[];
}

async function loadCrowding(): Promise<CrowdingData> {
  const r = await fetch("/data/rolling_correlations.json");
  if (!r.ok) throw new Error("No crowding data");
  return r.json();
}

export default function Crowding() {
  const { data, loading } = useData(useCallback(() => loadCrowding(), []));

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-red-400">No crowding data. Run compute_research.py.</div>;

  // Compute some stats
  const vals = data.avg_correlation.filter((v) => v != null);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const current = vals[vals.length - 1];
  const max = Math.max(...vals);
  const min = Math.min(...vals);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        Average pairwise correlation among the top 30 factors (by Sharpe), computed on a rolling 36-month window.
        Rising correlations suggest factor crowding — when many factors move together, diversification benefits shrink.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Current Avg Corr" value={current?.toFixed(3) ?? "N/A"} />
        <StatCard label="Long-run Average" value={avg.toFixed(3)} />
        <StatCard label="Historical Max" value={max.toFixed(3)} color="#ef4444" />
        <StatCard label="Historical Min" value={min.toFixed(3)} color="#10b981" />
      </div>

      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          Rolling 36-Month Average Pairwise Correlation (Top 30 Factors)
        </h3>
        <Plot
          data={[
            {
              x: data.dates, y: data.avg_correlation,
              type: "scatter", mode: "lines",
              line: { color: "#3b82f6", width: 1.5 },
              fill: "tozeroy", fillcolor: "rgba(59,130,246,0.1)",
            },
            {
              x: data.dates, y: data.dates.map(() => avg),
              type: "scatter", mode: "lines",
              line: { color: "#f59e0b", width: 1, dash: "dash" },
              name: "Long-run avg",
            },
          ]}
          layout={{
            height: 400,
            margin: { t: 10, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { gridcolor: "#334155", type: "date" },
            yaxis: { title: "Avg Pairwise Correlation", gridcolor: "#334155" },
            showlegend: false,
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Factors Used</h3>
        <p className="text-xs text-[#94a3b8]">{data.top_factors.join(", ")}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0f172a] rounded-lg p-3 border border-[#334155]">
      <div className="text-[10px] text-[#64748b] uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold font-mono mt-0.5" style={{ color: color || "#f1f5f9" }}>{value}</div>
    </div>
  );
}
