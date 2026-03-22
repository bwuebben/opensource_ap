import { useState, useCallback, useMemo } from "react";
import { useData } from "../hooks";
import { loadFactorStats, loadSignalDoc } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";
import type { FactorStats, SignalDoc } from "../types";

interface Filter {
  field: keyof FactorStats;
  op: ">" | "<" | ">=" | "<=";
  value: number;
  label: string;
}

const PRESET_SCREENS: { label: string; filters: Filter[] }[] = [
  {
    label: "Strong Predictors",
    filters: [
      { field: "t_stat", op: ">", value: 2, label: "t-stat > 2" },
      { field: "sharpe_ratio", op: ">", value: 0.3, label: "Sharpe > 0.3" },
      { field: "n_months", op: ">=", value: 360, label: "30+ years" },
    ],
  },
  {
    label: "High Sharpe, Low Vol",
    filters: [
      { field: "sharpe_ratio", op: ">", value: 0.5, label: "Sharpe > 0.5" },
      { field: "ann_volatility", op: "<", value: 0.10, label: "Vol < 10%" },
    ],
  },
  {
    label: "Robust (Shallow DD)",
    filters: [
      { field: "sharpe_ratio", op: ">", value: 0.2, label: "Sharpe > 0.2" },
      { field: "max_drawdown", op: ">", value: -0.40, label: "Max DD > -40%" },
      { field: "pct_positive", op: ">", value: 0.55, label: "> 55% positive" },
    ],
  },
  {
    label: "Statistically Significant",
    filters: [
      { field: "t_stat", op: ">", value: 3, label: "t-stat > 3" },
      { field: "n_months", op: ">=", value: 240, label: "20+ years" },
    ],
  },
];

const FILTER_FIELDS: { key: keyof FactorStats; label: string; pct?: boolean }[] = [
  { key: "sharpe_ratio", label: "Sharpe Ratio" },
  { key: "ann_return", label: "Ann. Return", pct: true },
  { key: "ann_volatility", label: "Ann. Volatility", pct: true },
  { key: "t_stat", label: "t-Statistic" },
  { key: "max_drawdown", label: "Max Drawdown", pct: true },
  { key: "pct_positive", label: "% Positive Mo.", pct: true },
  { key: "n_months", label: "Months of Data" },
  { key: "skewness", label: "Skewness" },
  { key: "kurtosis", label: "Excess Kurtosis" },
];

