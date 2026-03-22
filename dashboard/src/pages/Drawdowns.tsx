import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { loadDrawdowns, loadFactorStats } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorSearch from "../components/FactorSearch";
import FactorName from "../components/FactorName";
import Methodology, { MathBlock, MNote } from "../components/Methodology";
import { getColor } from "../chartColors";

async function loadStyleDrawdowns(): Promise<Record<string, { dates: string[]; values: number[] }>> {
  const r = await fetch("/data/style_drawdowns.json");
  if (!r.ok) return {};
  return r.json();
}

const DEFAULT_FACTORS = ["Mom12m", "BM", "Size"];

export default function Drawdowns() {
  const { data: drawdowns, loading: l1 } = useData(
    useCallback(() => loadDrawdowns(), [])
  );
  const { data: stats, loading: l2 } = useData(
    useCallback(() => loadFactorStats(), [])
  );
  const { data: styles, loading: l3 } = useData(
    useCallback(() => loadStyleDrawdowns(), [])
  );
  const [selected, setSelected] = useState<string[]>(DEFAULT_FACTORS);

  const allData = useMemo(() => {
    const merged: Record<string, { dates: string[]; values: number[] }> = {};
    if (drawdowns) Object.assign(merged, drawdowns);
    if (styles) {
      for (const [name, data] of Object.entries(styles)) {
        merged[`Style: ${name}`] = data;
      }
    }
    return merged;
  }, [drawdowns, styles]);

  const styleNames = useMemo(() => styles ? Object.keys(styles).sort().map(s => `Style: ${s}`) : [], [styles]);
  const individualFactors = useMemo(() => drawdowns ? Object.keys(drawdowns).sort() : [], [drawdowns]);

  if (l1 || l2 || l3) return <LoadingSpinner />;
  if (!drawdowns || !stats) return <div className="text-red-400">No data</div>;

  const allFactors = [...styleNames, ...individualFactors];
  const validSelected = selected.filter((f) => allData[f]);

  function handleToggle(factor: string) {
    setSelected((prev) =>
      prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor]
    );
  }

  const traces = validSelected.map((f, i) => ({
    x: allData[f].dates,
    y: allData[f].values.map((v) => v * 100),
    type: "scatter" as const,
    mode: "lines" as const,
    name: f,
    fill: "tozeroy" as const,
    line: { color: getColor(i), width: 1 },
    fillcolor: getColor(i) + "20",
  }));

  // Worst drawdowns table
  const worstDD = validSelected
    .map((f) => ({
      name: f,
      maxDD: stats[f]?.max_drawdown ?? 0,
      ann_ret: stats[f]?.ann_return ?? 0,
      sharpe: stats[f]?.sharpe_ratio ?? 0,
    }))
    .sort((a, b) => a.maxDD - b.maxDD);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#94a3b8]">
        Peak-to-trough drawdown chart for each factor — shows how far a factor fell from its high-water mark at every point in time. The table below ranks factors by return-to-drawdown ratio, helping identify which factors offer the best compensation for their worst losses.
      </p>

      <FactorSearch
        factors={allFactors}
        selected={validSelected}
        onToggle={handleToggle}
        placeholder="Add factors to view drawdowns..."
        maxSelect={8}
      />

      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Drawdown Chart</h3>
        <Plot
          data={traces}
          layout={{
            height: 450,
            margin: { t: 10, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { gridcolor: "#334155", type: "date" },
            yaxis: {
              title: "Drawdown (%)",
              gridcolor: "#334155",
              rangemode: "nonpositive",
            },
            legend: { orientation: "h", y: -0.2, font: { size: 10 } },
            hovermode: "x unified",
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {worstDD.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#334155]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1e293b]">
                <th className="px-3 py-2 text-left text-xs text-[#94a3b8]">Factor</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Max Drawdown</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Ann. Return</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Sharpe</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Return/DD</th>
              </tr>
            </thead>
            <tbody>
              {worstDD.map((f) => (
                <tr key={f.name} className="border-t border-[#334155]">
                  <td className="px-3 py-2"><FactorName name={f.name} /></td>
                  <td className="px-3 py-2 text-right text-[#ef4444]">
                    {(f.maxDD * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right">
                    {(f.ann_ret * 100).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-right">{f.sharpe.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right">
                    {f.maxDD !== 0 ? Math.abs(f.ann_ret / f.maxDD).toFixed(2) : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Methodology>
        <MNote title="Drawdown">Peak-to-trough decline at each point in time:</MNote>
        <MathBlock>{"$$DD_t = \\frac{V_t - \\max_{s \\leq t} V_s}{\\max_{s \\leq t} V_s}$$"}</MathBlock>
        <MNote title="Return/DD Ratio">Ratio of annualized return to the absolute value of the maximum drawdown: {"$\\text{Ratio} = r_{ann} / |\\text{MDD}|$"}. Higher values indicate better compensation per unit of worst-case loss. This is analogous to the Calmar ratio.</MNote>
        <MNote title="Data">Drawdowns are computed from the full cumulative return series. Maximum drawdown duration is measured in months from peak to recovery (or to end of sample if unrecovered).</MNote>
      </Methodology>
    </div>
  );
}
