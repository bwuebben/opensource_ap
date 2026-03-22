import { useState, useCallback, useMemo, Fragment } from "react";
import { useData } from "../hooks";
import { loadFactorStats, loadSignalDoc } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";
import type { FactorStats, SortDirection } from "../types";

type SortKey = keyof FactorStats;

export default function FactorBrowser() {
  const { data: stats, loading: l1 } = useData(useCallback(() => loadFactorStats(), []));
  const { data: signalDoc, loading: l2 } = useData(useCallback(() => loadSignalDoc(), []));
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sharpe_ratio");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [category, setCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const signalLookup = useMemo(() => {
    const m: Record<string, (typeof signalDoc extends (infer T)[] ? T : never)> = {};
    if (signalDoc) {
      for (const s of signalDoc) {
        if (s.Acronym) m[s.Acronym] = s;
      }
    }
    return m;
  }, [signalDoc]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    if (signalDoc) {
      for (const s of signalDoc) {
        if (s["Cat.Economic"]) cats.add(s["Cat.Economic"]);
      }
    }
    return ["all", ...Array.from(cats).sort()];
  }, [signalDoc]);

  const factors = useMemo(() => {
    if (!stats) return [];
    let list = Object.values(stats);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => {
        const doc = signalLookup[f.name];
        return (
          f.name.toLowerCase().includes(q) ||
          doc?.LongDescription?.toLowerCase().includes(q) ||
          doc?.Authors?.toLowerCase().includes(q)
        );
      });
    }

    if (category !== "all") {
      list = list.filter((f) => {
        const doc = signalLookup[f.name];
        return doc?.["Cat.Economic"] === category;
      });
    }

    list.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });

    return list;
  }, [stats, search, sortKey, sortDir, category, signalLookup]);

  if (l1 || l2) return <LoadingSpinner />;
  if (!stats) return <div className="text-red-400">No data available</div>;

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " \u25B2" : " \u25BC") : "";

  const columns: { key: SortKey; label: string; fmt: (v: number) => string }[] = [
    { key: "name", label: "Factor", fmt: () => "" },
    { key: "sharpe_ratio", label: "Sharpe", fmt: (v) => v.toFixed(3) },
    { key: "ann_return", label: "Ann. Return", fmt: (v) => (v * 100).toFixed(2) + "%" },
    { key: "ann_volatility", label: "Ann. Vol", fmt: (v) => (v * 100).toFixed(2) + "%" },
    { key: "t_stat", label: "t-Stat", fmt: (v) => v.toFixed(2) },
    { key: "max_drawdown", label: "Max DD", fmt: (v) => (v * 100).toFixed(1) + "%" },
    { key: "pct_positive", label: "% Pos", fmt: (v) => (v * 100).toFixed(1) + "%" },
    { key: "n_months", label: "Months", fmt: (v) => v.toString() },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#94a3b8]">
        Sortable, filterable table of all 212 factors with key statistics. Click column headers to sort by Sharpe ratio, t-stat, volatility, or any other metric. Expand any row for a quick cumulative return chart. This is the fastest way to scan the full factor universe and find what you're looking for.
      </p>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search factors, authors, descriptions..."
          className="flex-1 min-w-[250px] px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9] focus:outline-none focus:border-[#3b82f6]"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All Categories" : c}
            </option>
          ))}
        </select>
        <span className="text-xs text-[#64748b]">{factors.length} factors</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#334155]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1e293b]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 text-left text-xs font-medium text-[#94a3b8] cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {col.label}
                  {sortIcon(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => {
              const doc = signalLookup[f.name];
              const isExpanded = expanded === f.name;
              return (
                <Fragment key={f.name}>
                  <tr
                    onClick={() => setExpanded(isExpanded ? null : f.name)}
                    className="border-t border-[#334155] hover:bg-[#1e293b] cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2"><FactorName name={f.name} /></td>
                    <td className="px-3 py-2">
                      <span className={f.sharpe_ratio > 0 ? "text-[#10b981]" : "text-[#ef4444]"}>
                        {f.sharpe_ratio.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={f.ann_return > 0 ? "text-[#10b981]" : "text-[#ef4444]"}>
                        {(f.ann_return * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-3 py-2">{(f.ann_volatility * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2">
                      <span className={Math.abs(f.t_stat) > 1.96 ? "text-[#f59e0b]" : ""}>
                        {f.t_stat.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#ef4444]">{(f.max_drawdown * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2">{(f.pct_positive * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-[#94a3b8]">{f.n_months}</td>
                  </tr>
                  {isExpanded && doc && (
                    <tr className="bg-[#1e293b]/50">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-[#64748b]">Authors:</span>{" "}
                            <span className="text-[#cbd5e1]">{doc.Authors || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[#64748b]">Year:</span>{" "}
                            <span className="text-[#cbd5e1]">{doc.Year || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[#64748b]">Journal:</span>{" "}
                            <span className="text-[#cbd5e1]">{doc.Journal || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[#64748b]">Category:</span>{" "}
                            <span className="text-[#cbd5e1]">{doc["Cat.Economic"] || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[#64748b]">Data Type:</span>{" "}
                            <span className="text-[#cbd5e1]">{doc["Cat.Data"] || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[#64748b]">Quality:</span>{" "}
                            <span className="text-[#cbd5e1]">{doc["Signal Rep Quality"] || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[#64748b]">Sample:</span>{" "}
                            <span className="text-[#cbd5e1]">
                              {doc.SampleStartYear}–{doc.SampleEndYear}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#64748b]">Predictability:</span>{" "}
                            <span className="text-[#cbd5e1]">{doc["Predictability in OP"] || "N/A"}</span>
                          </div>
                        </div>
                        {doc.LongDescription && (
                          <p className="mt-2 text-xs text-[#94a3b8] leading-relaxed">
                            {doc.LongDescription}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
