import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import LoadingSpinner from "../components/LoadingSpinner";
import Methodology, { MNote } from "../components/Methodology";

interface MacroSeries {
  dates: string[];
  values: (number | null)[];
  description: string;
}

interface MacroMeta {
  description: string;
  source: string;
  transform: string;
  category: string;
}

async function loadMacro(): Promise<Record<string, MacroSeries>> {
  const r = await fetch("/data/macro_series.json");
  if (!r.ok) throw new Error("No macro data");
  return r.json();
}

async function loadMacroMeta(): Promise<Record<string, MacroMeta>> {
  const r = await fetch("/data/macro_metadata.json");
  if (!r.ok) throw new Error("No macro metadata");
  return r.json();
}

async function loadRecessions(): Promise<{ periods: { start: string; end: string }[] }> {
  const r = await fetch("/data/nber_recessions.json");
  if (!r.ok) return { periods: [] };
  return r.json();
}

export default function MacroDashboard() {
  const { data: series, loading: l1 } = useData(useCallback(() => loadMacro(), []));
  const { data: meta, loading: l2 } = useData(useCallback(() => loadMacroMeta(), []));
  const { data: recessions } = useData(useCallback(() => loadRecessions(), []));
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(["INDPRO", "UNRATE", "CPIAUCSL", "TB3MS"]);
  const [category, setCategory] = useState("all");

  const categories = useMemo(() => {
    if (!meta) return ["all"];
    const cats = new Set(Object.values(meta).map((m) => m.category).filter(Boolean));
    return ["all", ...Array.from(cats).sort()];
  }, [meta]);

  const allSeries = useMemo(() => {
    if (!series) return [];
    let list = Object.keys(series).sort();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.toLowerCase().includes(q) || meta?.[s]?.description?.toLowerCase().includes(q));
    }
    if (category !== "all") {
      list = list.filter((s) => meta?.[s]?.category === category);
    }
    return list;
  }, [series, meta, search, category]);

  if (l1 || l2) return <LoadingSpinner />;
  if (!series) return <div className="text-red-400">No macro data. Run download_macro.py.</div>;

  const validSelected = selected.filter((s) => series[s]);

  // Recession shapes for charts
  const recessionShapes = (recessions?.periods || []).map((p) => ({
    type: "rect" as const,
    xref: "x" as const, yref: "paper" as const,
    x0: p.start, x1: p.end, y0: 0, y1: 1,
    fillcolor: "rgba(239,68,68,0.18)", line: { width: 0 },
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#94a3b8]">
        Time-series charts for {Object.keys(series).length} macroeconomic indicators from FRED-MD (McCracken &amp; Ng) plus supplemental FRED series. Select series from the checkbox grid below to display their charts. Shaded areas indicate NBER recession periods. Use the search box to find specific indicators by name or ticker.
      </p>

      <div className="flex flex-wrap gap-3 items-center">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search series..."
          className="flex-1 min-w-[200px] px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6]" />
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9]">
          {categories.map((c) => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
        </select>
      </div>

      {/* Series selector */}
      <div className="bg-[#1e293b] rounded-lg border border-[#334155] p-3 max-h-48 overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          {allSeries.slice(0, 200).map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-white text-[#94a3b8]">
              <input type="checkbox" checked={selected.includes(s)}
                onChange={() => setSelected((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                className="accent-[#3b82f6]" />
              <span className="truncate" title={meta?.[s]?.description || s}>{s}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Charts for selected series */}
      {validSelected.map((s) => {
        const ts = series[s];
        const m = meta?.[s];
        return (
          <div key={s} className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
            <div className="flex justify-between items-baseline mb-2">
              <h3 className="text-sm font-semibold text-[#f1f5f9]">{s}</h3>
              <span className="text-xs text-[#64748b]">{m?.description || ""}</span>
            </div>
            <Plot
              data={[{
                x: ts.dates,
                y: ts.values,
                type: "scatter", mode: "lines",
                line: { color: "#3b82f6", width: 1.5 },
              }]}
              layout={{
                height: 200,
                margin: { t: 5, b: 25, l: 50, r: 10 },
                paper_bgcolor: "transparent", plot_bgcolor: "transparent",
                font: { color: "#94a3b8", size: 10 },
                xaxis: { gridcolor: "#334155", type: "date" },
                yaxis: { gridcolor: "#334155" },
                shapes: recessionShapes,
              }}
              config={{ displayModeBar: false }}
              style={{ width: "100%" }}
            />
          </div>
        );
      })}
      <Methodology>
        <MNote title="Data Source">FRED-MD dataset (McCracken & Ng 2016) plus supplemental FRED API series. All FRED-MD series have McCracken-Ng stationarity transformations applied (log-diff, second-diff, etc.) before display.</MNote>
        <MNote title="Transformations">Transform code 1 = levels, 2 = first difference, 4 = log, 5 = log first difference (≈ growth rate), 6 = log second difference (≈ acceleration). See the Macro Dictionary page for each series' transform code.</MNote>
        <MNote title="Recession Shading">NBER recession periods derived from the USREC indicator (0/1 monthly series from FRED). Shaded regions span from the recession start month to the end month.</MNote>
        <MNote title="Data">Monthly frequency. Date convention is first-of-month (e.g., 2020-01-01 = January 2020). Missing values displayed as gaps in the line chart. No interpolation or forward-filling.</MNote>
      </Methodology>
    </div>
  );
}
