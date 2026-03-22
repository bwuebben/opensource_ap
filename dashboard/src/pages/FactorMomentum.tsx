import { useCallback, useRef } from "react";
// @ts-expect-error - no types for dist-min
import Plotly from "plotly.js-dist-min";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import LoadingSpinner from "../components/LoadingSpinner";
import Methodology, { MathBlock, MNote } from "../components/Methodology";

interface FMomData {
  dates: string[];
  long_short_returns: number[];
  long_only_returns: number[];
  zscore_weighted_returns: number[];
  zscore_weighted_lo_returns: number[];
  cumulative_ls: number[];
  cumulative_lo: number[];
  cumulative_zw: number[];
  cumulative_zw_lo: number[];
  stats_ls: Record<string, number>;
  stats_lo: Record<string, number>;
  stats_zw: Record<string, number>;
  stats_zw_lo: Record<string, number>;
}

async function loadFMom(): Promise<FMomData> {
  const r = await fetch("/data/factor_momentum.json");
  if (!r.ok) throw new Error("No factor momentum data");
  return r.json();
}

export default function FactorMomentum() {
  const { data, loading } = useData(useCallback(() => loadFMom(), []));
  const chartRef = useRef<HTMLDivElement>(null);
  const updatingRef = useRef(false);

  const handleRelayout = useCallback((event: Record<string, unknown>) => {
    if (!data || !chartRef.current || updatingRef.current) return;
    // Only respond to x-axis range changes (from the range slider)
    const range = event["xaxis.range"] as number[] | undefined;
    const x0 = event["xaxis.range[0]"] ?? range?.[0];
    const x1 = event["xaxis.range[1]"] ?? range?.[1];
    // Ignore events that don't involve x-axis range (e.g. our own y-axis updates)
    if (x0 == null && x1 == null && !event["xaxis.autorange"]) return;
    updatingRef.current = true;
    try {
      if (x0 == null || x1 == null) {
        Plotly.relayout(chartRef.current, { "yaxis.autorange": true });
        return;
      }
      const startDate = new Date(x0 as string).getTime();
      const endDate = new Date(x1 as string).getTime();
      let yMin = Infinity, yMax = -Infinity;
      for (const series of [data.cumulative_ls, data.cumulative_lo, data.cumulative_zw, data.cumulative_zw_lo]) {
        for (let i = 0; i < data.dates.length; i++) {
          const t = new Date(data.dates[i]).getTime();
          if (t >= startDate && t <= endDate && series[i] != null) {
            if (series[i] < yMin) yMin = series[i];
            if (series[i] > yMax) yMax = series[i];
          }
        }
      }
      if (yMin < Infinity) {
        const logMin = Math.log10(yMin) - 0.05 * (Math.log10(yMax) - Math.log10(yMin));
        const logMax = Math.log10(yMax) + 0.05 * (Math.log10(yMax) - Math.log10(yMin));
        Plotly.relayout(chartRef.current, {
          "yaxis.autorange": false,
          "yaxis.range": [logMin, logMax],
        });
      }
    } finally {
      updatingRef.current = false;
    }
  }, [data]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-red-400">No factor momentum data. Run compute_research.py.</div>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        Factor momentum: each month rank all factors by their trailing 12-month return.
        {" "}<strong>L/S Quintile</strong>: long top 20%, short bottom 20% (equal weight).
        {" "}<strong>Long-Only</strong>: long top 20% only (equal weight) — the long leg of L/S without the short hedge.
        {" "}<strong>Z-Score L/S</strong>: weight each factor by z-score of its trailing 12-month return, normalized to leverage 1.
        {" "}<strong>Z-Score Long-Only</strong>: long leg only — factors with positive z-scores, weighted proportionally.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center text-xs text-[#64748b] font-semibold col-span-3 lg:col-span-3">L/S Quintile</div>
        <StatCard label="Sharpe" value={data.stats_ls.sharpe_ratio?.toFixed(3) ?? "N/A"} color={(data.stats_ls.sharpe_ratio ?? 0) > 0 ? "#10b981" : "#ef4444"} />
        <StatCard label="Ann. Ret" value={`${((data.stats_ls.ann_return ?? 0) * 100).toFixed(2)}%`} />
        <StatCard label="Max DD" value={`${((data.stats_ls.max_drawdown ?? 0) * 100).toFixed(1)}%`} color="#ef4444" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center text-xs text-[#64748b] font-semibold col-span-3">Long-Only Quintile</div>
        <StatCard label="Sharpe" value={data.stats_lo.sharpe_ratio?.toFixed(3) ?? "N/A"} color={(data.stats_lo.sharpe_ratio ?? 0) > 0 ? "#10b981" : "#ef4444"} />
        <StatCard label="Ann. Ret" value={`${((data.stats_lo.ann_return ?? 0) * 100).toFixed(2)}%`} />
        <StatCard label="Max DD" value={`${((data.stats_lo.max_drawdown ?? 0) * 100).toFixed(1)}%`} color="#ef4444" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center text-xs text-[#64748b] font-semibold col-span-3">Z-Score L/S</div>
        <StatCard label="Sharpe" value={data.stats_zw.sharpe_ratio?.toFixed(3) ?? "N/A"} color={(data.stats_zw.sharpe_ratio ?? 0) > 0 ? "#10b981" : "#ef4444"} />
        <StatCard label="Ann. Ret" value={`${((data.stats_zw.ann_return ?? 0) * 100).toFixed(2)}%`} />
        <StatCard label="Max DD" value={`${((data.stats_zw.max_drawdown ?? 0) * 100).toFixed(1)}%`} color="#ef4444" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center text-xs text-[#64748b] font-semibold col-span-3">Z-Score Long-Only</div>
        <StatCard label="Sharpe" value={data.stats_zw_lo.sharpe_ratio?.toFixed(3) ?? "N/A"} color={(data.stats_zw_lo.sharpe_ratio ?? 0) > 0 ? "#10b981" : "#ef4444"} />
        <StatCard label="Ann. Ret" value={`${((data.stats_zw_lo.ann_return ?? 0) * 100).toFixed(2)}%`} />
        <StatCard label="Max DD" value={`${((data.stats_zw_lo.max_drawdown ?? 0) * 100).toFixed(1)}%`} color="#ef4444" />
      </div>

      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Cumulative Returns</h3>
        <div ref={(el) => { if (el) chartRef.current = el.firstElementChild as HTMLDivElement; }}>
          <Plot
            data={[
              {
                x: data.dates, y: data.cumulative_ls,
                type: "scatter", mode: "lines",
                name: "Long/Short Factor Momentum",
                line: { color: "#3b82f6", width: 2 },
              },
              {
                x: data.dates, y: data.cumulative_lo,
                type: "scatter", mode: "lines",
                name: "Long-Only (Top Quintile)",
                line: { color: "#10b981", width: 2, dash: "dash" },
              },
              {
                x: data.dates, y: data.cumulative_zw,
                type: "scatter", mode: "lines",
                name: "Z-Score L/S",
                line: { color: "#f59e0b", width: 2 },
              },
              {
                x: data.dates, y: data.cumulative_zw_lo,
                type: "scatter", mode: "lines",
                name: "Z-Score Long-Only",
                line: { color: "#a855f7", width: 2, dash: "dash" },
              },
            ]}
            layout={{
              height: 450,
              margin: { t: 10, b: 50, l: 60, r: 20 },
              paper_bgcolor: "transparent", plot_bgcolor: "transparent",
              font: { color: "#94a3b8", size: 11 },
              xaxis: { gridcolor: "#334155", type: "date", rangeslider: { visible: true } },
              yaxis: { title: "Growth of $1", gridcolor: "#334155", type: "log" },
              legend: { orientation: "h", y: -0.25, font: { size: 10 } },
              hovermode: "x unified",
            }}
            config={{ responsive: true }}
            style={{ width: "100%" }}
            onRelayout={handleRelayout}
          />
        </div>
      </div>

      {/* Monthly return distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
          <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">L/S Monthly Return Distribution</h3>
          <Plot
            data={[{
              x: data.long_short_returns.map((v) => v * 100),
              type: "histogram", marker: { color: "#3b82f6" }, nbinsx: 50,
            }]}
            layout={{
              height: 250, margin: { t: 10, b: 30, l: 50, r: 20 },
              paper_bgcolor: "transparent", plot_bgcolor: "transparent",
              font: { color: "#94a3b8", size: 11 },
              xaxis: { title: "Monthly Return (%)", gridcolor: "#334155" },
              yaxis: { title: "Count", gridcolor: "#334155" },
            }}
            config={{ displayModeBar: false }}
            style={{ width: "100%" }}
          />
        </div>

        <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
          <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Strategy Comparison</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="px-2 py-1 text-left text-xs text-[#94a3b8]">Metric</th>
                <th className="px-2 py-1 text-right text-xs text-[#3b82f6]">Long/Short</th>
                <th className="px-2 py-1 text-right text-xs text-[#10b981]">Long-Only</th>
                <th className="px-2 py-1 text-right text-xs text-[#f59e0b]">Z-Score L/S</th>
                <th className="px-2 py-1 text-right text-xs text-[#a855f7]">Z-Score LO</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Sharpe", key: "sharpe_ratio", fmt: (v: number) => v.toFixed(3) },
                { label: "Ann. Return", key: "ann_return", fmt: (v: number) => `${(v*100).toFixed(2)}%` },
                { label: "Ann. Vol", key: "ann_volatility", fmt: (v: number) => `${(v*100).toFixed(2)}%` },
                { label: "t-Stat", key: "t_stat", fmt: (v: number) => v.toFixed(2) },
                { label: "Max DD", key: "max_drawdown", fmt: (v: number) => `${(v*100).toFixed(1)}%` },
                { label: "% Positive", key: "pct_positive", fmt: (v: number) => `${(v*100).toFixed(1)}%` },
              ].map((r) => (
                <tr key={r.key} className="border-t border-[#334155]/50">
                  <td className="px-2 py-1 text-[#94a3b8]">{r.label}</td>
                  <td className="px-2 py-1 text-right font-mono">{data.stats_ls[r.key] != null ? r.fmt(data.stats_ls[r.key]) : "N/A"}</td>
                  <td className="px-2 py-1 text-right font-mono">{data.stats_lo[r.key] != null ? r.fmt(data.stats_lo[r.key]) : "N/A"}</td>
                  <td className="px-2 py-1 text-right font-mono">{data.stats_zw[r.key] != null ? r.fmt(data.stats_zw[r.key]) : "N/A"}</td>
                  <td className="px-2 py-1 text-right font-mono">{data.stats_zw_lo[r.key] != null ? r.fmt(data.stats_zw_lo[r.key]) : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Methodology>
        <MNote title="Trailing Signal">Each month, compute the trailing 12-month cumulative return for each factor:</MNote>
        <MathBlock>{"$$S_{i,t} = \\prod_{k=1}^{12} (1 + r_{i,t-k}) - 1$$"}</MathBlock>
        <MNote title="L/S Quintile">{"Rank factors by $S_{i,t}$. Go long the top 20% and short the bottom 20%, equal-weighted. Portfolio return: $r_t^{LS} = \\bar{r}_t^{\\text{top}} - \\bar{r}_t^{\\text{bottom}}$."}</MNote>
        <MNote title="Long-Only Quintile">Top quintile only: {"$r_t^{LO} = \\bar{r}_t^{\\text{top}}$"}.</MNote>
        <MNote title="Z-Score Weighted L/S">Compute cross-sectional z-scores of trailing returns: {"$z_{i,t} = (S_{i,t} - \\bar{S}_t) / \\sigma_{S,t}$"}. Weights are proportional to z-scores, normalized so {"$\\sum_i |w_i| = 1$"} (leverage 1). Portfolio return: {"$r_t^{ZW} = \\sum_i w_{i,t} \\cdot r_{i,t+1}$"}.</MNote>
        <MNote title="Z-Score Long-Only">Uses only factors with positive z-scores, with weights proportional to their z-scores normalized to sum to 1.</MNote>
        <MNote title="Data">Factors with missing trailing 12-month windows are excluded that month. After dropping missing next-month returns, weights are renormalized. Minimum 10 factors required per month. Statistics (Sharpe, max drawdown, etc.) use the same formulas as elsewhere.</MNote>
      </Methodology>
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
