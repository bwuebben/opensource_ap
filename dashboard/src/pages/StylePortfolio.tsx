import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import {
  loadStyleReturns,
  loadStyleStats,
  loadStyleCorrelation,
  type StyleStats,
} from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import type { TimeSeries } from "../types";

const STYLE_COLORS: Record<string, string> = {
  Value: "#3b82f6",
  Momentum: "#ef4444",
  Quality: "#10b981",
  Investment: "#f59e0b",
  Risk: "#8b5cf6",
  Size: "#06b6d4",
  Accruals: "#ec4899",
  Liquidity: "#14b8a6",
  "Leverage & Financing": "#f97316",
  "Analyst & Sentiment": "#a855f7",
  "Intangibles & Innovation": "#84cc16",
  "Payout & Ownership": "#e11d48",
  "Sales Growth": "#0ea5e9",
  Other: "#64748b",
};

// Default: the "classic" multi-factor styles
const DEFAULT_STYLES = ["Value", "Momentum", "Quality", "Investment", "Risk", "Liquidity"];

interface PortfolioStats {
  annReturn: number;
  annVol: number;
  sharpe: number;
  tStat: number;
  totalReturn: number;
  maxDrawdown: number;
  pctPositive: number;
  bestMonth: number;
  worstMonth: number;
  nMonths: number;
  startDate: string;
  endDate: string;
  skewness: number;
  kurtosis: number;
  calmarRatio: number;
}

