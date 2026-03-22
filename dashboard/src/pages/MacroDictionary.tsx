import { useState, useCallback, useMemo } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { dataUrl } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";

interface MacroSeries {
  dates: string[];
  values: (number | null)[];
  description: string;
}

interface MacroMeta {
  description: string;
  source: string;
  transform: string;
  transform_code?: number;
  category: string;
  units?: string;
  frequency?: string;
  seasonal_adjustment?: string;
  notes?: string;
  note?: string;
}

async function loadMacro(): Promise<Record<string, MacroSeries>> {
  const r = await fetch(dataUrl("macro_series.json"));
  if (!r.ok) throw new Error("No macro data");
  return r.json();
}

async function loadMacroMeta(): Promise<Record<string, MacroMeta>> {
  const r = await fetch(dataUrl("macro_metadata.json"));
  if (!r.ok) throw new Error("No macro metadata");
  return r.json();
}

async function loadRecessions(): Promise<{ periods: { start: string; end: string }[] }> {
  const r = await fetch(dataUrl("nber_recessions.json"));
  if (!r.ok) return { periods: [] };
  return r.json();
}

const FRED_API_KEY = "13c27e7844dbed2ff65c04109264ff1e";

interface FredObservation {
  date: string;
  value: string;
}

async function fetchFredSeries(ticker: string): Promise<{ dates: string[]; values: (number | null)[]; title: string }> {
  // Fetch series info for title
  const infoUrl = `/fred-api/fred/series?series_id=${encodeURIComponent(ticker)}&api_key=${FRED_API_KEY}&file_type=json`;
  const infoResp = await fetch(infoUrl);
  if (!infoResp.ok) throw new Error(`FRED series not found: ${ticker}`);
  const infoData = await infoResp.json();
  const title = infoData.seriess?.[0]?.title || ticker;

  // Fetch observations
  const obsUrl = `/fred-api/fred/series/observations?series_id=${encodeURIComponent(ticker)}&api_key=${FRED_API_KEY}&file_type=json`;
  const obsResp = await fetch(obsUrl);
  if (!obsResp.ok) throw new Error(`Failed to fetch observations for ${ticker}`);
  const obsData = await obsResp.json();
  const observations: FredObservation[] = obsData.observations || [];

  const dates: string[] = [];
  const values: (number | null)[] = [];
  for (const obs of observations) {
    dates.push(obs.date);
    const v = parseFloat(obs.value);
    values.push(isNaN(v) ? null : v);
  }

  return { dates, values, title };
}

type SortKey = "ticker" | "description" | "source" | "category" | "transform" | "obs";
type SortDir = "asc" | "desc";

