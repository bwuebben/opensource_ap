import { useEffect, useRef } from "react";
import type { SignalDoc, FactorStats } from "../types";

interface Props {
  signal: SignalDoc | null;
  stats: FactorStats | null;
  onClose: () => void;
}

const QUALITY_LABELS: Record<string, string> = {
  "1_good": "Good",
  "2_fair": "Fair",
  "3_poor": "Poor",
  "4_lack_data": "Lacking Data",
};
const QUALITY_COLORS: Record<string, string> = {
  "1_good": "#10b981",
  "2_fair": "#f59e0b",
  "3_poor": "#ef4444",
  "4_lack_data": "#64748b",
};

const PRED_LABELS: Record<string, string> = {
  "1_clear": "Clear",
  "2_likely": "Likely",
  "3_maybe": "Maybe",
  "4_not": "Not Predictive",
  "5_NA": "N/A",
  indirect: "Indirect",
};
const PRED_COLORS: Record<string, string> = {
  "1_clear": "#10b981",
  "2_likely": "#3b82f6",
  "3_maybe": "#f59e0b",
  "4_not": "#ef4444",
  "5_NA": "#64748b",
  indirect: "#94a3b8",
};

const SIGNAL_DESCRIPTIONS: Record<string, string> = {
  Predictor:
    "The original paper claimed this signal predicts stock returns.",
  Placebo:
    "A control signal NOT predicted to work by the original authors. Used to test if the effect is robust to alternative constructions.",
  "Predictor HXZ":
    "A variant from Hou, Xue & Zhang (2015) that the authors proposed as a predictor.",
  "Predictor AQR":
    "A variant from AQR Capital Management research proposed as a predictor.",
};

