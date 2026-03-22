import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import {
  loadStyleCumulative,
  loadStyleStats,
  loadStyleCorrelation,
  loadStyleComposition,
  loadStyleAnnual,
  loadStyleRolling,
} from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";
import { getColor } from "../chartColors";

const STYLE_COLORS: Record<string, string> = {
  Value: "#3b82f6",
  Momentum: "#ef4444",
  Quality: "#10b981",
  Investment: "#f59e0b",
  Risk: "#8b5cf6",
  Size: "#06b6d4",
  Accruals: "#ec4899",
  Liquidity: "#14b8a6",
  "Leverage & Financing": "#f97316",
  "Analyst & Sentiment": "#a855f7",
  "Intangibles & Innovation": "#84cc16",
  "Payout & Ownership": "#e11d48",
  "Sales Growth": "#0ea5e9",
  Other: "#64748b",
};

export default function StyleAnalysis() {
  const { data: cumulative, loading: l1 } = useData(useCallback(() => loadStyleCumulative(), []));
  const { data: stats, loading: l2 } = useData(useCallback(() => loadStyleStats(), []));
  const { data: corr, loading: l3 } = useData(useCallback(() => loadStyleCorrelation(), []));
  const { data: composition, loading: l4 } = useData(useCallback(() => loadStyleComposition(), []));
  const { data: annual, loading: l5 } = useData(useCallback(() => loadStyleAnnual(), []));
  const { data: rolling, loading: l6 } = useData(useCallback(() => loadStyleRolling(), []));
  const [selectedStyles, setSelectedStyles] = useState<string[]>([
    "Value", "Momentum", "Quality", "Investment", "Risk", "Liquidity",
  ]);
  const [showComposition, setShowComposition] = useState<string | null>(null);
  const [logScale, setLogScale] = useState(false);
  const [viewMode, setViewMode] = useState<"cumulative" | "rolling" | "annual">("cumulative");

  const allStyles = useMemo(() => {
    if (!stats) return [];
    return Object.keys(stats).sort((a, b) => {
      const sa = stats[a]?.sharpe_ratio ?? 0;
      const sb = stats[b]?.sharpe_ratio ?? 0;
      return sb - sa;
    });
  }, [stats]);

  if (l1 || l2 || l3 || l4 || l5 || l6) return <LoadingSpinner />;
  if (!cumulative || !stats || !corr) return <div className="text-red-400">No style data available. Run compute_styles.py first.</div>;

  function toggleStyle(style: string) {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  }

  // Performance chart traces
  const chartData = viewMode === "cumulative" ? cumulative : viewMode === "rolling" ? rolling : null;

  const lineTraces = chartData
    ? selectedStyles
        .filter((s) => chartData[s])
        .map((s) => ({
          x: chartData[s].dates,
          y: chartData[s].values.map((v) =>
            viewMode === "rolling" ? v * 100 : v
          ),
          type: "scatter" as const,
          mode: "lines" as const,
          name: s,
          line: { color: STYLE_COLORS[s] || "#94a3b8", width: 2 },
        }))
    : [];

  // Annual bar traces
  const annualTraces =
    viewMode === "annual" && annual
      ? selectedStyles
          .filter((s) => annual[s])
          .map((s) => ({
            x: annual[s].years.map(String),
            y: annual[s].values.map((v) => v * 100),
            type: "bar" as const,
            name: s,
            marker: { color: STYLE_COLORS[s] || "#94a3b8" },
          }))
      : [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        Equal-weighted composite returns across factor style groups.
        Each style is the simple average of all available factor returns in that category each month.
      </p>

      {/* Style toggles */}
      <div className="flex flex-wrap gap-2">
        {allStyles.map((style) => {
          const isActive = selectedStyles.includes(style);
          const color = STYLE_COLORS[style] || "#94a3b8";
          const s = stats[style];
          return (
            <button
              key={style}
              onClick={() => toggleStyle(style)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isActive
                  ? "border-transparent"
                  : "border-[#334155] opacity-40 hover:opacity-70"
              }`}
              style={
                isActive
                  ? { backgroundColor: color + "25", color, borderColor: color + "50" }
                  : {}
              }
            >
              {style}
              {s && (
                <span className="ml-1.5 opacity-70">
                  ({s.n_factors}f, SR {s.sharpe_ratio.toFixed(2)})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stats table */}
      <div className="overflow-x-auto rounded-lg border border-[#334155]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1e293b]">
              <th className="px-3 py-2 text-left text-xs text-[#94a3b8]">Style</th>
              <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Factors</th>
              <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Sharpe</th>
              <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Ann. Ret</th>
              <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Ann. Vol</th>
              <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">t-Stat</th>
              <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Max DD</th>
              <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">% Pos</th>
              <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Months</th>
            </tr>
          </thead>
          <tbody>
            {allStyles.map((style) => {
              const s = stats[style];
              if (!s) return null;
              const color = STYLE_COLORS[style] || "#94a3b8";
              return (
                <tr
                  key={style}
                  className="border-t border-[#334155] hover:bg-[#1e293b] cursor-pointer transition-colors"
                  onClick={() =>
                    setShowComposition(showComposition === style ? null : style)
                  }
                >
                  <td className="px-3 py-2 font-medium" style={{ color }}>
                    {style}
                  </td>
                  <td className="px-3 py-2 text-right text-[#94a3b8]">{s.n_factors}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={s.sharpe_ratio > 0 ? "text-[#10b981]" : "text-[#ef4444]"}>
                      {s.sharpe_ratio.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={s.ann_return > 0 ? "text-[#10b981]" : "text-[#ef4444]"}>
                      {(s.ann_return * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{(s.ann_volatility * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right">
                    <span className={Math.abs(s.t_stat) > 1.96 ? "text-[#f59e0b]" : ""}>
                      {s.t_stat.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-[#ef4444]">
                    {(s.max_drawdown * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right">{(s.pct_positive * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right text-[#94a3b8]">{s.n_months}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Composition panel */}
      {showComposition && composition?.[showComposition] && (
        <div className="bg-[#1e293b] rounded-lg border border-[#334155] p-4">
          <h3
            className="text-sm font-semibold mb-2"
            style={{ color: STYLE_COLORS[showComposition] || "#f1f5f9" }}
          >
            {showComposition} - Component Factors ({composition[showComposition].length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {composition[showComposition].map((f) => (
              <FactorName
                key={f}
                name={f}
                className="px-2 py-1 rounded bg-[#334155] font-mono text-xs text-[#3b82f6] hover:bg-[#475569] hover:underline decoration-dotted underline-offset-2 cursor-pointer"
              />
            ))}
          </div>
        </div>
      )}

      {/* Chart controls */}
      <div className="flex gap-3 items-center">
        <div className="flex rounded-lg border border-[#334155] overflow-hidden">
          {(["cumulative", "rolling", "annual"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs ${
                viewMode === mode
                  ? "bg-[#3b82f6] text-white"
                  : "bg-[#1e293b] text-[#94a3b8] hover:text-white"
              }`}
            >
              {mode === "cumulative"
                ? "Cumulative"
                : mode === "rolling"
                ? "Rolling 12m"
                : "Annual"}
            </button>
          ))}
        </div>
        {viewMode === "cumulative" && (
          <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
            <input
              type="checkbox"
              checked={logScale}
              onChange={(e) => setLogScale(e.target.checked)}
              className="accent-[#3b82f6]"
            />
            Log scale
          </label>
        )}
      </div>

      {/* Performance chart */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          {viewMode === "cumulative"
            ? "Cumulative Style Returns ($1 invested)"
            : viewMode === "rolling"
            ? "Rolling 12-Month Style Returns"
            : "Annual Style Returns"}
        </h3>
        <Plot
          data={viewMode === "annual" ? annualTraces : lineTraces}
          layout={{
            height: 500,
            margin: { t: 10, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: {
              gridcolor: "#334155",
              ...(viewMode !== "annual" ? { type: "date", rangeslider: { visible: true } } : {}),
            },
            yaxis: {
              title:
                viewMode === "cumulative"
                  ? "Cumulative Return"
                  : viewMode === "rolling"
                  ? "Return (%)"
                  : "Return (%)",
              gridcolor: "#334155",
              zerolinecolor: "#475569",
              ...(viewMode === "cumulative" && logScale ? { type: "log" } : {}),
            },
            legend: { orientation: "h", y: -0.25, font: { size: 10 } },
            hovermode: "x unified",
            ...(viewMode === "annual" ? { barmode: "group" } : {}),
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Correlation matrix */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          Style Correlation Matrix
        </h3>
        <p className="text-xs text-[#64748b] mb-3">
          Pairwise correlation of monthly equal-weighted style returns.
        </p>
        <Plot
          data={[
            {
              z: corr.matrix,
              x: corr.factors,
              y: corr.factors,
              type: "heatmap",
              colorscale: [
                [0, "#3b82f6"],
                [0.5, "#0f172a"],
                [1, "#ef4444"],
              ],
              zmid: 0,
              zmin: -1,
              zmax: 1,
              colorbar: {
                title: "Correlation",
                titlefont: { color: "#94a3b8" },
                tickfont: { color: "#94a3b8" },
              },
              hovertemplate: "%{x} vs %{y}: %{z:.3f}<extra></extra>",
              text: corr.matrix.map((row) =>
                row.map((v) => (v != null ? v.toFixed(2) : ""))
              ),
              texttemplate: "%{text}",
              textfont: { size: 9, color: "#94a3b8" },
            },
          ]}
          layout={{
            height: 550,
            width: 700,
            margin: { t: 10, b: 130, l: 140, r: 50 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 10 },
            xaxis: { tickangle: -45 },
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Diversification insight */}
      <DiversificationInsight stats={stats} corr={corr} />
    </div>
  );
}

function DiversificationInsight({
  stats,
  corr,
}: {
  stats: Record<string, { sharpe_ratio: number; ann_return: number; ann_volatility: number; name: string }>;
  corr: { factors: string[]; matrix: number[][] };
}) {
  // Find the pair with lowest correlation
  let minCorr = 1;
  let minPair = ["", ""];
  let maxCorr = -1;
  let maxPair = ["", ""];

  for (let i = 0; i < corr.factors.length; i++) {
    for (let j = i + 1; j < corr.factors.length; j++) {
      const c = corr.matrix[i][j];
      if (c != null) {
        if (c < minCorr) {
          minCorr = c;
          minPair = [corr.factors[i], corr.factors[j]];
        }
        if (c > maxCorr) {
          maxCorr = c;
          maxPair = [corr.factors[i], corr.factors[j]];
        }
      }
    }
  }

  // Average correlation
  let sum = 0;
  let count = 0;
  for (let i = 0; i < corr.matrix.length; i++) {
    for (let j = i + 1; j < corr.matrix[i].length; j++) {
      if (corr.matrix[i][j] != null) {
        sum += corr.matrix[i][j];
        count++;
      }
    }
  }
  const avgCorr = count > 0 ? sum / count : 0;

  return (
    <div className="bg-[#1e293b] rounded-lg border border-[#334155] p-4">
      <h3 className="text-sm font-semibold text-[#f1f5f9] mb-3">
        Diversification Insights
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-[10px] text-[#64748b] uppercase tracking-wider">
            Average Pairwise Correlation
          </div>
          <div className="text-lg font-mono text-[#f1f5f9]">{avgCorr.toFixed(3)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#64748b] uppercase tracking-wider">
            Best Diversifier Pair (lowest corr)
          </div>
          <div className="text-sm">
            <span className="text-[#10b981] font-mono">{minCorr.toFixed(3)}</span>
            <span className="text-[#94a3b8] ml-2">{minPair[0]} + {minPair[1]}</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#64748b] uppercase tracking-wider">
            Most Correlated Pair
          </div>
          <div className="text-sm">
            <span className="text-[#ef4444] font-mono">{maxCorr.toFixed(3)}</span>
            <span className="text-[#94a3b8] ml-2">{maxPair[0]} + {maxPair[1]}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
