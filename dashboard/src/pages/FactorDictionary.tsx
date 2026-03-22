import { useState, useCallback, useMemo } from "react";
import { useData } from "../hooks";
import { loadSignalDoc, loadFactorStats } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import FactorName from "../components/FactorName";
import { SignalTypeBadge } from "../components/FactorInfoModal";
import type { SignalDoc } from "../types";

export default function FactorDictionary() {
  const { data: signalDoc, loading: l1 } = useData(useCallback(() => loadSignalDoc(), []));
  const { data: stats, loading: l2 } = useData(useCallback(() => loadFactorStats(), []));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [dataType, setDataType] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (!signalDoc) return ["all"];
    const cats = new Set<string>();
    for (const s of signalDoc) {
      if (s["Cat.Economic"]) cats.add(s["Cat.Economic"]);
    }
    return ["all", ...Array.from(cats).sort()];
  }, [signalDoc]);

  const dataTypes = useMemo(() => {
    if (!signalDoc) return ["all"];
    const types = new Set<string>();
    for (const s of signalDoc) {
      if (s["Cat.Data"]) types.add(s["Cat.Data"]);
    }
    return ["all", ...Array.from(types).sort()];
  }, [signalDoc]);

  const filtered = useMemo(() => {
    if (!signalDoc) return [];
    let list = [...signalDoc];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.Acronym?.toLowerCase().includes(q) ||
          s.LongDescription?.toLowerCase().includes(q) ||
          s.Authors?.toLowerCase().includes(q) ||
          s["Detailed Definition"]?.toLowerCase().includes(q) ||
          s["Evidence Summary"]?.toLowerCase().includes(q)
      );
    }

    if (category !== "all") {
      list = list.filter((s) => s["Cat.Economic"] === category);
    }

    if (dataType !== "all") {
      list = list.filter((s) => s["Cat.Data"] === dataType);
    }

    list.sort((a, b) => (a.Acronym || "").localeCompare(b.Acronym || ""));
    return list;
  }, [signalDoc, search, category, dataType]);

  if (l1 || l2) return <LoadingSpinner />;
  if (!signalDoc) return <div className="text-red-400">No documentation available</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#94a3b8]">
        Complete reference for all {signalDoc.length} signals from Chen &amp; Zimmermann (2022).
        Click any factor name for the full info card.
      </p>

      {/* Signal type legend */}
      <div className="bg-[#1e293b] rounded-lg border border-[#334155] p-4">
        <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">
          Signal Type Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex gap-2">
            <SignalTypeBadge type="Predictor" />
            <span className="text-[#94a3b8]">
              The original paper claimed this signal predicts stock returns.
            </span>
          </div>
          <div className="flex gap-2">
            <SignalTypeBadge type="Placebo" />
            <span className="text-[#94a3b8]">
              A control signal <span className="text-[#cbd5e1]">not</span> predicted to work by the original authors.
              Included to test if the effect is robust to alternative constructions
              (like a placebo in a medical trial).
            </span>
          </div>
          <div className="flex gap-2">
            <SignalTypeBadge type="Predictor HXZ" />
            <span className="text-[#94a3b8]">
              A variant from Hou, Xue &amp; Zhang (2015) proposed as a predictor.
            </span>
          </div>
          <div className="flex gap-2">
            <SignalTypeBadge type="Predictor AQR" />
            <span className="text-[#94a3b8]">
              A variant from AQR Capital Management research proposed as a predictor.
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, description, author, definition..."
          className="flex-1 min-w-[250px] px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9] focus:outline-none focus:border-[#3b82f6]"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All Economic Categories" : c}
            </option>
          ))}
        </select>
        <select
          value={dataType}
          onChange={(e) => setDataType(e.target.value)}
          className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-md text-sm text-[#f1f5f9] focus:outline-none focus:border-[#3b82f6]"
        >
          {dataTypes.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All Data Types" : t}
            </option>
          ))}
        </select>
        <span className="text-xs text-[#64748b]">{filtered.length} signals</span>
      </div>

      {/* Factor cards - definition always visible */}
      <div className="space-y-2">
        {filtered.map((signal) => (
          <FactorCard
            key={signal.Acronym}
            signal={signal}
            stats={stats?.[signal.Acronym || ""] ?? null}
            expanded={expanded === signal.Acronym}
            onToggle={() =>
              setExpanded(expanded === signal.Acronym ? null : signal.Acronym)
            }
          />
        ))}
      </div>
    </div>
  );
}

