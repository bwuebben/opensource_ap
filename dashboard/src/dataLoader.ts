import type {
  FactorStats,
  TimeSeries,
  CorrelationData,
  AnnualReturns,
  SignalDoc,
  Metadata,
} from "./types";

const BASE_URL = `${import.meta.env.BASE_URL}data`;

export function dataUrl(filename: string): string {
  return `${BASE_URL}/${filename}`;
}

async function fetchJson<T>(filename: string): Promise<T> {
  const resp = await fetch(`${BASE_URL}/${filename}`);
  if (!resp.ok) throw new Error(`Failed to load ${filename}: ${resp.statusText}`);
  return resp.json();
}

export async function loadFactorStats(
  portType = "op"
): Promise<Record<string, FactorStats>> {
  return fetchJson(`factor_stats_${portType}.json`);
}

export async function loadCumulativeReturns(
  portType = "op"
): Promise<Record<string, TimeSeries>> {
  return fetchJson(`cumulative_returns_${portType}.json`);
}

export async function loadMonthlyReturns(
  portType = "op"
): Promise<Record<string, TimeSeries>> {
  return fetchJson(`monthly_returns_${portType}.json`);
}

export async function loadDrawdowns(
  portType = "op"
): Promise<Record<string, TimeSeries>> {
  return fetchJson(`drawdowns_${portType}.json`);
}

export async function loadCorrelation(
  portType = "op"
): Promise<CorrelationData> {
  return fetchJson(`correlation_${portType}.json`);
}

export async function loadAnnualReturns(
  portType = "op"
): Promise<Record<string, AnnualReturns>> {
  return fetchJson(`annual_returns_${portType}.json`);
}

export async function loadSignalDoc(): Promise<SignalDoc[]> {
  return fetchJson("signal_doc.json");
}

export async function loadMetadata(): Promise<Metadata> {
  return fetchJson("metadata.json");
}

// Style data loaders
export interface StyleStats {
  name: string;
  n_factors: number;
  n_months: number;
  ann_return: number;
  ann_volatility: number;
  sharpe_ratio: number;
  t_stat: number;
  total_return: number;
  max_drawdown: number;
  pct_positive: number;
  mean_monthly: number;
  best_month: number;
  worst_month: number;
}

export async function loadStyleReturns(): Promise<Record<string, TimeSeries>> {
  return fetchJson("style_returns.json");
}

export async function loadStyleCumulative(): Promise<Record<string, TimeSeries>> {
  return fetchJson("style_cumulative.json");
}

export async function loadStyleStats(): Promise<Record<string, StyleStats>> {
  return fetchJson("style_stats.json");
}

export async function loadStyleCorrelation(): Promise<CorrelationData> {
  return fetchJson("style_correlation.json");
}

export async function loadStyleComposition(): Promise<Record<string, string[]>> {
  return fetchJson("style_composition.json");
}

export async function loadStyleAnnual(): Promise<Record<string, AnnualReturns>> {
  return fetchJson("style_annual.json");
}

export async function loadStyleRolling(): Promise<Record<string, TimeSeries>> {
  return fetchJson("style_rolling12m.json");
}
