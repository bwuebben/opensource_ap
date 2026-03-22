import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { loadCumulativeReturns, loadFactorStats, dataUrl } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorSearch from "../components/FactorSearch";
import FactorName from "../components/FactorName";
import Methodology, { MathBlock, MNote } from "../components/Methodology";
import { getColor } from "../chartColors";

async function loadStyleCumulative(): Promise<Record<string, { dates: string[]; values: number[] }>> {
  const r = await fetch(dataUrl("style_cumulative.json"));
  if (!r.ok) return {};
  return r.json();
}

const DEFAULT_FACTORS = ["Mom12m", "BM", "Size", "GP", "AssetGrowth"];

export default function CumulativeReturns() {
  const { data: cumReturns, loading: l1 } = useData(
    useCallback(() => loadCumulativeReturns(), [])
  );
  const { data: stats, loading: l2 } = useData(
    useCallback(() => loadFactorStats(), [])
  );
  const { data: styles, loading: l3 } = useData(
    useCallback(() => loadStyleCumulative(), [])
  );
  const [selected, setSelected] = useState<string[]>(DEFAULT_FACTORS);
  const [logScale, setLogScale] = useState(false);

  const allData = useMemo(() => {
    const merged: Record<string, { dates: string[]; values: number[] }> = {};
    if (cumReturns) Object.assign(merged, cumReturns);
    if (styles) {
      for (const [name, data] of Object.entries(styles)) {
        merged[`Style: ${name}`] = data;
      }
    }
    return merged;
  }, [cumReturns, styles]);

  const styleNames = useMemo(() => styles ? Object.keys(styles).sort().map(s => `Style: ${s}`) : [], [styles]);
  const individualFactors = useMemo(() => cumReturns ? Object.keys(cumReturns).sort() : [], [cumReturns]);

  if (l1 || l2 || l3) return <LoadingSpinner />;
  if (!cumReturns || !stats) return <div className="text-red-400">No data</div>;

  const allFactors = [...styleNames, ...individualFactors];

  // Initialize with defaults that exist
  const validSelected = selected.filter((f) => allData[f]);

  function handleToggle(factor: string) {
    setSelected((prev) =>
      prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor]
    );
  }

  const traces = validSelected.map((f, i) => ({
    x: allData[f].dates,
    y: allData[f].values,
    type: "scatter" as const,
    mode: "lines" as const,
    name: f,
    line: { color: getColor(i), width: 1.5 },
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#94a3b8]">
        Growth-of-$1 chart for one or more factors overlaid on the same axes. Use the range slider to zoom into specific periods. Toggle log scale to better compare factors with different magnitudes. Useful for visualizing long-run compounding and identifying regime changes.
      </p>

      <div className="flex gap-4 items-start">
        <div className="flex-1">
          <FactorSearch
            factors={allFactors}
            selected={validSelected}
            onToggle={handleToggle}
            placeholder="Add factors to compare..."
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#94a3b8] mt-2">
          <input
            type="checkbox"
            checked={logScale}
            onChange={(e) => setLogScale(e.target.checked)}
            className="accent-[#3b82f6]"
          />
          Log scale
        </label>
      </div>

      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <Plot
          data={traces}
          layout={{
            height: 550,
            margin: { t: 30, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: {
              gridcolor: "#334155",
              type: "date",
              rangeslider: { visible: true },
            },
            yaxis: {
              title: "Cumulative Return ($1 invested)",
              gridcolor: "#334155",
              type: logScale ? "log" : "linear",
            },
            legend: {
              orientation: "h",
              y: -0.25,
              font: { size: 10 },
            },
            hovermode: "x unified",
          }}
          config={{ responsive: true, displayModeBar: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Stats table for selected factors */}
      {validSelected.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#334155]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1e293b]">
                <th className="px-3 py-2 text-left text-xs text-[#94a3b8]">Factor</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Sharpe</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Ann. Ret</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Ann. Vol</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Max DD</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">t-Stat</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Total Ret</th>
              </tr>
            </thead>
            <tbody>
              {validSelected.map((f, i) => {
                const s = stats[f];
                if (!s) return null;
                return (
                  <tr key={f} className="border-t border-[#334155]">
                    <td className="px-3 py-2">
                      <FactorName name={f} style={{ color: getColor(i) }} />
                    </td>
                    <td className="px-3 py-2 text-right">{s.sharpe_ratio.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right">{(s.ann_return * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right">{(s.ann_volatility * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right text-[#ef4444]">
                      {(s.max_drawdown * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right">{s.t_stat.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      {(s.total_return * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Methodology>
        <MNote title="Cumulative Return">Growth of $1 invested at inception:</MNote>
        <MathBlock>{"$$V_t = \\prod_{i=1}^{t} (1 + r_i)$$"}</MathBlock>
        <MNote title="Log Scale">When enabled, the y-axis displays {"$\\log_{10}(V_t)$"}, making constant growth rates appear as straight lines and allowing comparison of factors with vastly different magnitudes.</MNote>
        <MNote title="Data">Monthly long-short returns (decimal). Each factor's series starts at its first available month — no backfilling. Factors with shorter histories simply start later on the chart. Range slider filters the visible x-axis without recomputing cumulative returns from the filtered start date (the full cumulative path is always shown).</MNote>
      </Methodology>
    </div>
  );
}
