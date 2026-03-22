import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { loadMonthlyReturns, loadFactorStats } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorSearch from "../components/FactorSearch";
import { getColor } from "../chartColors";
import Methodology, { MNote } from "../components/Methodology";

const WINDOWS = [12, 24, 36, 60];

function rollingMean(vals: number[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < vals.length; i++) {
    if (i < window - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += vals[j];
    result.push(sum / window);
  }
  return result;
}

function rollingStd(vals: number[], window: number): (number | null)[] {
  const means = rollingMean(vals, window);
  const result: (number | null)[] = [];
  for (let i = 0; i < vals.length; i++) {
    if (means[i] == null) { result.push(null); continue; }
    let ss = 0;
    for (let j = i - window + 1; j <= i; j++) ss += (vals[j] - means[i]!) ** 2;
    result.push(Math.sqrt(ss / (window - 1)));
  }
  return result;
}

function rollingSharpe(vals: number[], window: number): (number | null)[] {
  const means = rollingMean(vals, window);
  const stds = rollingStd(vals, window);
  return means.map((m, i) => {
    if (m == null || stds[i] == null || stds[i]! < 1e-10) return null;
    return (m / stds[i]!) * Math.sqrt(12);
  });
}

function rollingCorr(a: number[], b: number[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < a.length; i++) {
    if (i < window - 1) { result.push(null); continue; }
    const sliceA = a.slice(i - window + 1, i + 1);
    const sliceB = b.slice(i - window + 1, i + 1);
    const mA = sliceA.reduce((s, v) => s + v, 0) / window;
    const mB = sliceB.reduce((s, v) => s + v, 0) / window;
    let cov = 0, vA = 0, vB = 0;
    for (let j = 0; j < window; j++) {
      const da = sliceA[j] - mA, db = sliceB[j] - mB;
      cov += da * db; vA += da * da; vB += db * db;
    }
    const denom = Math.sqrt(vA * vB);
    result.push(denom > 1e-10 ? cov / denom : null);
  }
  return result;
}

export default function RollingStats() {
  const { data: monthly, loading: l1 } = useData(useCallback(() => loadMonthlyReturns(), []));
  const { data: stats, loading: l2 } = useData(useCallback(() => loadFactorStats(), []));
  const [selected, setSelected] = useState(["Mom12m", "BM"]);
  const [window, setWindow] = useState(36);
  const [metric, setMetric] = useState<"sharpe" | "vol" | "mean" | "corr">("sharpe");

  if (l1 || l2) return <LoadingSpinner />;
  if (!monthly || !stats) return <div className="text-red-400">No data</div>;

  const allFactors = Object.keys(monthly).sort();
  const valid = selected.filter((f) => monthly[f]);

  function handleToggle(f: string) {
    setSelected((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  }

  // Compute rolling stats
  const traces: any[] = [];

  if (metric === "corr" && valid.length >= 2) {
    // Pairwise correlations
    for (let i = 0; i < valid.length; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        const fa = valid[i], fb = valid[j];
        const tsA = monthly[fa], tsB = monthly[fb];
        // Align dates
        const dateSet = new Set(tsA.dates);
        const commonDates = tsB.dates.filter((d) => dateSet.has(d));
        const mapA = new Map(tsA.dates.map((d, k) => [d, tsA.values[k]]));
        const mapB = new Map(tsB.dates.map((d, k) => [d, tsB.values[k]]));
        const aVals = commonDates.map((d) => mapA.get(d)!);
        const bVals = commonDates.map((d) => mapB.get(d)!);
        const corr = rollingCorr(aVals, bVals, window);
        traces.push({
          x: commonDates,
          y: corr,
          type: "scatter",
          mode: "lines",
          name: `${fa} vs ${fb}`,
          line: { width: 1.5 },
        });
      }
    }
  } else {
    valid.forEach((f, i) => {
      const ts = monthly[f];
      let vals: (number | null)[];
      if (metric === "sharpe") vals = rollingSharpe(ts.values, window);
      else if (metric === "vol") vals = rollingStd(ts.values, window).map((v) => v != null ? v * Math.sqrt(12) * 100 : null);
      else vals = rollingMean(ts.values, window).map((v) => v != null ? v * 100 : null);

      traces.push({
        x: ts.dates,
        y: vals,
        type: "scatter",
        mode: "lines",
        name: f,
        line: { color: getColor(i), width: 1.5 },
      });
    });
  }

  const yTitle = metric === "sharpe" ? "Rolling Sharpe (annualized)"
    : metric === "vol" ? "Rolling Volatility (% ann.)"
    : metric === "corr" ? "Rolling Correlation"
    : "Rolling Mean Return (%/mo)";

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#94a3b8]">
        Rolling window statistics (Sharpe ratio, volatility, mean return, or pairwise correlation) for selected factors. Reveals how stable a factor's characteristics are over time — a factor with a high full-sample Sharpe but wildly varying rolling Sharpe may be less reliable than one with steady performance.
      </p>

      <div className="flex flex-wrap gap-3 items-start">
        <div className="flex-1 min-w-[250px]">
          <FactorSearch factors={allFactors} selected={valid} onToggle={handleToggle} maxSelect={8} />
        </div>
        <div className="flex gap-2 items-center">
          <select value={metric} onChange={(e) => setMetric(e.target.value as any)}
            className="px-2 py-1.5 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]">
            <option value="sharpe">Sharpe Ratio</option>
            <option value="vol">Volatility</option>
            <option value="mean">Mean Return</option>
            <option value="corr">Pairwise Correlation</option>
          </select>
          <select value={window} onChange={(e) => setWindow(Number(e.target.value))}
            className="px-2 py-1.5 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]">
            {WINDOWS.map((w) => <option key={w} value={w}>{w} months</option>)}
          </select>
        </div>
      </div>

      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <Plot
          data={traces}
          layout={{
            height: 500,
            margin: { t: 10, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { gridcolor: "#334155", type: "date" },
            yaxis: { title: yTitle, gridcolor: "#334155", zerolinecolor: "#475569" },
            legend: { orientation: "h", y: -0.2, font: { size: 10 } },
            hovermode: "x unified",
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      <Methodology>
        <MNote title="Rolling Window">All statistics are computed over a trailing window of the user-selected length (default 36 months). The window slides one month at a time. A minimum of 12 months of data within the window is required to compute a statistic.</MNote>
        <MNote title="Rolling Sharpe">{"$\\text{Sharpe}_t = \\frac{\\bar{r}_{[t-w,t]}}{\\sigma_{[t-w,t]}} \\times \\sqrt{12}$ where $w$ is the window length in months."}</MNote>
        <MNote title="Rolling Correlation">Pairwise Pearson correlation computed over the trailing window between two selected factors. Uses only months where both factors have data.</MNote>
        <MNote title="Data">{"Monthly long-short returns. The first $w-1$ months of each series produce no output (insufficient window). Missing months within the window reduce the effective sample size but do not halt computation."}</MNote>
      </Methodology>
    </div>
  );
}
