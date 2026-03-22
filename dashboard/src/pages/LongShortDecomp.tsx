import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";
import Methodology, { MathBlock, MNote } from "../components/Methodology";

interface DecompData {
  factors: Record<string, {
    long_ann_ret: number; long_sharpe: number;
    short_ann_ret: number; short_sharpe: number;
    ls_ann_ret: number; ls_sharpe: number;
    long_pct_of_ls: number | null;
  }>;
}

async function loadDecomp(): Promise<DecompData> {
  const r = await fetch("/data/long_short_decomp.json");
  if (!r.ok) throw new Error("No decomposition data");
  return r.json();
}

export default function LongShortDecomp() {
  const { data, loading } = useData(useCallback(() => loadDecomp(), []));
  const [sortKey, setSortKey] = useState<"long_pct" | "long_sharpe" | "short_sharpe" | "ls_sharpe">("ls_sharpe");

  const sorted = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.factors)
      .map(([name, v]) => ({ name, ...v }))
      .filter((f) => f.ls_sharpe != null)
      .sort((a, b) => {
        if (sortKey === "long_pct") return (b.long_pct_of_ls ?? 0) - (a.long_pct_of_ls ?? 0);
        if (sortKey === "long_sharpe") return b.long_sharpe - a.long_sharpe;
        if (sortKey === "short_sharpe") return a.short_sharpe - b.short_sharpe;
        return b.ls_sharpe - a.ls_sharpe;
      });
  }, [data, sortKey]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-red-400">No decomposition data.</div>;

  // Categorize: long-driven, short-driven, balanced
  const longDriven = sorted.filter((f) => (f.long_pct_of_ls ?? 0) > 0.65).length;
  const shortDriven = sorted.filter((f) => (f.long_pct_of_ls ?? 0) < 0.35).length;
  const balanced = sorted.length - longDriven - shortDriven;

  const top40 = sorted.slice(0, 40);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        Decomposes each factor's long-short return into its long leg (top decile, D10) and short leg (bottom decile, D1). Factors driven primarily by the short leg may be harder to capture in practice due to shorting costs and constraints. Factors driven by the long leg are more implementable for long-only investors.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Long-Driven (>65%)" value={longDriven.toString()} color="#10b981" />
        <StatCard label="Balanced" value={balanced.toString()} color="#3b82f6" />
        <StatCard label="Short-Driven (<35%)" value={shortDriven.toString()} color="#ef4444" />
      </div>

      {/* Scatter: long Sharpe vs short Sharpe */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Long Leg Sharpe vs Short Leg Sharpe</h3>
        <Plot
          data={[
            {
              x: sorted.map((f) => f.long_sharpe),
              y: sorted.map((f) => f.short_sharpe),
              text: sorted.map((f) => f.name),
              type: "scatter", mode: "markers",
              marker: {
                size: 7, opacity: 0.7,
                color: sorted.map((f) => (f.long_pct_of_ls ?? 0.5) > 0.65 ? "#10b981" : (f.long_pct_of_ls ?? 0.5) < 0.35 ? "#ef4444" : "#3b82f6"),
              },
              hovertemplate: "%{text}<br>Long SR: %{x:.3f}<br>Short SR: %{y:.3f}<extra></extra>",
            },
          ]}
          layout={{
            height: 450,
            margin: { t: 10, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { title: "Long Leg (D10) Sharpe", gridcolor: "#334155", zerolinecolor: "#475569" },
            yaxis: { title: "Short Leg (D1) Sharpe", gridcolor: "#334155", zerolinecolor: "#475569" },
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Stacked bar: long vs short contribution */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Annualized Return: Long vs Short Leg (top 40)</h3>
        <Plot
          data={[
            {
              y: top40.map((f) => f.name),
              x: top40.map((f) => f.long_ann_ret * 100),
              type: "bar", orientation: "h", name: "Long (D10)",
              marker: { color: "#10b981" },
            },
            {
              y: top40.map((f) => f.name),
              x: top40.map((f) => -f.short_ann_ret * 100),
              type: "bar", orientation: "h", name: "Short (D1, negated)",
              marker: { color: "#ef4444" },
            },
          ]}
          layout={{
            height: Math.max(400, top40.length * 20),
            margin: { t: 10, b: 40, l: 150, r: 20 },
            barmode: "group",
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 9 },
            xaxis: { title: "Ann. Return (%)", gridcolor: "#334155" },
            yaxis: { autorange: "reversed" },
            legend: { orientation: "h", y: -0.1 },
          }}
          config={{ displayModeBar: false }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Sort controls + table */}
      <div className="flex gap-3 items-center">
        <label className="text-xs text-[#64748b]">Sort by:</label>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)}
          className="px-2 py-1 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]">
          <option value="ls_sharpe">L/S Sharpe</option>
          <option value="long_sharpe">Long Sharpe</option>
          <option value="short_sharpe">Short Sharpe (worst first)</option>
          <option value="long_pct">Long % of L/S</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#334155] max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#1e293b]">
            <tr>
              <th className="px-2 py-1.5 text-left text-[#94a3b8]">Factor</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">L/S Sharpe</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Long Sharpe</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Short Sharpe</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Long Ann%</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Short Ann%</th>
              <th className="px-2 py-1.5 text-right text-[#94a3b8]">Long % of L/S</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f) => (
              <tr key={f.name} className="border-t border-[#334155]/50 hover:bg-[#1e293b]">
                <td className="px-2 py-1"><FactorName name={f.name} /></td>
                <td className="px-2 py-1 text-right font-mono">{f.ls_sharpe.toFixed(3)}</td>
                <td className="px-2 py-1 text-right font-mono text-[#10b981]">{f.long_sharpe.toFixed(3)}</td>
                <td className="px-2 py-1 text-right font-mono text-[#ef4444]">{f.short_sharpe.toFixed(3)}</td>
                <td className="px-2 py-1 text-right">{(f.long_ann_ret * 100).toFixed(2)}%</td>
                <td className="px-2 py-1 text-right">{(f.short_ann_ret * 100).toFixed(2)}%</td>
                <td className="px-2 py-1 text-right font-mono"
                    style={{ color: (f.long_pct_of_ls ?? 0) > 0.65 ? "#10b981" : (f.long_pct_of_ls ?? 0) < 0.35 ? "#ef4444" : "#3b82f6" }}>
                  {f.long_pct_of_ls != null ? `${(f.long_pct_of_ls * 100).toFixed(0)}%` : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Methodology>
        <MNote title="Decomposition">The long-short return is decomposed into its long leg (top decile, D10) and short leg (bottom decile, D1):</MNote>
        <MathBlock>{"$$r_{\\text{L/S},t} = r_{\\text{D10},t} - r_{\\text{D1},t}$$"}</MathBlock>
        <MNote title="Decile Returns">Equal-weighted returns within each decile portfolio. D10 is the decile that the factor's signal predicts will have the highest returns; D1 is the lowest.</MNote>
        <MNote title="Interpretation">If the long-short return is driven primarily by D1 (the short leg), the factor may be difficult to capture for long-only investors or in markets with short-sale constraints. Factors driven by the long leg (D10) are more implementable.</MNote>
        <MNote title="Data">Decile returns from OpenAP equal-weighted decile portfolios. Returns are monthly (decimal). Factors without decile data are excluded.</MNote>
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
