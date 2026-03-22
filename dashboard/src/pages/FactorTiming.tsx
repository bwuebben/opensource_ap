import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import LoadingSpinner from "../components/LoadingSpinner";
import Methodology, { MathBlock, MNote } from "../components/Methodology";

interface TimingData {
  macro_vars: string[];
  by_style: Record<string, Record<string, { low: number; mid: number; high: number }>>;
  by_factor: Record<string, Record<string, { low: number; mid: number; high: number }>>;
}

async function loadTiming(): Promise<TimingData> {
  const r = await fetch("/data/factor_timing.json");
  if (!r.ok) throw new Error("No timing data");
  return r.json();
}

export default function FactorTiming() {
  const { data, loading } = useData(useCallback(() => loadTiming(), []));
  const [macroVar, setMacroVar] = useState("");
  const [view, setView] = useState<"style" | "factor">("style");

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-red-400">No factor timing data. Run the analytics pipeline.</div>;

  const activeMacro = macroVar || data.macro_vars[0] || "";
  const styleData = data.by_style[activeMacro] || {};
  const factorData = data.by_factor[activeMacro] || {};

  const activeData = view === "style" ? styleData : factorData;
  const names = Object.keys(activeData).sort((a, b) => {
    const diff_a = (activeData[a]?.high ?? 0) - (activeData[a]?.low ?? 0);
    const diff_b = (activeData[b]?.high ?? 0) - (activeData[b]?.low ?? 0);
    return Math.abs(diff_b) - Math.abs(diff_a);
  });

  const displayNames = names.slice(0, view === "style" ? 20 : 30);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        Can macro conditions predict which factors will do well? Shows factor Sharpe ratios conditional on whether a macro variable (e.g., industrial production, credit spreads) is in its low, middle, or high tercile. If a factor's Sharpe varies substantially across regimes, it suggests timing opportunities — or at least that the factor's returns are macro-dependent.
      </p>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-xs text-[#64748b]">Macro variable:</label>
        <select value={activeMacro} onChange={(e) => setMacroVar(e.target.value)}
          className="px-2 py-1.5 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]">
          {data.macro_vars.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="flex rounded-lg border border-[#334155] overflow-hidden">
          <button onClick={() => setView("style")}
            className={`px-3 py-1.5 text-xs ${view === "style" ? "bg-[#3b82f6] text-white" : "bg-[#1e293b] text-[#94a3b8]"}`}>
            By Style
          </button>
          <button onClick={() => setView("factor")}
            className={`px-3 py-1.5 text-xs ${view === "factor" ? "bg-[#3b82f6] text-white" : "bg-[#1e293b] text-[#94a3b8]"}`}>
            By Factor
          </button>
        </div>
      </div>

      {/* Grouped bar chart */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          Conditional Sharpe Ratio by {activeMacro} Regime
        </h3>
        <Plot
          data={[
            {
              y: displayNames, x: displayNames.map((n) => activeData[n]?.low ?? 0),
              type: "bar", orientation: "h", name: `Low ${activeMacro}`,
              marker: { color: "#3b82f6" },
            },
            {
              y: displayNames, x: displayNames.map((n) => activeData[n]?.mid ?? 0),
              type: "bar", orientation: "h", name: `Mid ${activeMacro}`,
              marker: { color: "#f59e0b" },
            },
            {
              y: displayNames, x: displayNames.map((n) => activeData[n]?.high ?? 0),
              type: "bar", orientation: "h", name: `High ${activeMacro}`,
              marker: { color: "#ef4444" },
            },
          ]}
          layout={{
            height: Math.max(400, displayNames.length * 25),
            margin: { t: 10, b: 40, l: view === "style" ? 180 : 140, r: 20 },
            barmode: "group",
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 10 },
            xaxis: { title: "Sharpe Ratio", gridcolor: "#334155", zerolinecolor: "#475569" },
            yaxis: { autorange: "reversed" },
            legend: { orientation: "h", y: -0.1, font: { size: 10 } },
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[#334155]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#1e293b]">
              <th className="px-3 py-2 text-left text-[#94a3b8]">{view === "style" ? "Style" : "Factor"}</th>
              <th className="px-3 py-2 text-right text-[#3b82f6]">Low {activeMacro}</th>
              <th className="px-3 py-2 text-right text-[#f59e0b]">Mid {activeMacro}</th>
              <th className="px-3 py-2 text-right text-[#ef4444]">High {activeMacro}</th>
              <th className="px-3 py-2 text-right text-[#94a3b8]">High-Low</th>
            </tr>
          </thead>
          <tbody>
            {names.map((n) => {
              const d = activeData[n];
              if (!d) return null;
              const diff = (d.high ?? 0) - (d.low ?? 0);
              return (
                <tr key={n} className="border-t border-[#334155]/50">
                  <td className="px-3 py-1.5 font-medium text-[#f1f5f9]">{n}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{d.low?.toFixed(3) ?? "N/A"}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{d.mid?.toFixed(3) ?? "N/A"}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{d.high?.toFixed(3) ?? "N/A"}</td>
                  <td className="px-3 py-1.5 text-right font-mono"
                      style={{ color: diff > 0.1 ? "#10b981" : diff < -0.1 ? "#ef4444" : "#94a3b8" }}>
                    {diff.toFixed(3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Methodology>
        <MNote title="Tercile Conditioning">For each macro variable, sort all months into low, middle, and high terciles based on the contemporaneous macro value. Compute the factor Sharpe ratio separately within each tercile:</MNote>
        <MathBlock>{"$$\\text{Sharpe}_{\\text{low}} = \\frac{\\bar{r}_{t \\in Q_1}}{\\sigma_{r, t \\in Q_1}} \\times \\sqrt{12}$$"}</MathBlock>
        <MNote title="Interpretation">Large variation in Sharpe across terciles suggests the factor is macro-dependent. If {"$\\text{Sharpe}_{\\text{high}} \\gg \\text{Sharpe}_{\\text{low}}$"}, the factor works best when the macro variable is elevated. This is contemporaneous conditioning (not predictive) — it shows association, not causation.</MNote>
        <MNote title="Data">Macro variables are McCracken-Ng transformed. Tercile breakpoints are computed over the full sample. Factor returns are monthly long-short (decimal). Only months with both factor and macro data are used.</MNote>
      </Methodology>
    </div>
  );
}
