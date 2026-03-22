import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";

interface DecadeData {
  decades: string[];
  factors: Record<string, { decades: Record<string, number | null> }>;
}

async function loadDecades(): Promise<DecadeData> {
  const r = await fetch("/data/decade_performance.json");
  if (!r.ok) throw new Error("No decade data");
  return r.json();
}

export default function DecadePerformance() {
  const { data, loading } = useData(useCallback(() => loadDecades(), []));
  const [sortDecade, setSortDecade] = useState<string | null>(null);
  const [minDecades, setMinDecades] = useState(3);

  const filtered = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.factors)
      .map(([name, v]) => {
        const vals = data.decades.map((d) => v.decades[d] ?? null);
        const nonNull = vals.filter((x) => x != null).length;
        return { name, vals, nonNull };
      })
      .filter((f) => f.nonNull >= minDecades)
      .sort((a, b) => {
        if (!sortDecade) {
          const avgA = a.vals.filter((v) => v != null).reduce((s, v) => s + v!, 0) / a.nonNull;
          const avgB = b.vals.filter((v) => v != null).reduce((s, v) => s + v!, 0) / b.nonNull;
          return avgB - avgA;
        }
        const idx = data!.decades.indexOf(sortDecade);
        return (b.vals[idx] ?? -999) - (a.vals[idx] ?? -999);
      });
  }, [data, sortDecade, minDecades]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-red-400">No decade data. Run the analytics pipeline.</div>;

  const top50 = filtered.slice(0, 50);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        Sharpe ratio for each factor by decade. Shows which factors are persistent across eras
        vs which had one great period.
      </p>

      <div className="flex gap-3 items-center">
        <label className="text-xs text-[#64748b]">Min decades of data:</label>
        <input type="number" value={minDecades} min={1} max={10}
          onChange={(e) => setMinDecades(Number(e.target.value))}
          className="w-16 px-2 py-1 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]" />
        <label className="text-xs text-[#64748b]">Sort by:</label>
        <select value={sortDecade || ""} onChange={(e) => setSortDecade(e.target.value || null)}
          className="px-2 py-1 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]">
          <option value="">Average Sharpe</option>
          {data.decades.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="text-xs text-[#64748b]">{filtered.length} factors</span>
      </div>

      {/* Heatmap */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          Factor Sharpe Ratios by Decade (top 50)
        </h3>
        <Plot
          data={[{
            z: top50.map((f) => f.vals.map((v) => v != null ? Math.round(v * 100) / 100 : null)),
            x: data.decades,
            y: top50.map((f) => f.name),
            type: "heatmap",
            colorscale: [[0, "#ef4444"], [0.5, "#1e293b"], [1, "#10b981"]],
            zmid: 0,
            colorbar: { title: "Sharpe", titlefont: { color: "#94a3b8" }, tickfont: { color: "#94a3b8" } },
            hovertemplate: "%{y} %{x}: %{z:.2f}<extra></extra>",
          }]}
          layout={{
            height: Math.max(400, top50.length * 18),
            margin: { t: 10, b: 40, l: 160, r: 60 },
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 9 },
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[#334155] max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#1e293b]">
            <tr>
              <th className="px-2 py-1.5 text-left text-[#94a3b8] sticky left-0 bg-[#1e293b]">Factor</th>
              {data.decades.map((d) => (
                <th key={d} className="px-2 py-1.5 text-right text-[#94a3b8] cursor-pointer hover:text-white"
                    onClick={() => setSortDecade(sortDecade === d ? null : d)}>
                  {d}{sortDecade === d ? " \u25BC" : ""}
                </th>
              ))}
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Avg</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((f) => {
              const nonNull = f.vals.filter((v) => v != null) as number[];
              const avg = nonNull.length > 0 ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length : 0;
              return (
                <tr key={f.name} className="border-t border-[#334155]/50">
                  <td className="px-2 py-1 sticky left-0 bg-[#0f172a]"><FactorName name={f.name} /></td>
                  {f.vals.map((v, i) => (
                    <td key={i} className="px-2 py-1 text-right font-mono"
                        style={{ color: v == null ? "#334155" : v > 0.3 ? "#10b981" : v > 0 ? "#94a3b8" : "#ef4444" }}>
                      {v != null ? v.toFixed(2) : "-"}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-mono font-bold"
                      style={{ color: avg > 0.3 ? "#10b981" : avg > 0 ? "#f1f5f9" : "#ef4444" }}>
                    {avg.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
