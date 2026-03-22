import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";
import type { TimeSeries } from "../types";
import Methodology, { MNote } from "../components/Methodology";

interface WalkForwardData {
  objective: string;
  dates: string[];
  returns: number[];
  cumulative: number[];
  drawdown: number[];
  annual_returns: { years: number[]; values: number[] };
  weights_history: {
    year: number;
    n_factors: number;
    lookback_sharpe: number;
    weights: Record<string, number>;
    all_weights: Record<string, number>;
  }[];
  stats: Record<string, number>;
}

async function loadWalkForward(objective: string): Promise<WalkForwardData> {
  const resp = await fetch(`/data/walkforward_${objective}.json`);
  if (!resp.ok) throw new Error(`Failed to load walkforward_${objective}.json`);
  return resp.json();
}

export default function WalkForward() {
  const { data: maxSharpe, loading: l1 } = useData(
    useCallback(() => loadWalkForward("sharpe"), [])
  );
  const { data: maxReturn, loading: l2 } = useData(
    useCallback(() => loadWalkForward("return"), [])
  );
  const { data: equalWeight, loading: l3 } = useData(
    useCallback(() => loadWalkForward("equal_weight"), [])
  );
  const [objective, setObjective] = useState<"sharpe" | "return">("sharpe");
  const [logScale, setLogScale] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  if (l1 || l2 || l3) return <LoadingSpinner />;
  if (!maxSharpe || !maxReturn)
    return <div className="text-red-400">No walk-forward data. Run compute_walkforward.py first.</div>;

  const active = objective === "sharpe" ? maxSharpe : maxReturn;
  const other = objective === "sharpe" ? maxReturn : maxSharpe;
  const otherLabel = objective === "sharpe" ? "Max Return" : "Max Sharpe";

  // Default selected year to latest
  const years = active.weights_history.map((w) => w.year);
  const activeYear = selectedYear ?? years[years.length - 1];
  const yearWeights = active.weights_history.find((w) => w.year === activeYear);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[#94a3b8]">
          Walk-forward optimized multi-factor portfolio with no lookahead bias. At each year-end, uses all available history (expanding window, min 5 years per factor) to find optimal factor weights, then applies them out-of-sample for the next year. Compares max-Sharpe and max-return objectives against an equal-weight benchmark. Weight evolution shows how the optimizer's factor preferences shift over time.
        </p>
      </div>

      {/* Objective toggle */}
      <div className="flex gap-3 items-center">
        <div className="flex rounded-lg border border-[#334155] overflow-hidden">
          <button
            onClick={() => setObjective("sharpe")}
            className={`px-4 py-2 text-sm ${
              objective === "sharpe"
                ? "bg-[#3b82f6] text-white"
                : "bg-[#1e293b] text-[#94a3b8] hover:text-white"
            }`}
          >
            Maximize Sharpe Ratio
          </button>
          <button
            onClick={() => setObjective("return")}
            className={`px-4 py-2 text-sm ${
              objective === "return"
                ? "bg-[#10b981] text-white"
                : "bg-[#1e293b] text-[#94a3b8] hover:text-white"
            }`}
          >
            Maximize Return
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
          <input type="checkbox" checked={logScale} onChange={(e) => setLogScale(e.target.checked)} className="accent-[#3b82f6]" />
          Log scale
        </label>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="OOS Sharpe" value={active.stats.sharpe_ratio?.toFixed(3) ?? "N/A"} color={(active.stats.sharpe_ratio ?? 0) > 0 ? "#10b981" : "#ef4444"} />
        <StatCard label="OOS Ann. Return" value={`${((active.stats.ann_return ?? 0) * 100).toFixed(2)}%`} color={(active.stats.ann_return ?? 0) > 0 ? "#10b981" : "#ef4444"} />
        <StatCard label="OOS Ann. Vol" value={`${((active.stats.ann_volatility ?? 0) * 100).toFixed(2)}%`} />
        <StatCard label="t-Statistic" value={active.stats.t_stat?.toFixed(2) ?? "N/A"} color={Math.abs(active.stats.t_stat ?? 0) > 1.96 ? "#f59e0b" : undefined} />
        <StatCard label="Max Drawdown" value={`${((active.stats.max_drawdown ?? 0) * 100).toFixed(1)}%`} color="#ef4444" />
        <StatCard label="Calmar Ratio" value={active.stats.calmar?.toFixed(2) ?? "N/A"} />
        <StatCard label="% Positive Mo." value={`${((active.stats.pct_positive ?? 0) * 100).toFixed(1)}%`} />
      </div>

      {/* Cumulative return chart: active + other + equal weight */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          Out-of-Sample Cumulative Returns
        </h3>
        <Plot
          data={[
            {
              x: active.dates,
              y: active.cumulative,
              type: "scatter",
              mode: "lines",
              name: objective === "sharpe" ? "Max Sharpe (active)" : "Max Return (active)",
              line: { color: objective === "sharpe" ? "#3b82f6" : "#10b981", width: 2.5 },
            },
            {
              x: other.dates,
              y: other.cumulative,
              type: "scatter",
              mode: "lines",
              name: otherLabel,
              line: { color: objective === "sharpe" ? "#10b981" : "#3b82f6", width: 1.5, dash: "dash" },
              opacity: 0.7,
            },
            ...(equalWeight
              ? [
                  {
                    x: equalWeight.dates,
                    y: equalWeight.cumulative,
                    type: "scatter" as const,
                    mode: "lines" as const,
                    name: "Equal Weight (1/N)",
                    line: { color: "#94a3b8", width: 1.5, dash: "dot" as const },
                    opacity: 0.6,
                  },
                ]
              : []),
          ]}
          layout={{
            height: 500,
            margin: { t: 10, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { gridcolor: "#334155", type: "date", rangeslider: { visible: true } },
            yaxis: {
              title: "Growth of $1",
              gridcolor: "#334155",
              type: logScale ? "log" : "linear",
            },
            legend: { orientation: "h", y: -0.25, font: { size: 10 } },
            hovermode: "x unified",
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Drawdown */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Drawdown</h3>
        <Plot
          data={[
            {
              x: active.dates,
              y: active.drawdown.map((v) => v * 100),
              type: "scatter",
              mode: "lines",
              fill: "tozeroy",
              line: { color: "#ef4444", width: 1 },
              fillcolor: "rgba(239,68,68,0.15)",
              name: objective === "sharpe" ? "Max Sharpe" : "Max Return",
            },
          ]}
          layout={{
            height: 200,
            margin: { t: 10, b: 30, l: 60, r: 20 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { gridcolor: "#334155", type: "date" },
            yaxis: { title: "Drawdown (%)", gridcolor: "#334155", rangemode: "nonpositive" },
          }}
          config={{ displayModeBar: false }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Annual returns */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Annual Out-of-Sample Returns</h3>
        <Plot
          data={[
            {
              x: active.annual_returns.years.map(String),
              y: active.annual_returns.values.map((v) => v * 100),
              type: "bar",
              name: objective === "sharpe" ? "Max Sharpe" : "Max Return",
              marker: {
                color: active.annual_returns.values.map((v) =>
                  v >= 0 ? "#10b981" : "#ef4444"
                ),
              },
            },
          ]}
          layout={{
            height: 300,
            margin: { t: 10, b: 30, l: 50, r: 20 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { gridcolor: "#334155" },
            yaxis: { title: "Return (%)", gridcolor: "#334155", zerolinecolor: "#475569" },
          }}
          config={{ displayModeBar: false }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Strategy comparison table */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-3">Strategy Comparison (Out-of-Sample)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="px-3 py-2 text-left text-xs text-[#94a3b8]">Metric</th>
                <th className="px-3 py-2 text-right text-xs text-[#3b82f6]">Max Sharpe</th>
                <th className="px-3 py-2 text-right text-xs text-[#10b981]">Max Return</th>
                {equalWeight && <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Equal Weight</th>}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Sharpe Ratio", key: "sharpe_ratio", fmt: (v: number) => v.toFixed(3) },
                { label: "Ann. Return", key: "ann_return", fmt: (v: number) => `${(v * 100).toFixed(2)}%` },
                { label: "Ann. Volatility", key: "ann_volatility", fmt: (v: number) => `${(v * 100).toFixed(2)}%` },
                { label: "t-Statistic", key: "t_stat", fmt: (v: number) => v.toFixed(2) },
                { label: "Max Drawdown", key: "max_drawdown", fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
                { label: "Calmar Ratio", key: "calmar", fmt: (v: number) => v.toFixed(2) },
                { label: "% Positive Mo.", key: "pct_positive", fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
                { label: "Best Month", key: "best_month", fmt: (v: number) => `${(v * 100).toFixed(2)}%` },
                { label: "Worst Month", key: "worst_month", fmt: (v: number) => `${(v * 100).toFixed(2)}%` },
                { label: "Skewness", key: "skewness", fmt: (v: number) => v.toFixed(3) },
                { label: "Excess Kurtosis", key: "kurtosis", fmt: (v: number) => v.toFixed(3) },
                { label: "Months", key: "n_months", fmt: (v: number) => v.toString() },
              ].map((row) => (
                <tr key={row.key} className="border-t border-[#334155]/50">
                  <td className="px-3 py-1.5 text-[#94a3b8]">{row.label}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-[#f1f5f9]">
                    {maxSharpe.stats[row.key] != null ? row.fmt(maxSharpe.stats[row.key]) : "N/A"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[#f1f5f9]">
                    {maxReturn.stats[row.key] != null ? row.fmt(maxReturn.stats[row.key]) : "N/A"}
                  </td>
                  {equalWeight && (
                    <td className="px-3 py-1.5 text-right font-mono text-[#94a3b8]">
                      {equalWeight.stats[row.key] != null ? row.fmt(equalWeight.stats[row.key]) : "N/A"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weight evolution */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-3">
          Factor Weights by Year
        </h3>
        <div className="flex gap-3 items-center mb-3">
          <span className="text-xs text-[#64748b]">Select year:</span>
          <div className="flex flex-wrap gap-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-2 py-1 rounded text-xs ${
                  y === activeYear
                    ? "bg-[#3b82f6] text-white"
                    : "bg-[#334155] text-[#94a3b8] hover:text-white"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {yearWeights && (
          <div>
            <div className="text-xs text-[#64748b] mb-2">
              {yearWeights.n_factors} factors eligible | Lookback Sharpe: {yearWeights.lookback_sharpe.toFixed(3)} |
              {" "}{Object.keys(yearWeights.all_weights).length} factors with weight &gt; 0.1%
            </div>

            {/* Top weights bar chart */}
            <Plot
              data={[
                {
                  y: Object.keys(yearWeights.all_weights).sort(
                    (a, b) => yearWeights.all_weights[b] - yearWeights.all_weights[a]
                  ),
                  x: Object.keys(yearWeights.all_weights)
                    .sort(
                      (a, b) => yearWeights.all_weights[b] - yearWeights.all_weights[a]
                    )
                    .map((f) => yearWeights.all_weights[f] * 100),
                  type: "bar",
                  orientation: "h",
                  marker: { color: "#3b82f6" },
                  hovertemplate: "%{y}: %{x:.2f}%<extra></extra>",
                },
              ]}
              layout={{
                height: Math.max(300, Object.keys(yearWeights.all_weights).length * 18),
                margin: { t: 10, b: 30, l: 160, r: 20 },
                paper_bgcolor: "transparent",
                plot_bgcolor: "transparent",
                font: { color: "#94a3b8", size: 9 },
                xaxis: { title: "Weight (%)", gridcolor: "#334155" },
                yaxis: { autorange: "reversed" },
              }}
              config={{ displayModeBar: false }}
              style={{ width: "100%" }}
            />

            {/* Weight table */}
            <div className="mt-3 max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#1e293b]">
                  <tr>
                    <th className="px-2 py-1 text-left text-[#64748b]">Factor</th>
                    <th className="px-2 py-1 text-right text-[#64748b]">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(yearWeights.all_weights)
                    .sort(([, a], [, b]) => b - a)
                    .map(([factor, weight]) => (
                      <tr key={factor} className="border-t border-[#334155]/30">
                        <td className="px-2 py-1">
                          <FactorName name={factor} />
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-[#f1f5f9]">
                          {(weight * 100).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Lookback Sharpe evolution */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          In-Sample vs Out-of-Sample Performance by Year
        </h3>
        <Plot
          data={[
            {
              x: active.weights_history.map((w) => w.year.toString()),
              y: active.weights_history.map((w) => w.lookback_sharpe),
              type: "bar",
              name: "In-Sample Sharpe (annualized)",
              marker: { color: "#3b82f6", opacity: 0.5 },
            },
            {
              x: active.annual_returns.years.map(String),
              y: active.annual_returns.values.map((v) => v * 100),
              type: "scatter",
              mode: "lines+markers",
              name: "OOS Annual Return (%)",
              yaxis: "y2",
              line: { color: "#f59e0b", width: 2 },
              marker: { size: 5 },
            },
          ]}
          layout={{
            height: 300,
            margin: { t: 10, b: 30, l: 50, r: 50 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { gridcolor: "#334155" },
            yaxis: { title: "In-Sample Sharpe", gridcolor: "#334155", side: "left" },
            yaxis2: {
              title: "OOS Return (%)",
              overlaying: "y",
              side: "right",
              gridcolor: "transparent",
              zerolinecolor: "#475569",
            },
            legend: { orientation: "h", y: -0.2, font: { size: 10 } },
            barmode: "overlay",
          }}
          config={{ displayModeBar: false }}
          style={{ width: "100%" }}
        />
      </div>

      <Methodology>
        <MNote title="Walk-Forward Optimization">{"At each year-end $T$, the optimizer uses all available monthly returns from inception through $T$ (expanding window, minimum 5 years per factor) to solve for optimal weights, which are then applied out-of-sample for the 12 months of year $T+1$."}</MNote>
        <MNote title="Max Sharpe Objective">{"Maximize $w^\\top \\mu / \\sqrt{w^\\top \\Sigma w}$ subject to $w_i \\geq 0$, $\\sum w_i = 1$, $w_i \\leq 0.1$."}</MNote>
        <MNote title="Max Return Objective">{"Maximize $w^\\top \\mu$ subject to $w_i \\geq 0$, $\\sum w_i = 1$, $w_i \\leq 0.1$."}</MNote>
        <MNote title="Constraints">Weights are long-only, sum to 1, and capped at ~10% per factor. Only factors with at least 60 months of history at the optimization date are eligible. Covariance matrix {"$\\Sigma$"} uses the sample covariance of monthly returns.</MNote>
        <MNote title="Equal-Weight Benchmark">Equal-weights all eligible factors each year. Serves as a naive diversification benchmark with no optimization.</MNote>
        <MNote title="Data">Monthly long-short returns. Annual rebalance at each December. First optimized portfolio starts when sufficient history is available (~1940). No transaction costs or turnover constraints.</MNote>
      </Methodology>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0f172a] rounded-lg p-3 border border-[#334155]">
      <div className="text-[10px] text-[#64748b] uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold font-mono mt-0.5" style={{ color: color || "#f1f5f9" }}>
        {value}
      </div>
    </div>
  );
}