export default function FactorScreener() {
  const { data: stats, loading: l1 } = useData(useCallback(() => loadFactorStats(), []));
  const { data: docs, loading: l2 } = useData(useCallback(() => loadSignalDoc(), []));
  const [filters, setFilters] = useState<Filter[]>(PRESET_SCREENS[0].filters);
  const [sortKey, setSortKey] = useState<keyof FactorStats>("sharpe_ratio");
  const [sortDesc, setSortDesc] = useState(true);

  const docLookup = useMemo(() => {
    const m: Record<string, SignalDoc> = {};
    if (docs) for (const d of docs) if (d.Acronym) m[d.Acronym] = d;
    return m;
  }, [docs]);

  const filtered = useMemo(() => {
    if (!stats) return [];
    return Object.values(stats)
      .filter((f) => {
        for (const flt of filters) {
          const v = f[flt.field];
          if (typeof v !== "number") continue;
          if (flt.op === ">" && !(v > flt.value)) return false;
          if (flt.op === "<" && !(v < flt.value)) return false;
          if (flt.op === ">=" && !(v >= flt.value)) return false;
          if (flt.op === "<=" && !(v <= flt.value)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        if (typeof va === "number" && typeof vb === "number")
          return sortDesc ? vb - va : va - vb;
        return 0;
      });
  }, [stats, filters, sortKey, sortDesc]);

  if (l1 || l2) return <LoadingSpinner />;
  if (!stats) return <div className="text-red-400">No data</div>;

  function addFilter() {
    setFilters([...filters, { field: "sharpe_ratio", op: ">", value: 0, label: "" }]);
  }

  function removeFilter(i: number) {
    setFilters(filters.filter((_, idx) => idx !== i));
  }

  function updateFilter(i: number, patch: Partial<Filter>) {
    setFilters(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function handleSort(key: keyof FactorStats) {
    if (key === sortKey) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#94a3b8]">
        Filter factors by multiple criteria. {filtered.length} of {Object.keys(stats).length} factors match.
      </p>

      {/* Preset screens */}
      <div className="flex flex-wrap gap-2">
        {PRESET_SCREENS.map((p) => (
          <button
            key={p.label}
            onClick={() => setFilters(p.filters)}
            className="px-3 py-1.5 rounded-lg text-xs border border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#475569]"
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setFilters([])}
          className="px-3 py-1.5 rounded-lg text-xs border border-[#334155] text-[#64748b] hover:text-white"
        >
          Clear All
        </button>
      </div>

      {/* Active filters */}
      <div className="bg-[#1e293b] rounded-lg p-3 border border-[#334155] space-y-2">
        {filters.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={f.field}
              onChange={(e) => updateFilter(i, { field: e.target.value as keyof FactorStats })}
              className="px-2 py-1 bg-[#0f172a] border border-[#334155] rounded text-xs text-[#f1f5f9]"
            >
              {FILTER_FIELDS.map((ff) => (
                <option key={ff.key} value={ff.key}>{ff.label}</option>
              ))}
            </select>
            <select
              value={f.op}
              onChange={(e) => updateFilter(i, { op: e.target.value as Filter["op"] })}
              className="px-2 py-1 bg-[#0f172a] border border-[#334155] rounded text-xs text-[#f1f5f9] w-16"
            >
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&ge;</option>
              <option value="<=">&le;</option>
            </select>
            <input
              type="number"
              step="any"
              value={f.value}
              onChange={(e) => updateFilter(i, { value: parseFloat(e.target.value) || 0 })}
              className="px-2 py-1 bg-[#0f172a] border border-[#334155] rounded text-xs text-[#f1f5f9] w-24"
            />
            <button onClick={() => removeFilter(i)} className="text-[#ef4444] text-xs hover:text-red-300">&times;</button>
          </div>
        ))}
        <button onClick={addFilter} className="text-xs text-[#3b82f6] hover:underline">+ Add filter</button>
      </div>

      {/* Results table */}
      <div className="overflow-x-auto rounded-lg border border-[#334155]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1e293b]">
              {[
                { key: "name" as keyof FactorStats, label: "Factor" },
                { key: "sharpe_ratio" as keyof FactorStats, label: "Sharpe" },
                { key: "ann_return" as keyof FactorStats, label: "Ann. Ret" },
                { key: "ann_volatility" as keyof FactorStats, label: "Vol" },
                { key: "t_stat" as keyof FactorStats, label: "t-Stat" },
                { key: "max_drawdown" as keyof FactorStats, label: "Max DD" },
                { key: "pct_positive" as keyof FactorStats, label: "% Pos" },
                { key: "n_months" as keyof FactorStats, label: "Months" },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 text-left text-xs text-[#94a3b8] cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {col.label}
                  {sortKey === col.key && (sortDesc ? " \u25BC" : " \u25B2")}
                </th>
              ))}
              <th className="px-3 py-2 text-left text-xs text-[#94a3b8]">Category</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.name} className="border-t border-[#334155] hover:bg-[#1e293b]">
                <td className="px-3 py-1.5"><FactorName name={f.name} /></td>
                <td className="px-3 py-1.5">
                  <span className={f.sharpe_ratio > 0 ? "text-[#10b981]" : "text-[#ef4444]"}>
                    {f.sharpe_ratio.toFixed(3)}
                  </span>
                </td>
                <td className="px-3 py-1.5">{(f.ann_return * 100).toFixed(2)}%</td>
                <td className="px-3 py-1.5">{(f.ann_volatility * 100).toFixed(2)}%</td>
                <td className="px-3 py-1.5">
                  <span className={Math.abs(f.t_stat) > 1.96 ? "text-[#f59e0b]" : ""}>{f.t_stat.toFixed(2)}</span>
                </td>
                <td className="px-3 py-1.5 text-[#ef4444]">{(f.max_drawdown * 100).toFixed(1)}%</td>
                <td className="px-3 py-1.5">{(f.pct_positive * 100).toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-[#94a3b8]">{f.n_months}</td>
                <td className="px-3 py-1.5 text-xs text-[#64748b]">
                  {docLookup[f.name]?.["Cat.Economic"] || ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