const QUALITY_COLORS: Record<string, string> = {
  "1_good": "#10b981",
  "2_fair": "#f59e0b",
  "3_poor": "#ef4444",
  "4_lack_data": "#64748b",
};

const QUALITY_LABELS: Record<string, string> = {
  "1_good": "Good",
  "2_fair": "Fair",
  "3_poor": "Poor",
  "4_lack_data": "Lacking Data",
};

const PRED_COLORS: Record<string, string> = {
  "1_clear": "#10b981",
  "2_likely": "#3b82f6",
  "3_maybe": "#f59e0b",
  "4_not": "#ef4444",
  "5_NA": "#64748b",
};

const PRED_LABELS: Record<string, string> = {
  "1_clear": "Clear",
  "2_likely": "Likely",
  "3_maybe": "Maybe",
  "4_not": "Not Predictive",
  "5_NA": "N/A",
  "indirect": "Indirect",
};

const SIGNAL_TYPE_COLORS: Record<string, string> = {
  Predictor: "#3b82f6",
  Placebo: "#94a3b8",
  "Predictor HXZ": "#8b5cf6",
  "Predictor AQR": "#06b6d4",
};

function FactorCard({
  signal,
  stats,
  expanded,
  onToggle,
}: {
  signal: SignalDoc;
  stats: {
    sharpe_ratio: number;
    ann_return: number;
    ann_volatility: number;
    t_stat: number;
    n_months: number;
    max_drawdown: number;
    pct_positive: number;
  } | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const signalType = signal["Cat.Signal"] || "";

  return (
    <div
      className={`bg-[#1e293b] rounded-lg border transition-colors ${
        expanded ? "border-[#3b82f6]" : "border-[#334155] hover:border-[#475569]"
      }`}
    >
      {/* Main content - always visible */}
      <div className="px-4 py-3">
        {/* Top row: acronym + name + badges + stats */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {/* Acronym and full name on one line */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <FactorName
                name={signal.Acronym || ""}
                className="font-mono text-base text-[#3b82f6] font-bold hover:underline decoration-dotted underline-offset-2 cursor-pointer whitespace-nowrap"
              />
              <span className="text-sm text-[#f1f5f9]">
                {signal.LongDescription || "No description"}
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
                style={{
                  color: SIGNAL_TYPE_COLORS[signalType] || "#94a3b8",
                  backgroundColor: (SIGNAL_TYPE_COLORS[signalType] || "#94a3b8") + "20",
                }}
              >
                {signalType || "Unknown"}
              </span>
              {signal["Evidence Summary"] && (
                <span className="px-1.5 py-0.5 rounded bg-[#334155] text-[10px] text-[#94a3b8] whitespace-nowrap">
                  {signal["Evidence Summary"]}
                </span>
              )}
            </div>

            {/* Definition */}
            <p className="text-xs text-[#94a3b8] mt-1.5 leading-relaxed">
              {signal["Detailed Definition"] || signal.LongDescription || "No definition available"}
            </p>

            {/* Author line */}
            <div className="mt-1 text-[11px] text-[#64748b]">
              {signal.Authors && (
                <span>
                  {signal.Authors}
                  {signal.Year ? ` (${signal.Year})` : ""}
                  {signal.Journal ? `, ${signal.Journal}` : ""}
                </span>
              )}
              {signal.GScholarCites202509 && (
                <span className="ml-3">
                  {Math.round(Number(signal.GScholarCites202509)).toLocaleString()} citations
                </span>
              )}
            </div>
          </div>

          {/* Right: tags + stats + expand */}
          <div className="flex-shrink-0 flex items-center gap-3 text-xs">
            {signal["Cat.Economic"] && (
              <span className="px-2 py-0.5 rounded bg-[#334155] text-[#94a3b8] whitespace-nowrap">
                {signal["Cat.Economic"]}
              </span>
            )}
            {signal["Cat.Data"] && (
              <span className="px-2 py-0.5 rounded bg-[#334155] text-[#94a3b8] whitespace-nowrap">
                {signal["Cat.Data"]}
              </span>
            )}
            {stats && (
              <div className="text-right font-mono">
                <div className={stats.sharpe_ratio > 0 ? "text-[#10b981]" : "text-[#ef4444]"}>
                  SR {stats.sharpe_ratio.toFixed(2)}
                </div>
                <div className="text-[#64748b]">
                  t={stats.t_stat.toFixed(1)}
                </div>
              </div>
            )}
            <button
              onClick={onToggle}
              className="text-[#475569] hover:text-[#94a3b8] transition-colors px-1"
            >
              {expanded ? "\u25B2" : "\u25BC"}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded: full details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#334155] mt-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            {/* Column 1: Quality & Classification */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider">
                Quality & Classification
              </h4>
              <InfoRow
                label="Replication Quality"
                value={QUALITY_LABELS[signal["Signal Rep Quality"] || ""] || signal["Signal Rep Quality"]}
                valueColor={QUALITY_COLORS[signal["Signal Rep Quality"] || ""]}
              />
              <InfoRow
                label="Predictability"
                value={PRED_LABELS[signal["Predictability in OP"] || ""] || signal["Predictability in OP"]}
                valueColor={PRED_COLORS[signal["Predictability in OP"] || ""]}
              />
              <InfoRow label="Signal Type" value={signal["Cat.Signal"]} />
              <InfoRow label="Signal Form" value={signal["Cat.Form"]} />
              <InfoRow label="Sign Convention" value={signal.Sign != null ? (Number(signal.Sign) > 0 ? "Long high, Short low" : "Long low, Short high") : null} />
            </div>

            {/* Column 2: Original Paper */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider">
                Original Paper
              </h4>
              <InfoRow label="Sample Period" value={
                signal.SampleStartYear && signal.SampleEndYear
                  ? `${signal.SampleStartYear} – ${signal.SampleEndYear}`
                  : null
              } />
              <InfoRow label="Original t-Stat" value={signal["T-Stat"]} />
              <InfoRow label="Original Return" value={signal.Return != null ? `${signal.Return}%/mo` : null} />
              <InfoRow label="Stock Weight" value={signal["Stock Weight"]} />
              <InfoRow label="L/S Quantile" value={signal["LS Quantile"]} />
              <InfoRow label="Portfolio Period" value={signal["Portfolio Period"] != null ? `${signal["Portfolio Period"]} month(s)` : null} />
              <InfoRow label="Start Month" value={signal["Start Month"] != null ? `Month ${signal["Start Month"]}` : null} />
              <InfoRow label="Filter" value={signal.Filter} />
              <InfoRow label="Key Table" value={signal["Key Table in OP"]} />
              <InfoRow label="Test Type" value={signal["Test in OP"]} />
            </div>

            {/* Column 3: Replicated Performance */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider">
                Replicated Performance (Full Sample)
              </h4>
              {stats ? (
                <>
                  <InfoRow
                    label="Sharpe Ratio"
                    value={stats.sharpe_ratio.toFixed(3)}
                    valueColor={stats.sharpe_ratio > 0 ? "#10b981" : "#ef4444"}
                  />
                  <InfoRow
                    label="Annualized Return"
                    value={`${(stats.ann_return * 100).toFixed(2)}%`}
                    valueColor={stats.ann_return > 0 ? "#10b981" : "#ef4444"}
                  />
                  <InfoRow label="Annualized Vol" value={`${(stats.ann_volatility * 100).toFixed(2)}%`} />
                  <InfoRow label="t-Statistic" value={stats.t_stat.toFixed(2)} />
                  <InfoRow label="Max Drawdown" value={`${(stats.max_drawdown * 100).toFixed(1)}%`} valueColor="#ef4444" />
                  <InfoRow label="% Positive Months" value={`${(stats.pct_positive * 100).toFixed(1)}%`} />
                  <InfoRow label="Months of Data" value={stats.n_months.toString()} />
                </>
              ) : (
                <p className="text-xs text-[#64748b] italic">
                  No portfolio returns available for this signal
                </p>
              )}
            </div>
          </div>

          {/* Notes - full width */}
          {signal.Notes && (
            <div className="mt-3 pt-3 border-t border-[#334155]/50">
              <h4 className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider mb-1">
                Notes
              </h4>
              <p className="text-xs text-[#94a3b8] leading-relaxed">{signal.Notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string | number | null | undefined;
  valueColor?: string;
}) {
  if (value == null) return null;
  return (
    <div className="flex text-xs">
      <span className="text-[#64748b] w-32 flex-shrink-0">{label}:</span>
      <span className="text-[#cbd5e1]" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  );
}
