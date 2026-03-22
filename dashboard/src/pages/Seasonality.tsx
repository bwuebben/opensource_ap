import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { loadFactorStats } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";
import Methodology, { MathBlock, MNote } from "../components/Methodology";

interface SeasonData {
  months: number[];
  by_factor: Record<string, number[]>;
  cross_factor: number[];
}

async function loadSeason(): Promise<SeasonData> {
  const r = await fetch("/data/factor_seasonality.json");
  if (!r.ok) throw new Error("No seasonality data");
  return r.json();
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Seasonality() {
  const { data, loading: l1 } = useData(useCallback(() => loadSeason(), []));
  const { data: stats, loading: l2 } = useData(useCallback(() => loadFactorStats(), []));
  const [selectedFactors, setSelectedFactors] = useState(["Mom12m", "BM", "Size", "GP"]);

  if (l1 || l2) return <LoadingSpinner />;
  if (!data) return <div className="text-red-400">No seasonality data.</div>;

  // Top factors by seasonality strength (max-min monthly avg)
  const seasonStrength = useMemo(() => {
    return Object.entries(data.by_factor)
      .map(([name, vals]) => {
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        return { name, range: max - min, vals };
      })
      .sort((a, b) => b.range - a.range);
  }, [data]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        Average factor return by calendar month, revealing seasonal patterns like the January effect, tax-loss selling in December, or window dressing at quarter-ends. The cross-factor heatmap shows which months are systematically strong or weak across many factors, and the "most seasonal" ranking identifies factors with the most pronounced calendar effects.
      </p>

      {/* Cross-factor seasonality */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          Average Across All Factors by Month
        </h3>
        <Plot
          data={[{
            x: MONTH_LABELS,
            y: data.cross_factor.map((v) => v * 100),
            type: "bar",
            marker: { color: data.cross_factor.map((v) => v >= 0 ? "#10b981" : "#ef4444") },
            hovertemplate: "%{x}: %{y:.4f}%<extra></extra>",
          }]}
          layout={{
            height: 250,
            margin: { t: 10, b: 30, l: 60, r: 20 },
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            yaxis: { title: "Avg Return (%)", gridcolor: "#334155", zerolinecolor: "#475569" },
          }}
          config={{ displayModeBar: false }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Selected factor seasonality */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Factor Seasonality Comparison</h3>
        <div className="flex flex-wrap gap-1 mb-3">
          {Object.keys(data.by_factor).sort().slice(0, 30).map((f) => (
            <button key={f}
              onClick={() => setSelectedFactors((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev.slice(-5), f])}
              className={`px-2 py-0.5 rounded text-[10px] ${selectedFactors.includes(f) ? "bg-[#3b82f6]/20 text-[#3b82f6]" : "bg-[#334155] text-[#64748b] hover:text-[#94a3b8]"}`}>
              {f}
            </button>
          ))}
        </div>
        <Plot
          data={selectedFactors.filter((f) => data.by_factor[f]).map((f, i) => ({
            x: MONTH_LABELS,
            y: data.by_factor[f].map((v) => v * 100),
            type: "scatter" as const, mode: "lines+markers" as const,
            name: f,
            line: { width: 2 },
            marker: { size: 5 },
          }))}
          layout={{
            height: 350,
            margin: { t: 10, b: 30, l: 60, r: 20 },
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            yaxis: { title: "Avg Monthly Return (%)", gridcolor: "#334155", zerolinecolor: "#475569" },
            legend: { orientation: "h", y: -0.15, font: { size: 10 } },
            hovermode: "x unified",
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Heatmap: top 30 most seasonal factors */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          Most Seasonal Factors (highest monthly return range)
        </h3>
        {(() => {
          const top30 = seasonStrength.slice(0, 30);
          return (
            <Plot
              data={[{
                z: top30.map((f) => f.vals.map((v) => Math.round(v * 10000) / 100)),
                x: MONTH_LABELS,
                y: top30.map((f) => f.name),
                type: "heatmap",
                colorscale: [[0, "#ef4444"], [0.5, "#1e293b"], [1, "#10b981"]],
                zmid: 0,
                hovertemplate: "%{y} %{x}: %{z:.3f}%<extra></extra>",
                colorbar: { title: "Ret (%)", titlefont: { color: "#94a3b8" }, tickfont: { color: "#94a3b8" } },
              }]}
              layout={{
                height: Math.max(300, top30.length * 18),
                margin: { t: 10, b: 30, l: 160, r: 60 },
                paper_bgcolor: "transparent", plot_bgcolor: "transparent",
                font: { color: "#94a3b8", size: 9 },
              }}
              config={{ responsive: true }}
              style={{ width: "100%" }}
            />
          );
        })()}
      </div>
      <Methodology>
        <MNote title="Monthly Averages">Average return by calendar month across all available years:</MNote>
        <MathBlock>{"$$\\bar{r}_m = \\frac{1}{N_m} \\sum_{y=1}^{N_m} r_{y,m}$$"}</MathBlock>
        <MNote title="Cross-Factor Seasonality">The heatmap shows the average return by calendar month averaged across all factors, revealing systematic calendar effects in the cross-section of anomalies.</MNote>
        <MNote title="Most Seasonal">Factors are ranked by the spread between their best and worst calendar month average returns: {"$\\max_m \\bar{r}_m - \\min_m \\bar{r}_m$"}.</MNote>
        <MNote title="Data">Monthly long-short returns. Missing months are excluded (not zero-filled). Calendar months with fewer than 5 years of data are suppressed. No adjustment for time-varying risk or serial correlation.</MNote>
      </Methodology>
    </div>
  );
}
