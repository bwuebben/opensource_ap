import { useState, useCallback } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { loadAnnualReturns, loadFactorStats } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import { getColor } from "../chartColors";

export default function AnnualReturns() {
  const { data: annual, loading: l1 } = useData(
    useCallback(() => loadAnnualReturns(), [])
  );
  const { data: stats, loading: l2 } = useData(
    useCallback(() => loadFactorStats(), [])
  );
  const [factor, setFactor] = useState("Mom12m");
  const [compareMode, setCompareMode] = useState(false);
  const [compareFactor, setCompareFactor] = useState("BM");

  if (l1 || l2) return <LoadingSpinner />;
  if (!annual || !stats) return <div className="text-red-400">No data</div>;

  const allFactors = Object.keys(annual).sort();
  const activeFactor = annual[factor] ? factor : allFactors[0];
  const activeCompare = annual[compareFactor] ? compareFactor : allFactors[1] || allFactors[0];

  const data1 = annual[activeFactor];

  const traces: Plotly.Data[] = [
    {
      x: data1.years.map(String),
      y: data1.values.map((v) => v * 100),
      type: "bar",
      name: activeFactor,
      marker: {
        color: data1.values.map((v) => (v >= 0 ? "#10b981" : "#ef4444")),
      },
      hovertemplate: "%{x}: %{y:.2f}%<extra>" + activeFactor + "</extra>",
    },
  ];

  if (compareMode && activeCompare !== activeFactor && annual[activeCompare]) {
    const data2 = annual[activeCompare];
    traces.push({
      x: data2.years.map(String),
      y: data2.values.map((v) => v * 100),
      type: "bar",
      name: activeCompare,
      marker: { color: getColor(0) },
      opacity: 0.6,
      hovertemplate: "%{x}: %{y:.2f}%<extra>" + activeCompare + "</extra>",
    });
  }

  // Stats comparison
  const statRows = [
    { label: "Ann. Return", fmt: (s: typeof stats[string]) => (s.ann_return * 100).toFixed(2) + "%" },
    { label: "Ann. Vol", fmt: (s: typeof stats[string]) => (s.ann_volatility * 100).toFixed(2) + "%" },
    { label: "Sharpe", fmt: (s: typeof stats[string]) => s.sharpe_ratio.toFixed(3) },
    { label: "t-Stat", fmt: (s: typeof stats[string]) => s.t_stat.toFixed(2) },
    { label: "Best Year", fmt: (_s: typeof stats[string], f: string) => {
      const a = annual[f];
      if (!a) return "N/A";
      const maxIdx = a.values.indexOf(Math.max(...a.values));
      return `${(a.values[maxIdx] * 100).toFixed(1)}% (${a.years[maxIdx]})`;
    }},
    { label: "Worst Year", fmt: (_s: typeof stats[string], f: string) => {
      const a = annual[f];
      if (!a) return "N/A";
      const minIdx = a.values.indexOf(Math.min(...a.values));
      return `${(a.values[minIdx] * 100).toFixed(1)}% (${a.years[minIdx]})`;
    }},
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#94a3b8]">
        Calendar-year returns for any factor, displayed as bar charts. Compare two factors side-by-side to see how they performed in the same years — useful for spotting diversification opportunities or understanding when a factor had its best and worst stretches.
      </p>

      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={activeFactor}
          onChange={(e) => setFactor(e.target.value)}
          className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9] focus:outline-none focus:border-[#3b82f6]"
        >
          {allFactors.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-[#94a3b8]">
          <input
            type="checkbox"
            checked={compareMode}
            onChange={(e) => setCompareMode(e.target.checked)}
            className="accent-[#3b82f6]"
          />
          Compare with
        </label>

        {compareMode && (
          <select
            value={activeCompare}
            onChange={(e) => setCompareFactor(e.target.value)}
            className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9] focus:outline-none focus:border-[#3b82f6]"
          >
            {allFactors.filter((f) => f !== activeFactor).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <Plot
          data={traces}
          layout={{
            height: 450,
            margin: { t: 10, b: 40, l: 60, r: 20 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { gridcolor: "#334155" },
            yaxis: { title: "Annual Return (%)", gridcolor: "#334155", zerolinecolor: "#475569" },
            barmode: compareMode ? "group" : "relative",
            legend: { orientation: "h", y: -0.15, font: { size: 10 } },
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Stats comparison */}
      <div className="overflow-x-auto rounded-lg border border-[#334155]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1e293b]">
              <th className="px-3 py-2 text-left text-xs text-[#94a3b8]">Metric</th>
              <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">{activeFactor}</th>
              {compareMode && (
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">{activeCompare}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {statRows.map((row) => (
              <tr key={row.label} className="border-t border-[#334155]">
                <td className="px-3 py-2 text-[#94a3b8]">{row.label}</td>
                <td className="px-3 py-2 text-right">
                  {stats[activeFactor] ? row.fmt(stats[activeFactor], activeFactor) : "N/A"}
                </td>
                {compareMode && (
                  <td className="px-3 py-2 text-right">
                    {stats[activeCompare] ? row.fmt(stats[activeCompare], activeCompare) : "N/A"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
