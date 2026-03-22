import { useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { loadFactorStats, loadSignalDoc } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import Methodology, { MathBlock, MNote } from "../components/Methodology";
import type { FactorStats } from "../types";

export default function Overview() {
  const { data: stats, loading: l1 } = useData(useCallback(() => loadFactorStats(), []));
  const { data: signalDoc, loading: l2 } = useData(useCallback(() => loadSignalDoc(), []));

  if (l1 || l2) return <LoadingSpinner />;
  if (!stats) return <div className="text-red-400">Failed to load data. Run the data pipeline first.</div>;

  const factors = Object.values(stats);

  // Summary stats
  const avgSharpe = factors.reduce((s, f) => s + f.sharpe_ratio, 0) / factors.length;
  const positiveSharpe = factors.filter((f) => f.sharpe_ratio > 0).length;
  const avgTStat = factors.reduce((s, f) => s + Math.abs(f.t_stat), 0) / factors.length;

  // Category distribution
  const categories: Record<string, number> = {};
  if (signalDoc) {
    signalDoc.forEach((s) => {
      const cat = s["Cat.Economic"] || "Unknown";
      categories[cat] = (categories[cat] || 0) + 1;
    });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#f1f5f9]">Dashboard Overview</h2>
      <p className="text-sm text-[#94a3b8]">
        At-a-glance summary of all 212 factors. Sharpe ratio and t-statistic distributions show the overall landscape of anomaly profitability. The top-20 chart highlights the strongest performers, and the category breakdown shows how factors cluster across economic themes.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Factors" value={factors.length.toString()} />
        <StatCard label="Avg Sharpe Ratio" value={avgSharpe.toFixed(3)} color={avgSharpe > 0 ? "#10b981" : "#ef4444"} />
        <StatCard label="Positive Sharpe" value={`${positiveSharpe} / ${factors.length}`} />
        <StatCard label="Avg |t-stat|" value={avgTStat.toFixed(2)} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SharpeDistribution factors={factors} />
        <TopFactorsChart factors={factors} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TStatDistribution factors={factors} />
        {Object.keys(categories).length > 0 && <CategoryPie categories={categories} />}
      </div>

      <Methodology>
        <MNote title="Sharpe Ratio">Annualized Sharpe ratio for each factor:</MNote>
        <MathBlock>{"$$\\text{Sharpe} = \\frac{\\bar{r}}{\\sigma_r} \\times \\sqrt{12}$$"}</MathBlock>
        <MNote title="t-Statistic">Tests whether mean monthly return differs from zero:</MNote>
        <MathBlock>{"$$t = \\frac{\\bar{r}}{\\sigma_r / \\sqrt{N}}$$"}</MathBlock>
        <MNote title="Returns">All returns are monthly long-short portfolio returns from openassetpricing.com (Chen & Zimmermann 2022). Raw data is in percentage form (e.g., 1.68 = 1.68%); the pipeline divides by 100 to convert to decimals. Top-20 chart ranks factors by annualized Sharpe ratio.</MNote>
        <MNote title="Data">212 factors, sample periods vary by factor (earliest: 1926-07, latest end: 2024-11). No forward-filling of missing data. Category assignments follow the Chen & Zimmermann taxonomy.</MNote>
      </Methodology>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
      <div className="text-xs text-[#94a3b8] uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: color || "#f1f5f9" }}>
        {value}
      </div>
    </div>
  );
}

function SharpeDistribution({ factors }: { factors: FactorStats[] }) {
  const sharpes = factors.map((f) => f.sharpe_ratio);
  return (
    <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
      <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Sharpe Ratio Distribution</h3>
      <Plot
        data={[
          {
            x: sharpes,
            type: "histogram",
            marker: { color: "#3b82f6" },
            nbinsx: 40,
          },
        ]}
        layout={{
          height: 300,
          margin: { t: 10, b: 40, l: 50, r: 20 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: { color: "#94a3b8", size: 11 },
          xaxis: { title: "Sharpe Ratio", gridcolor: "#334155", zerolinecolor: "#475569" },
          yaxis: { title: "Count", gridcolor: "#334155" },
        }}
        config={{ displayModeBar: false }}
        style={{ width: "100%" }}
      />
    </div>
  );
}

function TopFactorsChart({ factors }: { factors: FactorStats[] }) {
  const top20 = useMemo(
    () => [...factors].sort((a, b) => b.sharpe_ratio - a.sharpe_ratio).slice(0, 20),
    [factors]
  );

  return (
    <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
      <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Top 20 Factors by Sharpe Ratio</h3>
      <Plot
        data={[
          {
            y: top20.map((f) => f.name),
            x: top20.map((f) => f.sharpe_ratio),
            type: "bar",
            orientation: "h",
            marker: {
              color: top20.map((f) =>
                f.sharpe_ratio > 0 ? "#10b981" : "#ef4444"
              ),
            },
          },
        ]}
        layout={{
          height: 300,
          margin: { t: 10, b: 30, l: 120, r: 20 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: { color: "#94a3b8", size: 10 },
          xaxis: { title: "Sharpe Ratio", gridcolor: "#334155" },
          yaxis: { autorange: "reversed" },
        }}
        config={{ displayModeBar: false }}
        style={{ width: "100%" }}
      />
    </div>
  );
}

function TStatDistribution({ factors }: { factors: FactorStats[] }) {
  const tstats = factors.map((f) => f.t_stat);
  return (
    <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
      <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">t-Statistic Distribution</h3>
      <Plot
        data={[
          {
            x: tstats,
            type: "histogram",
            marker: { color: "#8b5cf6" },
            nbinsx: 40,
          },
        ]}
        layout={{
          height: 300,
          margin: { t: 10, b: 40, l: 50, r: 20 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: { color: "#94a3b8", size: 11 },
          xaxis: { title: "t-Statistic", gridcolor: "#334155", zerolinecolor: "#475569" },
          yaxis: { title: "Count", gridcolor: "#334155" },
          shapes: [
            {
              type: "line",
              x0: 1.96,
              x1: 1.96,
              y0: 0,
              y1: 1,
              yref: "paper",
              line: { color: "#f59e0b", width: 1, dash: "dash" },
            },
            {
              type: "line",
              x0: -1.96,
              x1: -1.96,
              y0: 0,
              y1: 1,
              yref: "paper",
              line: { color: "#f59e0b", width: 1, dash: "dash" },
            },
          ],
        }}
        config={{ displayModeBar: false }}
        style={{ width: "100%" }}
      />
    </div>
  );
}

function CategoryPie({ categories }: { categories: Record<string, number> }) {
  const labels = Object.keys(categories);
  const values = Object.values(categories);
  return (
    <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
      <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Factors by Economic Category</h3>
      <Plot
        data={[
          {
            labels,
            values,
            type: "pie",
            hole: 0.4,
            textinfo: "label+percent",
            textfont: { size: 10 },
            marker: {
              colors: [
                "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
                "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#a855f7",
              ],
            },
          },
        ]}
        layout={{
          height: 300,
          margin: { t: 10, b: 10, l: 10, r: 10 },
          paper_bgcolor: "transparent",
          font: { color: "#94a3b8", size: 11 },
          showlegend: false,
        }}
        config={{ displayModeBar: false }}
        style={{ width: "100%" }}
      />
    </div>
  );
}
