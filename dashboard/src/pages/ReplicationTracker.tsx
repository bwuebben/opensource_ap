import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { dataUrl } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";
import Methodology, { MNote } from "../components/Methodology";

interface RepData {
  factors: {
    acronym: string; original_tstat: number | null; original_return: number | null;
    replicated_tstat: number; replicated_sharpe: number; replicated_ann_return: number;
    quality: string | null; predictability: string | null;
    journal: string | null; year: number | null; tstat_ratio: number | null;
  }[];
  summary: { n_total: number; n_significant_original: number; n_significant_replicated: number; replication_rate: number };
}

async function loadRep(): Promise<RepData> {
  const r = await fetch(dataUrl("replication_tracker.json"));
  if (!r.ok) throw new Error("No replication data");
  return r.json();
}

export default function ReplicationTracker() {
  const { data, loading } = useData(useCallback(() => loadRep(), []));
  const [sortKey, setSortKey] = useState<"tstat_ratio" | "replicated_tstat" | "original_tstat">("replicated_tstat");
  const [qualityFilter, setQualityFilter] = useState("all");

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.factors.filter((f) => f.original_tstat != null);
    if (qualityFilter !== "all") list = list.filter((f) => f.quality === qualityFilter);
    return list.sort((a, b) => {
      const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
      return sortKey === "tstat_ratio" ? vb - va : Math.abs(vb) - Math.abs(va);
    });
  }, [data, sortKey, qualityFilter]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-red-400">No replication data.</div>;

  const s = data.summary;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        How well do the original paper results hold up when replicated with standardized methodology? Compares reported t-statistics from the original publications with the OpenAP replication. An 80.5% replication rate means most anomalies are real, but ~20% do not reproduce — important for deciding which factors to trust for live trading.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Factors with Original Stats" value={s.n_total.toString()} />
        <StatCard label="Originally Significant" value={s.n_significant_original.toString()} />
        <StatCard label="Replication Significant" value={s.n_significant_replicated.toString()} />
        <StatCard label="Replication Rate" value={`${(s.replication_rate * 100).toFixed(0)}%`}
          color={s.replication_rate > 0.6 ? "#10b981" : s.replication_rate > 0.4 ? "#f59e0b" : "#ef4444"} />
      </div>

      {/* Scatter: original vs replicated t-stat */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Original vs Replicated t-Statistic</h3>
        <Plot
          data={[
            {
              x: filtered.map((f) => f.original_tstat),
              y: filtered.map((f) => f.replicated_tstat),
              text: filtered.map((f) => `${f.acronym} (${f.year})`),
              type: "scatter", mode: "markers",
              marker: { size: 6, color: "#3b82f6", opacity: 0.6 },
              hovertemplate: "%{text}<br>Original t: %{x:.2f}<br>Replicated t: %{y:.2f}<extra></extra>",
            },
            {
              x: [-5, 15], y: [-5, 15],
              type: "scatter", mode: "lines",
              line: { color: "#475569", dash: "dash", width: 1 },
              showlegend: false,
            },
            {
              x: [-5, 15], y: [1.96, 1.96],
              type: "scatter", mode: "lines",
              line: { color: "#f59e0b", dash: "dot", width: 1 },
              name: "t=1.96",
            },
          ]}
          layout={{
            height: 450,
            margin: { t: 10, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { title: "Original Paper t-Stat", gridcolor: "#334155", zerolinecolor: "#475569" },
            yaxis: { title: "Replicated t-Stat", gridcolor: "#334155", zerolinecolor: "#475569" },
            legend: { font: { size: 9 } },
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* t-stat ratio distribution */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">t-Stat Ratio Distribution (Replicated / Original)</h3>
        <Plot
          data={[{
            x: filtered.filter((f) => f.tstat_ratio != null).map((f) => f.tstat_ratio),
            type: "histogram", marker: { color: "#8b5cf6" }, nbinsx: 40,
          }]}
          layout={{
            height: 250,
            margin: { t: 10, b: 40, l: 50, r: 20 },
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { title: "Replicated t / Original t", gridcolor: "#334155" },
            yaxis: { title: "Count", gridcolor: "#334155" },
            shapes: [{ type: "line", x0: 1, x1: 1, y0: 0, y1: 1, yref: "paper", line: { color: "#f59e0b", dash: "dash" } }],
          }}
          config={{ displayModeBar: false }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-3 items-center">
        <label className="text-xs text-[#64748b]">Quality:</label>
        <select value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)}
          className="px-2 py-1 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]">
          <option value="all">All</option>
          <option value="1_good">Good</option>
          <option value="2_fair">Fair</option>
          <option value="3_poor">Poor</option>
        </select>
        <label className="text-xs text-[#64748b]">Sort:</label>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)}
          className="px-2 py-1 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]">
          <option value="replicated_tstat">Replicated t-stat</option>
          <option value="original_tstat">Original t-stat</option>
          <option value="tstat_ratio">t-stat ratio</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[#334155] max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#1e293b]">
            <tr>
              <th className="px-2 py-1.5 text-left text-[#94a3b8]">Factor</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Year</th>
              <th className="px-2 py-1.5 text-left text-[#94a3b8]">Journal</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Orig t</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Rep t</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Ratio</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Rep Sharpe</th>
              <th className="px-2 py-1.5 text-left text-[#94a3b8]">Quality</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.acronym} className="border-t border-[#334155]/50 hover:bg-[#1e293b]">
                <td className="px-2 py-1"><FactorName name={f.acronym} /></td>
                <td className="px-2 py-1 text-right text-[#94a3b8]">{f.year ?? ""}</td>
                <td className="px-2 py-1 text-[#64748b]">{f.journal ?? ""}</td>
                <td className="px-2 py-1 text-right font-mono">{f.original_tstat?.toFixed(2) ?? ""}</td>
                <td className="px-2 py-1 text-right font-mono"
                    style={{ color: Math.abs(f.replicated_tstat) > 1.96 ? "#10b981" : "#ef4444" }}>
                  {f.replicated_tstat.toFixed(2)}
                </td>
                <td className="px-2 py-1 text-right font-mono"
                    style={{ color: (f.tstat_ratio ?? 0) > 0.8 ? "#10b981" : (f.tstat_ratio ?? 0) > 0.5 ? "#f59e0b" : "#ef4444" }}>
                  {f.tstat_ratio?.toFixed(2) ?? ""}
                </td>
                <td className="px-2 py-1 text-right font-mono">{f.replicated_sharpe.toFixed(3)}</td>
                <td className="px-2 py-1 text-[#64748b]">{f.quality ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Methodology>
        <MNote title="Replication">Compares the original paper's reported t-statistic with the t-statistic from the OpenAP replication using standardized methodology (Chen & Zimmermann 2022).</MNote>
        <MNote title="Replication Criterion">A factor is considered "replicated" if the OpenAP t-statistic has the same sign as the original and is statistically significant ({"$|t| \\geq 1.96$"}).</MNote>
        <MNote title="Differences">Discrepancies can arise from: different sample periods, different portfolio construction (decile vs quintile, value-weighted vs equal-weighted), updated data vintages, or methodological standardization.</MNote>
        <MNote title="Data">Original t-statistics from the signal documentation. Replicated t-statistics computed from the full available sample of OpenAP long-short returns.</MNote>
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
