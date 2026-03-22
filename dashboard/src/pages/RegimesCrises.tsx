import { useState, useCallback } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";

interface CrisisData {
  crises: { name: string; start: string; end: string }[];
  factor_returns: Record<string, Record<string, { total_return: number; ann_vol: number }>>;
}

async function loadCrisis(): Promise<CrisisData> {
  const r = await fetch("/data/crisis_performance.json");
  if (!r.ok) throw new Error("No crisis data");
  return r.json();
}

export default function RegimesCrises() {
  const { data, loading } = useData(useCallback(() => loadCrisis(), []));
  const [selectedCrisis, setSelectedCrisis] = useState(0);
  const [sortBy, setSortBy] = useState<"return" | "name">("return");

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-red-400">No crisis data. Run compute_research.py.</div>;

  const crisis = data.crises[selectedCrisis];
  const factorReturns = data.factor_returns[crisis.name] || {};
  const factors = Object.entries(factorReturns)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => sortBy === "return" ? b.total_return - a.total_return : a.name.localeCompare(b.name));

  const top10 = factors.slice(0, 10);
  const bottom10 = factors.slice(-10).reverse();

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        How did each factor perform during major market crises?
      </p>

      <div className="flex flex-wrap gap-2">
        {data.crises.map((c, i) => (
          <button key={c.name} onClick={() => setSelectedCrisis(i)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${i === selectedCrisis ? "bg-[#3b82f6] text-white border-transparent" : "border-[#334155] text-[#94a3b8] hover:text-white"}`}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="text-xs text-[#64748b]">{crisis.start} to {crisis.end}</div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
          <h3 className="text-sm font-semibold text-[#10b981] mb-2">Top 10 Performers</h3>
          <Plot
            data={[{
              y: top10.map((f) => f.name), x: top10.map((f) => f.total_return * 100),
              type: "bar", orientation: "h",
              marker: { color: "#10b981" },
              hovertemplate: "%{y}: %{x:.2f}%<extra></extra>",
            }]}
            layout={{
              height: 300, margin: { t: 10, b: 30, l: 140, r: 20 },
              paper_bgcolor: "transparent", plot_bgcolor: "transparent",
              font: { color: "#94a3b8", size: 10 },
              xaxis: { title: "Total Return (%)", gridcolor: "#334155" },
              yaxis: { autorange: "reversed" },
            }}
            config={{ displayModeBar: false }}
            style={{ width: "100%" }}
          />
        </div>
        <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
          <h3 className="text-sm font-semibold text-[#ef4444] mb-2">Bottom 10 Performers</h3>
          <Plot
            data={[{
              y: bottom10.map((f) => f.name), x: bottom10.map((f) => f.total_return * 100),
              type: "bar", orientation: "h",
              marker: { color: "#ef4444" },
              hovertemplate: "%{y}: %{x:.2f}%<extra></extra>",
            }]}
            layout={{
              height: 300, margin: { t: 10, b: 30, l: 140, r: 20 },
              paper_bgcolor: "transparent", plot_bgcolor: "transparent",
              font: { color: "#94a3b8", size: 10 },
              xaxis: { title: "Total Return (%)", gridcolor: "#334155" },
              yaxis: { autorange: "reversed" },
            }}
            config={{ displayModeBar: false }}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      {/* Full heatmap across crises for top factors */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Factor Returns Across All Crises (%)</h3>
        {(() => {
          const topFactors = [...new Set(data.crises.flatMap((c) => {
            const rets = data.factor_returns[c.name] || {};
            return Object.entries(rets).sort(([,a],[,b]) => Math.abs(b.total_return) - Math.abs(a.total_return)).slice(0, 15).map(([n]) => n);
          }))].slice(0, 30);
          const z = topFactors.map((f) => data.crises.map((c) => {
            const v = data.factor_returns[c.name]?.[f]?.total_return;
            return v != null ? Math.round(v * 10000) / 100 : null;
          }));
          return (
            <Plot
              data={[{
                z, x: data.crises.map((c) => c.name), y: topFactors,
                type: "heatmap",
                colorscale: [[0, "#ef4444"], [0.5, "#1e293b"], [1, "#10b981"]],
                zmid: 0,
                hovertemplate: "%{y} during %{x}: %{z:.1f}%<extra></extra>",
                colorbar: { title: "Return (%)", titlefont: { color: "#94a3b8" }, tickfont: { color: "#94a3b8" } },
              }]}
              layout={{
                height: Math.max(400, topFactors.length * 18),
                margin: { t: 10, b: 100, l: 140, r: 60 },
                paper_bgcolor: "transparent", plot_bgcolor: "transparent",
                font: { color: "#94a3b8", size: 9 },
                xaxis: { tickangle: -45 },
              }}
              config={{ responsive: true }}
              style={{ width: "100%" }}
            />
          );
        })()}
      </div>
    </div>
  );
}