export default function MacroDictionary() {
  const { data: series, loading: l1 } = useData(useCallback(() => loadMacro(), []));
  const { data: meta, loading: l2 } = useData(useCallback(() => loadMacroMeta(), []));
  const { data: recessions } = useData(useCallback(() => loadRecessions(), []));
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Custom FRED ticker state — persist in localStorage
  const [customTicker, setCustomTicker] = useState("");
  const [customSeries, setCustomSeries] = useState<Record<string, { dates: string[]; values: (number | null)[]; title: string }>>(() => {
    try {
      const saved = localStorage.getItem("custom_fred_series");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState("");
  const [addedToPipeline, setAddedToPipeline] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    if (!meta) return ["all"];
    const cats = new Set(Object.values(meta).map((m) => m.category).filter(Boolean));
    return ["all", ...Array.from(cats).sort()];
  }, [meta]);

  const filteredSeries = useMemo(() => {
    if (!meta) return [];
    let tickers = Object.keys(meta).sort();
    if (search) {
      const q = search.toLowerCase();
      tickers = tickers.filter(
        (t) => t.toLowerCase().includes(q)
          || meta[t]?.description?.toLowerCase().includes(q)
          || meta[t]?.notes?.toLowerCase().includes(q)
          || meta[t]?.units?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") {
      tickers = tickers.filter((t) => meta[t]?.category === categoryFilter);
    }
    // Sort
    tickers.sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sortKey) {
        case "ticker": va = a; vb = b; break;
        case "description": va = meta[a]?.description || ""; vb = meta[b]?.description || ""; break;
        case "source": va = meta[a]?.source || ""; vb = meta[b]?.source || ""; break;
        case "category": va = meta[a]?.category || ""; vb = meta[b]?.category || ""; break;
        case "transform": va = meta[a]?.transform || ""; vb = meta[b]?.transform || ""; break;
        case "obs": va = series?.[a]?.dates?.length ?? 0; vb = series?.[b]?.dates?.length ?? 0; break;
      }
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return tickers;
  }, [meta, series, search, categoryFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleFetchCustom = async () => {
    const ticker = customTicker.trim().toUpperCase();
    if (!ticker) return;
    setCustomLoading(true);
    setCustomError("");
    try {
      const result = await fetchFredSeries(ticker);
      setCustomSeries((prev) => {
        const next = { ...prev, [ticker]: result };
        localStorage.setItem("custom_fred_series", JSON.stringify(next));
        return next;
      });
      setCustomTicker("");
    } catch (e) {
      setCustomError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setCustomLoading(false);
    }
  };

  const handleRemoveCustom = (ticker: string) => {
    setCustomSeries((prev) => {
      const next = { ...prev };
      delete next[ticker];
      localStorage.setItem("custom_fred_series", JSON.stringify(next));
      return next;
    });
  };

  const handleAddToPipeline = async (ticker: string) => {
    try {
      // Read the current config, add the ticker, and provide the JSON for the user
      const config: Record<string, { transform_code: number; description: string }> = {};
      config[ticker] = { transform_code: 1, description: customSeries[ticker]?.title || ticker };
      const jsonStr = JSON.stringify(config, null, 2);
      await navigator.clipboard.writeText(
        `Add to data_pipeline/custom_fred_tickers.json:\n${jsonStr}`
      );
      setAddedToPipeline((prev) => new Set(prev).add(ticker));
    } catch {
      // Fallback: just mark it
      setAddedToPipeline((prev) => new Set(prev).add(ticker));
    }
  };

  if (l1 || l2) return <LoadingSpinner />;
  if (!meta) return <div className="text-red-400">No macro metadata. Run download_macro.py.</div>;

  const recessionShapes = (recessions?.periods || []).map((p) => ({
    type: "rect" as const,
    xref: "x" as const, yref: "paper" as const,
    x0: p.start, x1: p.end, y0: 0, y1: 1,
    fillcolor: "rgba(239,68,68,0.18)", line: { width: 0 },
  }));

  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? " \u25b2" : " \u25bc") : "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#94a3b8]">
        Searchable reference for all {Object.keys(meta).length} macro series with descriptions, units, sources, and transformation codes. Click any row to see an inline chart. Use "Fetch Custom FRED Series" at the bottom to download and preview any FRED ticker live — add it to the pipeline config to make it available across all dashboard pages.
      </p>

      {/* Search & filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ticker or description..."
          className="flex-1 min-w-[200px] px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6]"
        />
        <select
          value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9]"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>
          ))}
        </select>
        <span className="text-xs text-[#64748b]">{filteredSeries.length} series</span>
      </div>

      {/* Series list */}
      <div className="bg-[#1e293b] rounded-lg border border-[#334155] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[100px_1fr_60px] md:grid-cols-[100px_1fr_100px_120px_60px] lg:grid-cols-[100px_1fr_200px_100px_120px_60px] border-b border-[#334155] bg-[#1e293b] sticky top-0 z-10">
          <div className="px-3 py-2 text-left text-xs text-[#94a3b8] cursor-pointer hover:text-white" onClick={() => handleSort("ticker")}>Ticker{sortArrow("ticker")}</div>
          <div className="px-3 py-2 text-left text-xs text-[#94a3b8] cursor-pointer hover:text-white" onClick={() => handleSort("description")}>Description{sortArrow("description")}</div>
          <div className="px-3 py-2 text-left text-xs text-[#94a3b8] cursor-pointer hover:text-white hidden lg:block" onClick={() => handleSort("source")}>Source{sortArrow("source")}</div>
          <div className="px-3 py-2 text-left text-xs text-[#94a3b8] cursor-pointer hover:text-white hidden md:block" onClick={() => handleSort("category")}>Category{sortArrow("category")}</div>
          <div className="px-3 py-2 text-left text-xs text-[#94a3b8] cursor-pointer hover:text-white hidden md:block" onClick={() => handleSort("transform")}>Transform{sortArrow("transform")}</div>
          <div className="px-3 py-2 text-right text-xs text-[#94a3b8] cursor-pointer hover:text-white" onClick={() => handleSort("obs")}>Obs{sortArrow("obs")}</div>
        </div>
        {/* Scrollable list */}
        <div className="max-h-[500px] overflow-y-auto">
          {filteredSeries.map((ticker) => {
            const m = meta[ticker];
            const s = series?.[ticker];
            const isExpanded = expanded === ticker;
            const hasData = s && s.dates.length > 0;
            return (
              <div key={ticker}>
                <div
                  className={`grid grid-cols-[100px_1fr_60px] md:grid-cols-[100px_1fr_100px_120px_60px] lg:grid-cols-[100px_1fr_200px_100px_120px_60px] cursor-pointer hover:bg-[#334155]/30 border-b border-[#334155]/30 ${isExpanded ? "bg-[#334155]/20" : ""}`}
                  onClick={() => setExpanded(isExpanded ? null : ticker)}
                >
                  <div className="px-3 py-2 font-mono text-[#3b82f6] text-xs">{ticker}</div>
                  <div className="px-3 py-2 text-[#e2e8f0] text-xs truncate" title={m?.description}>{m?.description || "-"}</div>
                  <div className="px-3 py-2 text-[#94a3b8] text-xs truncate hidden lg:block" title={m?.source}>{m?.source || "-"}</div>
                  <div className="px-3 py-2 text-[#94a3b8] text-xs hidden md:block">{m?.category || "-"}</div>
                  <div className="px-3 py-2 text-[#94a3b8] text-xs hidden md:block">{m?.transform || "-"}</div>
                  <div className="px-3 py-2 text-[#94a3b8] text-xs text-right">{hasData ? s.dates.length : "-"}</div>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 border-b border-[#334155]/50 bg-[#1a2332]">
                    {/* Metadata grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 mb-3 pt-2 text-xs">
                      {m?.units && (
                        <div><span className="text-[#64748b]">Units: </span><span className="text-[#e2e8f0]">{m.units}</span></div>
                      )}
                      {m?.frequency && (
                        <div><span className="text-[#64748b]">Frequency: </span><span className="text-[#e2e8f0]">{m.frequency}</span></div>
                      )}
                      {m?.seasonal_adjustment && (
                        <div><span className="text-[#64748b]">Adj: </span><span className="text-[#e2e8f0]">{m.seasonal_adjustment}</span></div>
                      )}
                      <div><span className="text-[#64748b]">Transform: </span><span className="text-[#e2e8f0]">{m?.transform || "-"}{m?.transform_code ? ` (code ${m.transform_code})` : ""}</span></div>
                      <div><span className="text-[#64748b]">Source: </span><span className="text-[#e2e8f0]">{m?.source || "-"}</span></div>
                      {hasData && (
                        <div><span className="text-[#64748b]">Range: </span><span className="text-[#e2e8f0]">{s.dates[0]} to {s.dates[s.dates.length - 1]}</span></div>
                      )}
                      {hasData && (
                        <div><span className="text-[#64748b]">Observations: </span><span className="text-[#e2e8f0]">{s.dates.length.toLocaleString()}</span></div>
                      )}
                    </div>
                    {m?.notes && (
                      <div className="text-xs text-[#94a3b8] mb-3 leading-relaxed bg-[#0f172a] rounded p-2 border border-[#334155]/50">{m.notes}</div>
                    )}
                    {m?.note && (
                      <div className="text-xs text-[#f59e0b] mb-2">{m.note}</div>
                    )}
                    {hasData ? (
                      <Plot
                        data={[{
                          x: s.dates,
                          y: s.values,
                          type: "scatter", mode: "lines",
                          line: { color: "#3b82f6", width: 1.5 },
                        }]}
                        layout={{
                          height: 200,
                          margin: { t: 5, b: 25, l: 50, r: 10 },
                          paper_bgcolor: "transparent", plot_bgcolor: "transparent",
                          font: { color: "#94a3b8", size: 10 },
                          xaxis: { gridcolor: "#334155", type: "date" },
                          yaxis: { gridcolor: "#334155", title: m?.units || "" },
                          shapes: recessionShapes,
                        }}
                        config={{ displayModeBar: false }}
                        style={{ width: "100%" }}
                      />
                    ) : (
                      <div className="text-xs text-[#64748b] py-4">No data available. {m?.note || "Run download_macro.py to fetch."}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom FRED ticker */}
      <div className="bg-[#1e293b] rounded-lg border border-[#334155] p-4">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Fetch Custom FRED Series</h3>
        <p className="text-xs text-[#94a3b8] mb-3">
          Enter any FRED ticker to download and preview it. Data is fetched live from the FRED API
          and cached in your browser. To make a series available across all pages (Macro Dashboard,
          Factor-Macro Regressions), click <strong>Add to Pipeline</strong> and re-run <code className="text-[#e2e8f0]">download_macro.py</code>.
        </p>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={customTicker}
            onChange={(e) => setCustomTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleFetchCustom()}
            placeholder="e.g. GDP, VIXCLS, DGS10"
            className="w-48 px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-md text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] font-mono"
          />
          <button
            onClick={handleFetchCustom}
            disabled={customLoading || !customTicker.trim()}
            className="px-4 py-2 bg-[#3b82f6] text-white text-sm rounded-md hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {customLoading ? "Fetching..." : "Fetch"}
          </button>
          {customError && <span className="text-xs text-red-400">{customError}</span>}
        </div>

        {/* Display custom fetched series */}
        {Object.entries(customSeries).map(([ticker, cs]) => (
          <div key={ticker} className="mt-4 bg-[#0f172a] rounded-lg p-3 border border-[#334155]">
            <div className="flex justify-between items-baseline mb-1">
              <h4 className="text-sm font-semibold text-[#f1f5f9] font-mono">{ticker}</h4>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#94a3b8]">{cs.title}</span>
                {addedToPipeline.has(ticker) ? (
                  <span className="text-xs text-[#10b981]">Added — re-run pipeline</span>
                ) : (
                  <button
                    onClick={() => handleAddToPipeline(ticker)}
                    className="text-xs text-[#3b82f6] hover:text-[#60a5fa]"
                  >
                    Add to Pipeline
                  </button>
                )}
                <button
                  onClick={() => handleRemoveCustom(ticker)}
                  className="text-xs text-[#64748b] hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="text-xs text-[#64748b] mb-1">
              {cs.dates.length} observations | {cs.dates[0]} to {cs.dates[cs.dates.length - 1]}
            </div>
            <Plot
              data={[{
                x: cs.dates,
                y: cs.values,
                type: "scatter", mode: "lines",
                line: { color: "#10b981", width: 1.5 },
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
        ))}
      </div>
    </div>
  );
}
