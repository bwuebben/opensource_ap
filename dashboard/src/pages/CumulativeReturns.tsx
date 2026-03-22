import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { loadCumulativeReturns, loadFactorStats } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorSearch from "../components/FactorSearch";
import FactorName from "../components/FactorName";
import { getColor } from "../chartColors";

const DEFAULT_FACTORS = ["Mom12m", "BM", "Size", "GP", "AssetGrowth"];

export default function CumulativeReturns() {
  const { data: cumReturns, loading: l1 } = useData(
    useCallback(() => loadCumulativeReturns(), [])
  );
  const { data: stats, loading: l2 } = useData(
    useCallback(() => loadFactorStats(), [])
  );
  const [selected, setSelected] = useState<string[]>(DEFAULT_FACTORS);
  const [logScale, setLogScale] = useState(false);

  if (l1 || l2) return <LoadingSpinner />;
  if (!cumReturns || !stats) return <div className="text-red-400">No data</div>;

  const allFactors = Object.keys(cumReturns).sort();

  // Initialize with defaults that exist
  const validSelected = selected.filter((f) => cumReturns[f]);

  function handleToggle(factor: string) {
    setSelected((prev) =>
      prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor]
    );
  }

  const traces = validSelected.map((f, i) => ({
    x: cumReturns[f].dates,
    y: cumReturns[f].values,
    type: "scatter" as const,
    mode: "lines" as const,
    name: f,
    line: { color: getColor(i), width: 1.5 },
  }));

  return (
    <div className="space-y-4">
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
    </div>
  );
}