export default function FactorInfoModal({ signal, stats, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!signal) return null;

  const signalType = signal["Cat.Signal"] || "Unknown";

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
    >
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1e293b] border-b border-[#334155] px-5 py-4 flex items-start justify-between rounded-t-xl">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl text-[#3b82f6] font-bold">
                {signal.Acronym}
              </span>
              <span className="text-lg text-[#f1f5f9]">
                {signal.LongDescription || ""}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-[#64748b]">
              {signal.Authors && (
                <span>
                  {signal.Authors}
                  {signal.Year ? ` (${signal.Year})` : ""}
                  {signal.Journal ? `, ${signal.Journal}` : ""}
                </span>
              )}
              {signal.GScholarCites202509 && (
                <span className="ml-2">
                  {Math.round(Number(signal.GScholarCites202509)).toLocaleString()} citations
                </span>
              )}
              {signal.Authors && (
                <div className="mt-1 flex gap-2">
                  <a
                    href={`https://scholar.google.com/scholar?q=${encodeURIComponent(
                      `${signal.Authors} ${signal.Year || ""} ${signal.LongDescription || ""}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#3b82f6] hover:underline"
                  >
                    Google Scholar
                  </a>
                  <a
                    href={`https://papers.ssrn.com/sol3/results.cfm?txtKey_Words=${encodeURIComponent(
                      `${signal.Authors?.split(",")[0] || ""} ${signal.LongDescription || ""}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#3b82f6] hover:underline"
                  >
                    SSRN
                  </a>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748b] hover:text-white text-xl leading-none px-2 py-1"
          >
            &times;
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Signal type explanation */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0f172a]">
            <SignalTypeBadge type={signalType} />
            <div className="text-xs text-[#94a3b8] leading-relaxed">
              {SIGNAL_DESCRIPTIONS[signalType] || `Signal type: ${signalType}`}
              {signal["Evidence Summary"] && (
                <span className="ml-1 text-[#cbd5e1]">
                  Evidence: {signal["Evidence Summary"]}
                </span>
              )}
            </div>
          </div>

          {/* Definition */}
          <Section title="Definition">
            <p className="text-sm text-[#cbd5e1] leading-relaxed">
              {signal["Detailed Definition"] ||
                signal.LongDescription ||
                "No detailed definition available."}
            </p>
          </Section>

          {/* Notes */}
          {signal.Notes && (
            <Section title="Notes">
              <p className="text-sm text-[#94a3b8] leading-relaxed">{signal.Notes}</p>
            </Section>
          )}

          {/* Two-column: classification + performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="Classification">
              <InfoRow label="Economic Category" value={signal["Cat.Economic"]} />
              <InfoRow label="Data Source" value={signal["Cat.Data"]} />
              <InfoRow label="Signal Form" value={signal["Cat.Form"]} />
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
              <InfoRow
                label="Sign Convention"
                value={
                  signal.Sign != null
                    ? Number(signal.Sign) > 0
                      ? "Long high, Short low"
                      : "Long low, Short high"
                    : null
                }
              />
            </Section>

            <Section title="Original Paper">
              <InfoRow
                label="Sample Period"
                value={
                  signal.SampleStartYear && signal.SampleEndYear
                    ? `${signal.SampleStartYear} – ${signal.SampleEndYear}`
                    : null
                }
              />
              <InfoRow label="Original t-Stat" value={signal["T-Stat"]} />
              <InfoRow
                label="Original Return"
                value={signal.Return != null ? `${signal.Return}%/mo` : null}
              />
              <InfoRow label="Stock Weight" value={signal["Stock Weight"]} />
              <InfoRow label="L/S Quantile" value={signal["LS Quantile"]} />
              <InfoRow
                label="Portfolio Period"
                value={
                  signal["Portfolio Period"] != null
                    ? `${signal["Portfolio Period"]} month(s)`
                    : null
                }
              />
              <InfoRow label="Filter" value={signal.Filter} />
              <InfoRow label="Key Table" value={signal["Key Table in OP"]} />
              <InfoRow label="Test Type" value={signal["Test in OP"]} />
            </Section>
          </div>

          {/* Replicated performance */}
          {stats && (
            <Section title="Replicated Performance (Full Sample)">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatBox
                  label="Sharpe Ratio"
                  value={stats.sharpe_ratio.toFixed(3)}
                  color={stats.sharpe_ratio > 0 ? "#10b981" : "#ef4444"}
                />
                <StatBox
                  label="Ann. Return"
                  value={`${(stats.ann_return * 100).toFixed(2)}%`}
                  color={stats.ann_return > 0 ? "#10b981" : "#ef4444"}
                />
                <StatBox
                  label="Ann. Volatility"
                  value={`${(stats.ann_volatility * 100).toFixed(2)}%`}
                />
                <StatBox label="t-Statistic" value={stats.t_stat.toFixed(2)} />
                <StatBox
                  label="Max Drawdown"
                  value={`${(stats.max_drawdown * 100).toFixed(1)}%`}
                  color="#ef4444"
                />
                <StatBox
                  label="% Positive Mo."
                  value={`${(stats.pct_positive * 100).toFixed(1)}%`}
                />
                <StatBox
                  label="Best Month"
                  value={`${(stats.best_month * 100).toFixed(2)}%`}
                  color="#10b981"
                />
                <StatBox
                  label="Worst Month"
                  value={`${(stats.worst_month * 100).toFixed(2)}%`}
                  color="#ef4444"
                />
                <StatBox label="Months" value={stats.n_months.toString()} />
                <StatBox label="Period" value={`${stats.start_date} to ${stats.end_date}`} />
                <StatBox label="Skewness" value={stats.skewness.toFixed(2)} />
                <StatBox label="Kurtosis" value={stats.kurtosis.toFixed(2)} />
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
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

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-[#0f172a] rounded px-2 py-1.5">
      <div className="text-[10px] text-[#64748b]">{label}</div>
      <div className="text-sm font-mono" style={{ color: color || "#f1f5f9" }}>
        {value}
      </div>
    </div>
  );
}

export function SignalTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Predictor: "#3b82f6",
    Placebo: "#94a3b8",
    "Predictor HXZ": "#8b5cf6",
    "Predictor AQR": "#06b6d4",
  };
  const c = colors[type] || "#94a3b8";
  return (
    <span
      className="px-2 py-0.5 rounded text-[11px] font-medium flex-shrink-0"
      style={{ color: c, backgroundColor: c + "20" }}
    >
      {type}
    </span>
  );
}