function computePortfolioFromStyles(
  styleReturns: Record<string, TimeSeries>,
  selectedStyles: string[]
): { dates: string[]; returns: number[]; cumulative: number[]; drawdown: number[] } | null {
  const available = selectedStyles.filter((s) => styleReturns[s]);
  if (available.length === 0) return null;

  // Collect all dates
  const allDates = new Set<string>();
  for (const s of available) {
    for (const d of styleReturns[s].dates) allDates.add(d);
  }
  const dates = Array.from(allDates).sort();

  // Build lookup per style
  const lookups = available.map((s) => {
    const m = new Map<string, number>();
    const ts = styleReturns[s];
    for (let i = 0; i < ts.dates.length; i++) m.set(ts.dates[i], ts.values[i]);
    return m;
  });

  // Equal-weight average each date
  const returns: number[] = [];
  const validDates: string[] = [];
  for (const d of dates) {
    const vals: number[] = [];
    for (const lk of lookups) {
      const v = lk.get(d);
      if (v != null) vals.push(v);
    }
    if (vals.length > 0) {
      validDates.push(d);
      returns.push(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }

  // Cumulative
  const cumulative: number[] = [];
  let cum = 1;
  for (const r of returns) {
    cum *= 1 + r;
    cumulative.push(cum);
  }

  // Drawdown
  let peak = 0;
  const drawdown: number[] = [];
  for (const c of cumulative) {
    if (c > peak) peak = c;
    drawdown.push((c - peak) / peak);
  }

  return { dates: validDates, returns, cumulative, drawdown };
}

function computeStats(returns: number[], dates: string[]): PortfolioStats {
  const n = returns.length;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);
  const annVol = std * Math.sqrt(12);

  // Cumulative
  let cum = 1;
  let peak = 0;
  let maxDD = 0;
  for (const r of returns) {
    cum *= 1 + r;
    if (cum > peak) peak = cum;
    const dd = (cum - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  const totalReturn = cum - 1;
  const nYears = n / 12;
  const annReturn = totalReturn > -1 ? (1 + totalReturn) ** (1 / nYears) - 1 : -1;
  const sharpe = annVol > 0 ? annReturn / annVol : 0;
  const tStat = std > 0 ? mean / (std / Math.sqrt(n)) : 0;
  const pctPositive = returns.filter((r) => r > 0).length / n;

  // Skewness & kurtosis
  const m3 = returns.reduce((a, r) => a + ((r - mean) / std) ** 3, 0) / n;
  const m4 = returns.reduce((a, r) => a + ((r - mean) / std) ** 4, 0) / n - 3;

  const calmar = maxDD !== 0 ? annReturn / Math.abs(maxDD) : 0;

  return {
    annReturn,
    annVol,
    sharpe,
    tStat,
    totalReturn,
    maxDrawdown: maxDD,
    pctPositive,
    bestMonth: Math.max(...returns),
    worstMonth: Math.min(...returns),
    nMonths: n,
    startDate: dates[0],
    endDate: dates[n - 1],
    skewness: m3,
    kurtosis: m4,
    calmarRatio: calmar,
  };
}

export default function StylePortfolio() {
  const { data: styleReturns, loading: l1 } = useData(useCallback(() => loadStyleReturns(), []));
  const { data: styleStats, loading: l2 } = useData(useCallback(() => loadStyleStats(), []));
  const { data: corr, loading: l3 } = useData(useCallback(() => loadStyleCorrelation(), []));
  const [selectedStyles, setSelectedStyles] = useState<string[]>(DEFAULT_STYLES);
  const [logScale, setLogScale] = useState(true);
  const [showDrawdown, setShowDrawdown] = useState(false);

  const allStyles = useMemo(() => {
    if (!styleStats) return [];
    return Object.keys(styleStats).sort((a, b) =>
      (styleStats[b]?.sharpe_ratio ?? 0) - (styleStats[a]?.sharpe_ratio ?? 0)
    );
  }, [styleStats]);

  const portfolio = useMemo(() => {
    if (!styleReturns) return null;
    return computePortfolioFromStyles(styleReturns, selectedStyles);
  }, [styleReturns, selectedStyles]);

  const portfolioStats = useMemo(() => {
    if (!portfolio) return null;
    return computeStats(portfolio.returns, portfolio.dates);
  }, [portfolio]);

  // Compute rolling 12m return for portfolio
  const rolling12m = useMemo(() => {
    if (!portfolio || portfolio.returns.length < 12) return null;
    const dates: string[] = [];
    const values: number[] = [];
    for (let i = 11; i < portfolio.returns.length; i++) {
      let cum = 1;
      for (let j = i - 11; j <= i; j++) cum *= 1 + portfolio.returns[j];
      dates.push(portfolio.dates[i]);
      values.push((cum - 1) * 100);
    }
    return { dates, values };
  }, [portfolio]);

  // Annual returns
  const annualReturns = useMemo(() => {
    if (!portfolio) return null;
    const byYear: Record<number, number[]> = {};
    for (let i = 0; i < portfolio.dates.length; i++) {
      const year = new Date(portfolio.dates[i]).getFullYear();
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(portfolio.returns[i]);
    }
    const years = Object.keys(byYear).map(Number).sort();
    const values = years.map((y) => {
      let cum = 1;
      for (const r of byYear[y]) cum *= 1 + r;
      return cum - 1;
    });
    return { years, values };
  }, [portfolio]);

  if (l1 || l2 || l3) return <LoadingSpinner />;
  if (!styleReturns || !styleStats) return <div className="text-red-400">No style data</div>;

  function toggleStyle(style: string) {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  }

  // Build chart traces: portfolio + individual styles
  const traces: any[] = [];
  if (portfolio) {
    traces.push({
      x: portfolio.dates,
      y: portfolio.cumulative,
      type: "scatter",
      mode: "lines",
      name: `Composite (${selectedStyles.length} styles)`,
      line: { color: "#f1f5f9", width: 3 },
    });
  }
  for (const s of selectedStyles) {
    if (!styleReturns[s]) continue;
    const cum: number[] = [];
    let c = 1;
    for (const r of styleReturns[s].values) {
      c *= 1 + r;
      cum.push(c);
    }
    traces.push({
      x: styleReturns[s].dates,
      y: cum,
      type: "scatter",
      mode: "lines",
      name: s,
      line: { color: STYLE_COLORS[s] || "#94a3b8", width: 1.5, dash: "dot" },
      opacity: 0.7,
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        Build a multi-style factor portfolio by toggling styles on and off. The portfolio equal-weights the selected style returns each month. Stats update live as you add or remove styles — useful for exploring how combining different factor themes (e.g., Value + Momentum + Quality) improves risk-adjusted returns.
      </p>

      {/* Style toggles */}
      <div className="flex flex-wrap gap-2">
        {allStyles.map((style) => {
          const isActive = selectedStyles.includes(style);
          const color = STYLE_COLORS[style] || "#94a3b8";
          const s = styleStats[style];
          return (
            <button
              key={style}
              onClick={() => toggleStyle(style)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isActive
                  ? "border-transparent"
                  : "border-[#334155] opacity-40 hover:opacity-70"
              }`}
              style={
                isActive
                  ? { backgroundColor: color + "25", color, borderColor: color + "50" }
                  : {}
              }
            >
              {style}
            </button>
          );
        })}
        <button
          onClick={() => setSelectedStyles(allStyles)}
          className="px-3 py-1.5 rounded-lg text-xs border border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#475569]"
        >
          Select All
        </button>
        <button
          onClick={() => setSelectedStyles(DEFAULT_STYLES)}
          className="px-3 py-1.5 rounded-lg text-xs border border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#475569]"
        >
          Classic 6
        </button>
      </div>

      {/* Portfolio stats cards */}
      {portfolioStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="Sharpe Ratio" value={portfolioStats.sharpe.toFixed(3)} color={portfolioStats.sharpe > 0 ? "#10b981" : "#ef4444"} />
          <StatCard label="Ann. Return" value={`${(portfolioStats.annReturn * 100).toFixed(2)}%`} color={portfolioStats.annReturn > 0 ? "#10b981" : "#ef4444"} />
          <StatCard label="Ann. Volatility" value={`${(portfolioStats.annVol * 100).toFixed(2)}%`} />
          <StatCard label="t-Statistic" value={portfolioStats.tStat.toFixed(2)} color={Math.abs(portfolioStats.tStat) > 1.96 ? "#f59e0b" : undefined} />
          <StatCard label="Max Drawdown" value={`${(portfolioStats.maxDrawdown * 100).toFixed(1)}%`} color="#ef4444" />
          <StatCard label="Calmar Ratio" value={portfolioStats.calmarRatio.toFixed(2)} />
          <StatCard label="% Positive Mo." value={`${(portfolioStats.pctPositive * 100).toFixed(1)}%`} />
        </div>
      )}

      {/* Cumulative return chart */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[#f1f5f9]">
            Cumulative Returns - Composite vs Individual Styles
          </h3>
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
              <input type="checkbox" checked={logScale} onChange={(e) => setLogScale(e.target.checked)} className="accent-[#3b82f6]" />
              Log
            </label>
          </div>
        </div>
        <Plot
          data={traces}
          layout={{
            height: 500,
            margin: { t: 10, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { gridcolor: "#334155", type: "date", rangeslider: { visible: true } },
            yaxis: {
              title: "Growth of $1",
              gridcolor: "#334155",
              type: logScale ? "log" : "linear",
            },
            legend: { orientation: "h", y: -0.25, font: { size: 9 } },
            hovermode: "x unified",
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Drawdown chart */}
      {portfolio && (
        <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
          <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Portfolio Drawdown</h3>
          <Plot
            data={[
              {
                x: portfolio.dates,
                y: portfolio.drawdown.map((v) => v * 100),
                type: "scatter",
                mode: "lines",
                fill: "tozeroy",
                line: { color: "#ef4444", width: 1 },
                fillcolor: "rgba(239,68,68,0.15)",
                hovertemplate: "%{x}: %{y:.2f}%<extra>Drawdown</extra>",
              },
            ]}
            layout={{
              height: 250,
              margin: { t: 10, b: 30, l: 60, r: 20 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { color: "#94a3b8", size: 11 },
              xaxis: { gridcolor: "#334155", type: "date" },
              yaxis: { title: "Drawdown (%)", gridcolor: "#334155", rangemode: "nonpositive" },
              hovermode: "x unified",
            }}
            config={{ displayModeBar: false }}
            style={{ width: "100%" }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rolling 12m return */}
        {rolling12m && (
          <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
            <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Rolling 12-Month Return</h3>
            <Plot
              data={[
                {
                  x: rolling12m.dates,
                  y: rolling12m.values,
                  type: "scatter",
                  mode: "lines",
                  line: { color: "#3b82f6", width: 1.5 },
                  fill: "tozeroy",
                  fillcolor: "rgba(59,130,246,0.1)",
                  hovertemplate: "%{x}: %{y:.2f}%<extra></extra>",
                },
              ]}
              layout={{
                height: 300,
                margin: { t: 10, b: 30, l: 50, r: 20 },
                paper_bgcolor: "transparent",
                plot_bgcolor: "transparent",
                font: { color: "#94a3b8", size: 11 },
                xaxis: { gridcolor: "#334155", type: "date" },
                yaxis: { title: "Return (%)", gridcolor: "#334155", zerolinecolor: "#475569" },
              }}
              config={{ displayModeBar: false }}
              style={{ width: "100%" }}
            />
          </div>
        )}

        {/* Annual returns */}
        {annualReturns && (
          <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
            <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Annual Returns</h3>
            <Plot
              data={[
                {
                  x: annualReturns.years.map(String),
                  y: annualReturns.values.map((v) => v * 100),
                  type: "bar",
                  marker: {
                    color: annualReturns.values.map((v) => (v >= 0 ? "#10b981" : "#ef4444")),
                  },
                  hovertemplate: "%{x}: %{y:.2f}%<extra></extra>",
                },
              ]}
              layout={{
                height: 300,
                margin: { t: 10, b: 30, l: 50, r: 20 },
                paper_bgcolor: "transparent",
                plot_bgcolor: "transparent",
                font: { color: "#94a3b8", size: 11 },
                xaxis: { gridcolor: "#334155" },
                yaxis: { title: "Return (%)", gridcolor: "#334155", zerolinecolor: "#475569" },
              }}
              config={{ displayModeBar: false }}
              style={{ width: "100%" }}
            />
          </div>
        )}
      </div>

      {/* Detailed stats table */}
      {portfolioStats && (
        <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
          <h3 className="text-sm font-semibold text-[#f1f5f9] mb-3">Detailed Portfolio Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-sm">
            <Row label="Period" value={`${portfolioStats.startDate} to ${portfolioStats.endDate}`} />
            <Row label="Months" value={portfolioStats.nMonths.toString()} />
            <Row label="Styles Included" value={selectedStyles.length.toString()} />
            <Row label="Total Return" value={`${(portfolioStats.totalReturn * 100).toFixed(1)}%`} />
            <Row label="Annualized Return" value={`${(portfolioStats.annReturn * 100).toFixed(2)}%`} color={portfolioStats.annReturn > 0 ? "#10b981" : "#ef4444"} />
            <Row label="Annualized Volatility" value={`${(portfolioStats.annVol * 100).toFixed(2)}%`} />
            <Row label="Sharpe Ratio" value={portfolioStats.sharpe.toFixed(3)} color={portfolioStats.sharpe > 0 ? "#10b981" : "#ef4444"} />
            <Row label="t-Statistic" value={portfolioStats.tStat.toFixed(2)} />
            <Row label="Max Drawdown" value={`${(portfolioStats.maxDrawdown * 100).toFixed(1)}%`} color="#ef4444" />
            <Row label="Calmar Ratio" value={portfolioStats.calmarRatio.toFixed(2)} />
            <Row label="% Positive Months" value={`${(portfolioStats.pctPositive * 100).toFixed(1)}%`} />
            <Row label="Best Month" value={`${(portfolioStats.bestMonth * 100).toFixed(2)}%`} color="#10b981" />
            <Row label="Worst Month" value={`${(portfolioStats.worstMonth * 100).toFixed(2)}%`} color="#ef4444" />
            <Row label="Skewness" value={portfolioStats.skewness.toFixed(3)} />
            <Row label="Excess Kurtosis" value={portfolioStats.kurtosis.toFixed(3)} />
          </div>
        </div>
      )}

      {/* Style contribution - which styles contribute most */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-3">Style Contribution to Portfolio</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="px-3 py-2 text-left text-xs text-[#94a3b8]">Style</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Weight</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Style Sharpe</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Style Ann. Ret</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Style Ann. Vol</th>
                <th className="px-3 py-2 text-right text-xs text-[#94a3b8]">Return Contrib.</th>
              </tr>
            </thead>
            <tbody>
              {selectedStyles
                .filter((s) => styleStats[s])
                .sort((a, b) => (styleStats[b]?.sharpe_ratio ?? 0) - (styleStats[a]?.sharpe_ratio ?? 0))
                .map((style) => {
                  const s = styleStats[style];
                  const w = 1 / selectedStyles.length;
                  const contrib = s.ann_return * w;
                  return (
                    <tr key={style} className="border-t border-[#334155]/50">
                      <td className="px-3 py-2 font-medium" style={{ color: STYLE_COLORS[style] || "#94a3b8" }}>
                        {style}
                      </td>
                      <td className="px-3 py-2 text-right text-[#94a3b8]">
                        {(w * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={s.sharpe_ratio > 0 ? "text-[#10b981]" : "text-[#ef4444]"}>
                          {s.sharpe_ratio.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(s.ann_return * 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(s.ann_volatility * 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(contrib * 100).toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              {portfolioStats && (
                <tr className="border-t-2 border-[#475569] font-medium">
                  <td className="px-3 py-2 text-[#f1f5f9]">Portfolio</td>
                  <td className="px-3 py-2 text-right text-[#f1f5f9]">100%</td>
                  <td className="px-3 py-2 text-right text-[#10b981]">{portfolioStats.sharpe.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right text-[#f1f5f9]">{(portfolioStats.annReturn * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right text-[#f1f5f9]">{(portfolioStats.annVol * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right text-[#f1f5f9]">{(portfolioStats.annReturn * 100).toFixed(2)}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0f172a] rounded-lg p-3 border border-[#334155]">
      <div className="text-[10px] text-[#64748b] uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold font-mono mt-0.5" style={{ color: color || "#f1f5f9" }}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-[#64748b]">{label}</span>
      <span className="font-mono" style={{ color: color || "#f1f5f9" }}>{value}</span>
    </div>
  );
}
