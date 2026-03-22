export interface FactorStats {
  name: string;
  n_months: number;
  start_date: string;
  end_date: string;
  ann_return: number;
  ann_volatility: number;
  sharpe_ratio: number;
  t_stat: number;
  total_return: number;
  max_drawdown: number;
  pct_positive: number;
  best_month: number;
  worst_month: number;
  mean_monthly: number;
  median_monthly: number;
  skewness: number;
  kurtosis: number;
}

export interface TimeSeries {
  dates: string[];
  values: number[];
}

export interface CorrelationData {
  factors: string[];
  matrix: number[][];
}

export interface AnnualReturns {
  years: number[];
  values: number[];
}

export interface SignalDoc {
  Acronym: string;
  Authors: string;
  Year: number | null;
  Journal: string | null;
  LongDescription: string | null;
  "Cat.Signal": string | null;
  "Cat.Data": string | null;
  "Cat.Economic": string | null;
  "Cat.Form": string | null;
  "Signal Rep Quality": string | null;
  "Predictability in OP": string | null;
  SampleStartYear: number | null;
  SampleEndYear: number | null;
  "T-Stat": number | null;
  Sign: string | null;
  [key: string]: string | number | null | undefined;
}

export interface Metadata {
  last_updated: string;
  port_types: string[];
  n_factors: number;
  source: string;
  version: string;
}

export type SortDirection = "asc" | "desc";
export type PortfolioType = "op" | "deciles_ew" | "deciles_vw" | "quintiles_ew" | "quintiles_vw";
