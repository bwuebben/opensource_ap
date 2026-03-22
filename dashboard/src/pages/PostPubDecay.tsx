import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";

interface DecayData {
  factors: {
    acronym: string; pub_year: number;
    pre_sharpe: number; post_sharpe: number;
    pre_mean: number; post_mean: number;
    pre_tstat: number; post_tstat: number;
    pre_months: number; post_months: number;
    decay_ratio: number | null; cat_economic: string;
  }[];
  avg_decay_by_category: Record<string, { avg_pre: number; avg_post: number; avg_decay: number; n: number }>;
  avg_decay_by_decade: Record<string, { avg_pre: number; avg_post: number; avg_decay: number; n: number }>;
}

async function loadDecay(): Promise<DecayData> {
  const r = await fetch("/data/post_pub_decay.json");
  if (!r.ok) throw new Error("No decay data");
  return r.json();
}

export default function PostPubDecay() {
  const { data, loading } = useData(useCallback(() => loadDecay(), []));
  const [minPostMonths, setMinPostMonths] = useState(60);
  const [sortKey, setSortKey] = useState<"decay_ratio" | "post_sharpe" | "pre_sharpe">("decay_ratio");

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-red-400">No post-publication decay data. Run compute_research.py.</div>;

  const filtered = data.factors
    .filter((f) => f.post_months >= minPostMonths && f.pre_months >= 60 && f.decay_ratio != null)
    .sort((a, b) => {
      const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
      return sortKey === "decay_ratio" ? va - vb : vb - va;
    });

  const avgDecay = filtered.length > 0
    ? filtered.reduce((s, f) => s + (f.decay_ratio ?? 0), 0) / filtered.length
    : 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        How much do factor returns decay after the academic paper is published?
        Compares pre-publication vs post-publication Sharpe ratios.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Factors Analyzed" value={filtered.length.toString()} />
        <StatCard label="Avg Decay Ratio" value={avgDecay.toFixed(2)} color={avgDecay < 0.5 ? "#ef4444" : avgDecay < 0.8 ? "#f59e0b" : "#10b981"} />
        <StatCard label="Median Pre-Pub Sharpe" value={median(filtered.map((f) => f.pre_sharpe)).toFixed(3)} />
        <StatCard label="Median Post-Pub Sharpe" value={median(filtered.map((f) => f.post_sharpe)).toFixed(3)} />
      </div>

      {/* Scatter: pre vs post Sharpe */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Pre-Publication vs Post-Publication Sharpe</h3>
        <Plot
          data={[
            {
              x: filtered.map((f) => f.pre_sharpe),
              y: filtered.map((f) => f.post_sharpe),
              text: filtered.map((f) => `${f.acronym} (${f.pub_year})`),
              type: "scatter",
              mode: "markers",
              marker: { size: 6, color: "#3b82f6", opacity: 0.7 },
              hovertemplate: "%{text}<br>Pre: %{x:.3f}<br>Post: %{y:.3f}<extra></extra>",
            },
            {
              x: [-1, 3], y: [-1, 3],
              type: "scatter", mode: "lines",
              line: { color: "#475569", dash: "dash", width: 1 },
              showlegend: false,
            },
          ]}
          layout={{
            height: 450,
            margin: { t: 10, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { title: "Pre-Publication Sharpe", gridcolor: "#334155", zerolinecolor: "#475569" },
            yaxis: { title: "Post-Publication Sharpe", gridcolor: "#334155", zerolinecolor: "#475569" },
            annotations: [{ x: 1.5, y: 0.2, text: "Decay zone", showarrow: false, font: { color: "#ef4444", size: 10 } }],
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Decay by category */}
      {data.avg_decay_by_category && (
        <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
          <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Average Decay by Economic Category</h3>
          <Plot
            data={[
              {
                y: Object.keys(data.avg_decay_by_category).sort((a, b) => data.avg_decay_by_category[a].avg_decay - data.avg_decay_by_category[b].avg_decay),
                x: Object.keys(data.avg_decay_by_category).sort((a, b) => data.avg_decay_by_category[a].avg_decay - data.avg_decay_by_category[b].avg_decay).map((c) => data.avg_decay_by_category[c].avg_decay),
                type: "bar", orientation: "h",
                marker: { color: Object.keys(data.avg_decay_by_category).sort((a, b) => data.avg_decay_by_category[a].avg_decay - data.avg_decay_by_category[b].avg_decay).map((c) => data.avg_decay_by_category[c].avg_decay < 0.5 ? "#ef4444" : data.avg_decay_by_category[c].avg_decay < 0.8 ? "#f59e0b" : "#10b981") },
                hovertemplate: "%{y}: %{x:.2f}<extra></extra>",
              },
            ]}
            layout={{
              height: Math.max(250, Object.keys(data.avg_decay_by_category).length * 25),
              margin: { t: 10, b: 30, l: 160, r: 20 },
              paper_bgcolor: "transparent", plot_bgcolor: "transparent",
              font: { color: "#94a3b8", size: 10 },
              xaxis: { title: "Decay Ratio (post/pre Sharpe)", gridcolor: "#334155" },
              shapes: [{ type: "line", x0: 1, x1: 1, y0: -0.5, y1: Object.keys(data.avg_decay_by_category).length - 0.5, line: { color: "#475569", dash: "dash", width: 1 } }],
            }}
            config={{ displayModeBar: false }}
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* Decay by decade */}
      {data.avg_decay_by_decade && (
        <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
          <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Average Decay by Publication Decade</h3>
          <Plot
            data={[
              {
                x: Object.keys(data.avg_decay_by_decade).sort(),
                y: Object.keys(data.avg_decay_by_decade).sort().map((d) => data.avg_decay_by_decade[d].avg_pre),
                type: "bar", name: "Pre-Pub Sharpe",
                marker: { color: "#3b82f6" },
              },
              {
                x: Object.keys(data.avg_decay_by_decade).sort(),
                y: Object.keys(data.avg_decay_by_decade).sort().map((d) => data.avg_decay_by_decade[d].avg_post),
                type: "bar", name: "Post-Pub Sharpe",
                marker: { color: "#ef4444" },
              },
            ]}
            layout={{
              height: 300, barmode: "group",
              margin: { t: 10, b: 30, l: 50, r: 20 },
              paper_bgcolor: "transparent", plot_bgcolor: "transparent",
              font: { color: "#94a3b8", size: 11 },
              yaxis: { title: "Avg Sharpe Ratio", gridcolor: "#334155" },
              legend: { orientation: "h", y: -0.15 },
            }}
            config={{ displayModeBar: false }}
            style={{ width: "100%" }}
          />
        </div>
      )}

      {/* Controls + table */}
      <div className="flex gap-3 items-center">
        <label className="text-xs text-[#64748b]">Min post-pub months:</label>
        <input type="number" value={minPostMonths} onChange={(e) => setMinPostMonths(Number(e.target.value))}
          className="w-20 px-2 py-1 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]" />
        <label className="text-xs text-[#64748b]">Sort by:</label>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)}
          className="px-2 py-1 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]">
          <option value="decay_ratio">Decay Ratio</option>
          <option value="post_sharpe">Post-Pub Sharpe</option>
          <option value="pre_sharpe">Pre-Pub Sharpe</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#334155] max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#1e293b]">
            <tr>
              <th className="px-2 py-1.5 text-left text-[#94a3b8]">Factor</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Pub Year</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Pre Sharpe</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Post Sharpe</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Decay</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Pre t</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Post t</th>
              <th className="px-2 py-1.5 text-left text-[#94a3b8]">Category</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.acronym} className="border-t border-[#334155]/50 hover:bg-[#1e293b]">
                <td className="px-2 py-1"><FactorName name={f.acronym} /></td>
                <td className="px-2 py-1 text-right text-[#94a3b8]">{f.pub_year}</td>
                <td className="px-2 py-1 text-right">{f.pre_sharpe.toFixed(3)}</td>
                <td className="px-2 py-1 text-right">{f.post_sharpe.toFixed(3)}</td>
                <td className="px-2 py-1 text-right">
                  <span className={(f.decay_ratio ?? 0) < 0.5 ? "text-[#ef4444]" : (f.decay_ratio ?? 0) < 0.8 ? "text-[#f59e0b]" : "text-[#10b981]"}>
                    {f.decay_ratio?.toFixed(2) ?? "N/A"}
                  </span>
                </td>
                <td className="px-2 py-1 text-right">{f.pre_tstat.toFixed(2)}</td>
                <td className="px-2 py-1 text-right">{f.post_tstat.toFixed(2)}</td>
                <td className="px-2 py-1 text-[#64748b]">{f.cat_economic}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
