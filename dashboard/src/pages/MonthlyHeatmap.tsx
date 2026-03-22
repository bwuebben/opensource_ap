import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { loadMonthlyReturns, loadFactorStats } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthlyHeatmap() {
  const { data: monthly, loading: l1 } = useData(
    useCallback(() => loadMonthlyReturns(), [])
  );
  const { data: stats, loading: l2 } = useData(
    useCallback(() => loadFactorStats(), [])
  );
  const [factor, setFactor] = useState("Mom12m");

  if (l1 || l2) return <LoadingSpinner />;
  if (!monthly || !stats) return <div className="text-red-400">No data</div>;

  const allFactors = Object.keys(monthly).sort();
  // Default to first available if selected doesn't exist
  const activeFactor = monthly[factor] ? factor : allFactors[0];

  // Build year x month matrix
  const series = monthly[activeFactor];
  const yearMonth: Record<number, Record<number, number>> = {};
  for (let i = 0; i < series.dates.length; i++) {
    const d = new Date(series.dates[i]);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-based
    if (!yearMonth[year]) yearMonth[year] = {};
    yearMonth[year][month] = series.values[i];
  }

  const years = Object.keys(yearMonth)
    .map(Number)
    .sort((a, b) => a - b);

  const z: (number | null)[][] = [];
  for (const year of years) {
    const row: (number | null)[] = [];
    for (let m = 0; m < 12; m++) {
      row.push(yearMonth[year]?.[m] ?? null);
    }
    z.push(row);
  }

  // Also compute average monthly return per month across all years
  const avgByMonth = MONTHS.map((_, m) => {
    const vals = years.map((y) => yearMonth[y]?.[m]).filter((v) => v != null) as number[];
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select
          value={activeFactor}
          onChange={(e) => setFactor(e.target.value)}
          className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9] focus:outline-none focus:border-[#3b82f6]"
        >
          {allFactors.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <span className="text-xs text-[#64748b]">
          {stats[activeFactor]
            ? `Sharpe: ${stats[activeFactor].sharpe_ratio.toFixed(3)} | t-stat: ${stats[activeFactor].t_stat.toFixed(2)}`
            : ""}
        </span>
      </div>

      {/* Heatmap */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          Monthly Returns Heatmap: <FactorName name={activeFactor} className="font-mono text-[#3b82f6] hover:underline decoration-dotted underline-offset-2 cursor-pointer" />
        </h3>
        <Plot
          data={[
            {
              z: z.map((row) => row.map((v) => (v != null ? v * 100 : null))),
              x: MONTHS,
              y: years.map(String),
              type: "heatmap",
              colorscale: [
                [0, "#ef4444"],
                [0.5, "#1e293b"],
                [1, "#10b981"],
              ],
              zmid: 0,
              colorbar: {
                title: "Return (%)",
                titlefont: { color: "#94a3b8" },
                tickfont: { color: "#94a3b8" },
              },
              hovertemplate: "%{y} %{x}: %{z:.2f}%<extra></extra>",
            },
          ]}
          layout={{
            height: Math.max(400, years.length * 16),
            margin: { t: 10, b: 40, l: 60, r: 80 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 10 },
            xaxis: { side: "top" },
            yaxis: { autorange: "reversed" },
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Average by month bar chart */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          Average Monthly Return by Calendar Month
        </h3>
        <Plot
          data={[
            {
              x: MONTHS,
              y: avgByMonth.map((v) => v * 100),
              type: "bar",
              marker: {
                color: avgByMonth.map((v) => (v >= 0 ? "#10b981" : "#ef4444")),
              },
              hovertemplate: "%{x}: %{y:.3f}%<extra></extra>",
            },
          ]}
          layout={{
            height: 250,
            margin: { t: 10, b: 30, l: 50, r: 20 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            yaxis: { title: "Avg Return (%)", gridcolor: "#334155" },
          }}
          config={{ displayModeBar: false }}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}
