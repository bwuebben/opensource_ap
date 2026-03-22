import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { loadMonthlyReturns, loadFactorStats } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";

interface MacroSeries {
  dates: string[];
  values: (number | null)[];
  description: string;
}

interface ReturnSeries {
  dates: string[];
  values: number[];
}

async function loadMacro(): Promise<Record<string, MacroSeries>> {
  const r = await fetch("/data/macro_series.json");
  if (!r.ok) throw new Error("No macro data");
  return r.json();
}

async function loadStyleReturns(): Promise<Record<string, ReturnSeries>> {
  const r = await fetch("/data/style_returns.json");
  if (!r.ok) return {};
  return r.json();
}

function simpleOLS(x: number[], y: number[]): { alpha: number; beta: number; r2: number; tStat: number; pValue: number; n: number } {
  const n = x.length;
  if (n < 3) return { alpha: 0, beta: 0, r2: 0, tStat: 0, pValue: 1, n };
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let ssxy = 0, ssxx = 0, ssyy = 0;
  for (let i = 0; i < n; i++) {
    ssxy += (x[i] - mx) * (y[i] - my);
    ssxx += (x[i] - mx) ** 2;
    ssyy += (y[i] - my) ** 2;
  }
  const beta = ssxx > 0 ? ssxy / ssxx : 0;
  const alpha = my - beta * mx;
  const r2 = ssyy > 0 ? (ssxy ** 2) / (ssxx * ssyy) : 0;
  // t-stat for beta
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (y[i] - alpha - beta * x[i]) ** 2;
  const seBeta = ssxx > 0 && n > 2 ? Math.sqrt(sse / (n - 2) / ssxx) : 1;
  const tStat = seBeta > 0 ? beta / seBeta : 0;
  // Approx p-value from t-stat (two-tailed, rough)
  const pValue = Math.exp(-0.717 * Math.abs(tStat) - 0.416 * tStat ** 2);
  return { alpha, beta, r2, tStat, pValue: Math.min(pValue, 1), n };
}

