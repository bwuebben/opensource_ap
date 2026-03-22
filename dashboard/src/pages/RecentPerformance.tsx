import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { dataUrl } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";
import Methodology, { MathBlock, MNote } from "../components/Methodology";

interface RecentData {
  as_of: string;
  factors: Record<string, { ret_1m: number; ret_3m: number; ret_6m: number; ret_12m: number }>;
}

async function loadRecent(): Promise<RecentData> {
  const r = await fetch(dataUrl("recent_performance.json"));
  if (!r.ok) throw new Error("No recent data");
  return r.json();
}

type Period = "ret_1m" | "ret_3m" | "ret_6m" | "ret_12m";

export default function RecentPerformance() {
  const { data, loading } = useData(useCallback(() => loadRecent(), []));
  const [period, setPeriod] = useState<Period>("ret_12m");
  const [showN] = useState(20);

  const sorted = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.factors)
      .map(([name, v]) => ({ name, ...v }))
      .filter((f) => f[period] != null)
      .sort((a, b) => b[period] - a[period]);
  }, [data, period]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-red-400">No recent performance data.</div>;

  const top = sorted.slice(0, showN);
  const bottom = sorted.slice(-showN).reverse();
  const periodLabel = { ret_1m: "1 Month", ret_3m: "3 Month", ret_6m: "6 Month", ret_12m: "12 Month" }[period];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#94a3b8]">
          Factor performance leaderboard over recent windows (1, 3, 6, and 12 months). Shows which factors are working right now and which are in drawdown. Useful for momentum-based factor timing or simply staying current on the factor landscape. Data as of <span className="text-[#f1f5f9] font-mono">{data.as_of}</span>.
        </p>
        <div className="flex gap-2">
          {(["ret_1m", "ret_3m", "ret_6m", "ret_12m"] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-xs ${p === period ? "bg-[#3b82f6] text-white" : "bg-[#1e293b] text-[#94a3b8] hover:text-white border border-[#334155]"}`}>
              {p.replace("ret_", "").replace("m", "M")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Winners */}
        <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
          <h3 className="text-sm font-semibold text-[#10b981] mb-2">Top {showN} - {periodLabel}</h3>
          <Plot
            data={[{
              y: top.map((f) => f.name),
              x: top.map((f) => f[period] * 100),
              type: "bar", orientation: "h",
              marker: { color: "#10b981" },
              hovertemplate: "%{y}: %{x:.2f}%<extra></extra>",
            }]}
            layout={{
              height: Math.max(300, showN * 22),
              margin: { t: 10, b: 30, l: 150, r: 20 },
              paper_bgcolor: "transparent", plot_bgcolor: "transparent",
              font: { color: "#94a3b8", size: 9 },
              xaxis: { title: "Return (%)", gridcolor: "#334155" },
              yaxis: { autorange: "reversed" },
            }}
            config={{ displayModeBar: false }}
            style={{ width: "100%" }}
          />
        </div>

        {/* Losers */}
        <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
          <h3 className="text-sm font-semibold text-[#ef4444] mb-2">Bottom {showN} - {periodLabel}</h3>
          <Plot
            data={[{
              y: bottom.map((f) => f.name),
              x: bottom.map((f) => f[period] * 100),
              type: "bar", orientation: "h",
              marker: { color: "#ef4444" },
              hovertemplate: "%{y}: %{x:.2f}%<extra></extra>",
            }]}
            layout={{
              height: Math.max(300, showN * 22),
              margin: { t: 10, b: 30, l: 150, r: 20 },
              paper_bgcolor: "transparent", plot_bgcolor: "transparent",
              font: { color: "#94a3b8", size: 9 },
              xaxis: { title: "Return (%)", gridcolor: "#334155" },
              yaxis: { autorange: "reversed" },
            }}
            config={{ displayModeBar: false }}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      {/* Full table */}
      <div className="overflow-x-auto rounded-lg border border-[#334155] max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#1e293b]">
            <tr>
              <th className="px-2 py-1.5 text-left text-[#94a3b8]">#</th>
              <th className="px-2 py-1.5 text-left text-[#94a3b8]">Factor</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">1M</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">3M</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">6M</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">12M</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f, i) => (
              <tr key={f.name} className="border-t border-[#334155]/50 hover:bg-[#1e293b]">
                <td className="px-2 py-1 text-[#64748b]">{i + 1}</td>
                <td className="px-2 py-1"><FactorName name={f.name} /></td>
                {(["ret_1m", "ret_3m", "ret_6m", "ret_12m"] as Period[]).map((p) => (
                  <td key={p} className="px-2 py-1 text-right font-mono"
                      style={{ color: f[p] > 0 ? "#10b981" : f[p] < 0 ? "#ef4444" : "#94a3b8" }}>
                    {(f[p] * 100).toFixed(2)}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Methodology>
        <MNote title="Trailing Returns">Cumulative return over the trailing 1, 3, 6, and 12 months ending at the most recent data date:</MNote>
        <MathBlock>{"$$r_{\\text{trailing}} = \\prod_{t=T-k+1}^{T} (1 + r_t) - 1$$"}</MathBlock>
        <MNote title="Ranking">Factors are ranked by trailing return within each window. The leaderboard shows top and bottom performers.</MNote>
        <MNote title="Data">Uses the most recent available monthly returns. Factors missing any month within the trailing window are excluded from that window's ranking. Returns are not annualized.</MNote>
      </Methodology>
    </div>
  );
}
