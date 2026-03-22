import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";

interface TailData {
  factors: Record<string, {
    var_95: number; cvar_95: number; max_dd: number;
    max_dd_duration_months: number;
    worst_episodes: { start: string; trough: string; end: string | null; depth: number }[];
  }>;
}

async function loadTail(): Promise<TailData> {
  const r = await fetch("/data/tail_risk.json");
  if (!r.ok) throw new Error("No tail risk data");
  return r.json();
}

export default function TailRisk() {
  const { data, loading } = useData(useCallback(() => loadTail(), []));
  const [sortKey, setSortKey] = useState<"cvar_95" | "max_dd" | "max_dd_duration_months">("cvar_95");
  const [selectedFactor, setSelectedFactor] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.factors)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => {
        if (sortKey === "max_dd_duration_months") return b[sortKey] - a[sortKey];
        return a[sortKey] - b[sortKey]; // more negative = worse
      });
  }, [data, sortKey]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-red-400">No tail risk data. Run compute_research.py.</div>;

  const top30 = sorted.slice(0, 30);
  const active = selectedFactor ? data.factors[selectedFactor] : null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        Tail risk analysis: VaR, CVaR (Expected Shortfall), maximum drawdown duration,
        and worst drawdown episodes for each factor.
      </p>

      {/* VaR/CVaR scatter */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">VaR (95%) vs CVaR (Expected Shortfall)</h3>
        <Plot
          data={[{
            x: sorted.map((f) => f.var_95 * 100),
            y: sorted.map((f) => f.cvar_95 * 100),
            text: sorted.map((f) => f.name),
            type: "scatter", mode: "markers",
            marker: { size: 6, color: "#ef4444", opacity: 0.6 },
            hovertemplate: "%{text}<br>VaR: %{x:.2f}%<br>CVaR: %{y:.2f}%<extra></extra>",
          }]}
          layout={{
            height: 400,
            margin: { t: 10, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { title: "VaR 95% (monthly, %)", gridcolor: "#334155" },
            yaxis: { title: "CVaR / Expected Shortfall (%)", gridcolor: "#334155" },
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Worst by CVaR - bar chart */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">30 Worst Factors by Expected Shortfall</h3>
        <Plot
          data={[{
            y: top30.map((f) => f.name),
            x: top30.map((f) => f.cvar_95 * 100),
            type: "bar", orientation: "h",
            marker: { color: "#ef4444" },
          }]}
          layout={{
            height: Math.max(300, top30.length * 20),
            margin: { t: 10, b: 30, l: 150, r: 20 },
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 9 },
            xaxis: { title: "CVaR (%)", gridcolor: "#334155" },
            yaxis: { autorange: "reversed" },
          }}
          config={{ displayModeBar: false }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Table with episode details */}
      <div className="flex gap-3 items-center">
        <label className="text-xs text-[#64748b]">Sort by:</label>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)}
          className="px-2 py-1 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]">
          <option value="cvar_95">Expected Shortfall</option>
          <option value="max_dd">Max Drawdown</option>
          <option value="max_dd_duration_months">DD Duration</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#334155] max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#1e293b]">
            <tr>
              <th className="px-2 py-1.5 text-left text-[#94a3b8]">Factor</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">VaR 95%</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">CVaR</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Max DD</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">DD Duration (mo)</th>
              <th className="px-2 py-1.5 text-left text-[#94a3b8]">Worst Episode</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 100).map((f) => (
              <tr key={f.name} className="border-t border-[#334155]/50 hover:bg-[#1e293b] cursor-pointer"
                  onClick={() => setSelectedFactor(selectedFactor === f.name ? null : f.name)}>
                <td className="px-2 py-1"><FactorName name={f.name} /></td>
                <td className="px-2 py-1 text-right text-[#ef4444]">{(f.var_95 * 100).toFixed(2)}%</td>
                <td className="px-2 py-1 text-right text-[#ef4444]">{(f.cvar_95 * 100).toFixed(2)}%</td>
                <td className="px-2 py-1 text-right">{(f.max_dd * 100).toFixed(1)}%</td>
                <td className="px-2 py-1 text-right">{f.max_dd_duration_months}</td>
                <td className="px-2 py-1 text-[#64748b]">
                  {f.worst_episodes[0] ? `${f.worst_episodes[0].start} (${(f.worst_episodes[0].depth * 100).toFixed(1)}%)` : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Episode detail for selected factor */}
      {active && selectedFactor && (
        <div className="bg-[#1e293b] rounded-lg p-4 border border-[#3b82f6]">
          <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
            Worst Drawdown Episodes: <FactorName name={selectedFactor} />
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="px-2 py-1 text-left text-[#94a3b8]">#</th>
                <th className="px-2 py-1 text-left text-[#94a3b8]">Peak</th>
                <th className="px-2 py-1 text-left text-[#94a3b8]">Trough</th>
                <th className="px-2 py-1 text-left text-[#94a3b8]">Recovery</th>
                <th className="px-2 py-1 text-right text-[#94a3b8]">Depth</th>
              </tr>
            </thead>
            <tbody>
              {active.worst_episodes.map((ep, i) => (
                <tr key={i} className="border-t border-[#334155]/50">
                  <td className="px-2 py-1">{i + 1}</td>
                  <td className="px-2 py-1">{ep.start}</td>
                  <td className="px-2 py-1">{ep.trough}</td>
                  <td className="px-2 py-1">{ep.end || "ongoing"}</td>
                  <td className="px-2 py-1 text-right text-[#ef4444]">{(ep.depth * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