export default function FactorMacroReg() {
  const { data: macro, loading: l1 } = useData(useCallback(() => loadMacro(), []));
  const { data: monthly, loading: l2 } = useData(useCallback(() => loadMonthlyReturns(), []));
  const { data: stats, loading: l3 } = useData(useCallback(() => loadFactorStats(), []));
  const { data: styles, loading: l4 } = useData(useCallback(() => loadStyleReturns(), []));
  const [factor, setFactor] = useState("Mom12m");
  const [macroVar, setMacroVar] = useState("INDPRO");

  // Merge style returns with individual factor returns
  const allReturns = useMemo(() => {
    const merged: Record<string, ReturnSeries> = {};
    if (monthly) Object.assign(merged, monthly);
    if (styles) {
      for (const [name, data] of Object.entries(styles)) {
        merged[`Style: ${name}`] = data;
      }
    }
    return merged;
  }, [monthly, styles]);

  const styleNames = useMemo(() => {
    if (!styles) return [];
    return Object.keys(styles).sort().map((s) => `Style: ${s}`);
  }, [styles]);

  const individualFactors = useMemo(() => {
    if (!monthly) return [];
    return Object.keys(monthly).sort();
  }, [monthly]);

  if (l1 || l2 || l3 || l4) return <LoadingSpinner />;
  if (!macro || !monthly || !stats) return <div className="text-red-400">Missing data. Run download_macro.py.</div>;

  const allMacro = Object.keys(macro).sort();
  const activeFactor = allReturns[factor] ? factor : individualFactors[0];
  const activeVar = macro[macroVar] ? macroVar : allMacro[0];

  // Align data by year-month (macro uses 1st of month, factors use end of month)
  const toYM = (d: string) => d.slice(0, 7); // "YYYY-MM"

  const activeData = allReturns[activeFactor];
  const fMap = new Map<string, number>();
  for (let i = 0; i < activeData.dates.length; i++) {
    fMap.set(toYM(activeData.dates[i]), activeData.values[i]);
  }

  const mMap = new Map<string, number>();
  const ts = macro[activeVar];
  for (let i = 0; i < ts.dates.length; i++) {
    if (ts.values[i] != null) mMap.set(toYM(ts.dates[i]), ts.values[i]!);
  }

  const commonDates: string[] = [];
  const fVals: number[] = [];
  const mVals: number[] = [];
  for (const [ym, fv] of fMap) {
    const mv = mMap.get(ym);
    if (fv != null && mv != null) {
      commonDates.push(ym);
      fVals.push(fv * 100); // percentage
      mVals.push(mv);
    }
  }

  const reg = simpleOLS(mVals, fVals);

  // Run regression of ALL factors + styles against this macro var to find most/least sensitive
  const allReturnKeys = Object.keys(allReturns);
  const allRegs = allReturnKeys.map((f) => {
    const fd = allReturns[f];
    const fm = new Map<string, number>();
    for (let i = 0; i < fd.dates.length; i++) {
      fm.set(toYM(fd.dates[i]), fd.values[i]);
    }
    const xv: number[] = [], yv: number[] = [];
    for (const [ym, fv] of fm) {
      const mv = mMap.get(ym);
      if (fv != null && mv != null) { xv.push(mv); yv.push(fv * 100); }
    }
    const r = simpleOLS(xv, yv);
    return { name: f, ...r };
  }).filter((r) => r.n >= 60).sort((a, b) => b.beta - a.beta);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#94a3b8]">
        Regress factor returns (%) on macro variables to understand factor sensitivities.
        Macro variables are McCracken-Ng transformed (e.g., S&P 500 is log first-differenced, so ~monthly returns in decimal).
        Factor returns are long-short: a negative beta means the factor underperforms when the macro variable rises.
        For example, Risk-style factors (long low-risk, short high-risk) have negative market beta because high-beta stocks
        outperform in rallies, hurting the short leg.
      </p>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-xs text-[#64748b]">Factor:</label>
        <select value={activeFactor} onChange={(e) => setFactor(e.target.value)}
          className="px-2 py-1.5 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]">
          <optgroup label="Style Factors">
            {styleNames.map((f) => <option key={f} value={f}>{f}</option>)}
          </optgroup>
          <optgroup label="Individual Factors">
            {individualFactors.map((f) => <option key={f} value={f}>{f}</option>)}
          </optgroup>
        </select>
        <label className="text-xs text-[#64748b]">Macro variable:</label>
        <select value={activeVar} onChange={(e) => setMacroVar(e.target.value)}
          className="px-2 py-1.5 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f1f5f9]">
          {allMacro.map((m) => <option key={m} value={m}>{m} - {macro[m].description?.slice(0, 40)}</option>)}
        </select>
      </div>

      {/* Regression stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Beta" value={reg.beta.toFixed(4)} color={reg.beta > 0 ? "#10b981" : "#ef4444"} />
        <StatCard label="R-squared" value={reg.r2.toFixed(4)} />
        <StatCard label="t-Statistic" value={reg.tStat.toFixed(2)} color={Math.abs(reg.tStat) > 1.96 ? "#f59e0b" : undefined} />
        <StatCard label="Alpha" value={`${reg.alpha.toFixed(3)}%/mo`} />
        <StatCard label="Observations" value={reg.n.toString()} />
      </div>

      {/* Scatter with regression line */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          {activeFactor} vs {activeVar}
        </h3>
        <Plot
          data={[
            {
              x: mVals, y: fVals,
              type: "scatter", mode: "markers",
              marker: { size: 4, color: "#3b82f6", opacity: 0.4 },
              hovertemplate: `${activeVar}: %{x:.2f}<br>${activeFactor}: %{y:.3f}%<extra></extra>`,
              name: "Observations",
            },
            {
              x: [Math.min(...mVals), Math.max(...mVals)],
              y: [reg.alpha + reg.beta * Math.min(...mVals), reg.alpha + reg.beta * Math.max(...mVals)],
              type: "scatter", mode: "lines",
              line: { color: "#ef4444", width: 2 },
              name: `y = ${reg.alpha.toFixed(3)} + ${reg.beta.toFixed(4)}x`,
            },
          ]}
          layout={{
            height: 400,
            margin: { t: 10, b: 50, l: 60, r: 20 },
            paper_bgcolor: "transparent", plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 11 },
            xaxis: { title: `${activeVar} (${macro[activeVar]?.description?.slice(0, 30) || ""})`, gridcolor: "#334155" },
            yaxis: { title: `${activeFactor} monthly return (%)`, gridcolor: "#334155" },
            legend: { orientation: "h", y: -0.2, font: { size: 10 } },
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {/* Sensitivity ranking: all factors vs this macro var */}
      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">
          All Factor Sensitivities to {activeVar}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs text-[#10b981] mb-1">Most Positive Beta (top 15)</h4>
            <table className="w-full text-xs">
              <tbody>
                {allRegs.slice(0, 15).map((r) => (
                  <tr key={r.name} className="border-t border-[#334155]/30">
                    <td className="py-0.5"><FactorName name={r.name} /></td>
                    <td className="py-0.5 text-right font-mono text-[#10b981]">{r.beta.toFixed(4)}</td>
                    <td className="py-0.5 text-right font-mono text-[#64748b]">t={r.tStat.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h4 className="text-xs text-[#ef4444] mb-1">Most Negative Beta (bottom 15)</h4>
            <table className="w-full text-xs">
              <tbody>
                {allRegs.slice(-15).reverse().map((r) => (
                  <tr key={r.name} className="border-t border-[#334155]/30">
                    <td className="py-0.5"><FactorName name={r.name} /></td>
                    <td className="py-0.5 text-right font-mono text-[#ef4444]">{r.beta.toFixed(4)}</td>
                    <td className="py-0.5 text-right font-mono text-[#64748b]">t={r.tStat.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0f172a] rounded-lg p-3 border border-[#334155]">
      <div className="text-[10px] text-[#64748b] uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold font-mono mt-0.5" style={{ color: color || "#f1f5f9" }}>{value}</div>
    </div>
  );
}
