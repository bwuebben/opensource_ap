# Data Guide — Building Applications with This Data

This guide describes the output data produced by the pipeline so you can build applications that consume it. All data lives as static JSON files in `dashboard/public/data/`.

## Quick Start

All data is pre-computed JSON. No database, no API server. To use it:

1. Run the pipeline (see `README.md`) to populate `dashboard/public/data/`
2. Read the JSON files directly from disk or serve them as static files
3. Use the schemas below to understand the structure

## File Inventory

### Factor Returns & Statistics

#### `factor_stats_op.json`
**The primary factor database.** Summary statistics for all 212 factors.

```
{
  "<factor_acronym>": {
    "name": "FactorName",
    "n_months": 1188,
    "start_date": "1926-07-31",
    "end_date": "2024-11-29",
    "ann_return": 0.0523,        // annualized mean return (decimal)
    "ann_volatility": 0.1234,    // annualized std dev
    "sharpe_ratio": 0.424,       // ann_return / ann_volatility
    "t_stat": 4.12,              // t-statistic of mean monthly return
    "total_return": 45.23,       // cumulative growth of $1
    "max_drawdown": -0.45,       // worst peak-to-trough (decimal, negative)
    "skewness": 0.12,
    "kurtosis": 5.34,
    "mean_monthly": 0.00436,     // mean monthly return (decimal)
    "median_monthly": 0.004,
    "pct_positive": 0.56,        // fraction of months with positive return
    "category": "Value",         // economic category
    "best_month": 0.25,
    "worst_month": -0.18
  },
  ...  // 212 factors
}
```

#### `monthly_returns_op.json`
Complete monthly return time series for all factors.

```
{
  "<factor_acronym>": {
    "dates": ["1926-07-31", "1926-08-31", ...],   // end-of-month dates
    "returns": [0.0168, -0.0042, ...]              // monthly returns (decimal)
  },
  ...
}
```

#### `cumulative_returns_op.json`
Pre-computed cumulative growth-of-$1 series.

```
{
  "<factor_acronym>": {
    "dates": ["1926-07-31", ...],
    "cumulative": [1.0168, 1.0125, ...]   // growth of $1
  },
  ...
}
```

#### `annual_returns_op.json`
Calendar-year returns per factor.

```
{
  "<factor_acronym>": {
    "years": [1927, 1928, ...],
    "returns": [0.12, -0.05, ...]   // annual returns (decimal)
  },
  ...
}
```

#### `drawdowns_op.json`
Drawdown time series and statistics.

```
{
  "<factor_acronym>": {
    "dates": ["1926-07-31", ...],
    "drawdowns": [0.0, -0.02, ...],     // drawdown from peak (decimal, negative)
    "max_drawdown": -0.45,
    "max_dd_start": "2000-03-31",
    "max_dd_end": "2003-03-31",
    "return_dd_ratio": 1.23             // ann_return / |max_drawdown|
  },
  ...
}
```

#### `correlation_op.json`
Pairwise correlation matrix for top 50 factors by Sharpe ratio.

```
{
  "factors": ["Factor1", "Factor2", ...],    // ordered list of factor names
  "matrix": [[1.0, 0.12, ...], ...]          // N x N correlation matrix
}
```

### Signal Documentation

#### `signal_doc.json`
Full academic documentation for each signal/factor.

```
[
  {
    "Acronym": "BM",
    "Cat.Signal": "Predictor",           // Predictor, Placebo, Clear Predictor, etc.
    "Predictability in OP": "Significant",
    "Signal Rep Quality": "High",
    "Authors": "Fama and French",
    "Year": 1992,
    "LongDescription": "Book-to-market ratio...",
    "Journal": "Journal of Finance",
    "Cat.Form": "Ratio",
    "Cat.Data": "Accounting"
  },
  ...  // 331 entries (some signals don't have return data)
]
```

#### `metadata.json`
Pipeline metadata.

```
{
  "last_updated": "2024-12-15",
  "port_types": ["op"],
  "n_factors": 212,
  "source": "openassetpricing",
  "version": "1.0"
}
```

### Style & Portfolio Analysis

#### `style_stats.json`
Statistics for 14 equal-weighted style groups (Value, Momentum, Quality, Investment, Risk, Size, Profitability, Trading, Short-Term Reversal, Seasonality, Accruals, Debt Issuance, Intangibles, Volatility).

```
{
  "<style_name>": {
    "n_factors": 15,
    "ann_return": 0.04,
    "ann_vol": 0.08,
    "sharpe": 0.50,
    "t_stat": 3.2,
    "max_drawdown": -0.30,
    "factors": ["Factor1", "Factor2", ...]  // constituent factors
  },
  ...
}
```

#### `style_returns.json` / `style_cumulative.json` / `style_rolling12m.json` / `style_annual.json` / `style_correlation.json` / `style_composition.json`
Time series and analytics for style groups. Same date/value structure as factor returns.

#### `walkforward_sharpe.json` / `walkforward_return.json`
Walk-forward optimized multi-factor portfolios.

```
{
  "objective": "max_sharpe",          // or "max_return"
  "dates": ["1940-01-31", ...],
  "returns": [0.01, -0.005, ...],     // monthly portfolio returns
  "cumulative": [1.01, 1.005, ...],   // growth of $1
  "drawdown": [0.0, -0.01, ...],
  "weights_by_year": {                // annual weight allocation
    "1940": {"Factor1": 0.15, "Factor2": 0.10, ...},
    ...
  },
  "stats": {
    "ann_return": 0.12,
    "ann_vol": 0.08,
    "sharpe": 1.50,
    "max_drawdown": -0.20
  }
}
```

#### `walkforward_equal_weight.json`
Equal-weight benchmark portfolio for comparison.

### Research Analytics

#### `post_pub_decay.json`
Pre- vs post-publication performance for each factor.

```
{
  "<factor_acronym>": {
    "pub_year": 2001,
    "pre_sharpe": 0.65,
    "post_sharpe": 0.30,
    "pre_mean": 0.005,
    "post_mean": 0.002,
    "decay_pct": -53.8,              // % change in Sharpe
    "category": "Value"
  },
  ...
}
```

#### `crisis_performance.json`
Factor returns during 9 crisis windows.

```
{
  "crises": [
    {
      "name": "Global Financial Crisis",
      "start": "2007-12-31",
      "end": "2009-06-30",
      "description": "..."
    },
    ...
  ],
  "factor_returns": {
    "<factor_acronym>": {
      "<crisis_name>": 0.15    // cumulative return during crisis
    },
    ...
  }
}
```

#### `factor_momentum.json`
Factor momentum strategies — ranking factors by trailing 12-month return.

```
{
  "dates": ["1928-01-31", ...],
  "long_short_returns": [0.01, ...],        // top quintile minus bottom quintile (EW)
  "long_only_returns": [0.008, ...],        // top quintile only (EW)
  "zscore_weighted_returns": [0.007, ...],  // z-score weighted L/S (leverage 1)
  "zscore_weighted_lo_returns": [0.009,...], // z-score weighted long-only
  "cumulative_ls": [1.01, ...],             // growth of $1 for each strategy
  "cumulative_lo": [...],
  "cumulative_zw": [...],
  "cumulative_zw_lo": [...],
  "stats_ls": { "sharpe_ratio": 0.63, "ann_return": 0.10, ... },
  "stats_lo": { ... },
  "stats_zw": { ... },
  "stats_zw_lo": { ... }
}
```

Stats objects contain: `mean_monthly`, `ann_return`, `ann_vol`, `ann_volatility`, `sharpe`, `sharpe_ratio`, `t_stat`, `n_months`, `max_drawdown`, `pct_positive`.

#### `tail_risk.json`
Tail risk metrics for all factors.

```
{
  "factors": {
    "<factor_acronym>": {
      "var_5": -0.05,              // 5% Value at Risk
      "cvar_5": -0.08,             // 5% Conditional VaR (Expected Shortfall)
      "max_drawdown": -0.45,
      "max_dd_duration_months": 48,
      "worst_episodes": [...]
    },
    ...
  }
}
```

#### `rolling_correlations.json`
Rolling average pairwise correlation among top 30 factors by Sharpe (crowding indicator).

```
{
  "dates": ["1930-01-31", ...],
  "avg_corr": [0.05, 0.08, ...],       // rolling 60-month avg pairwise corr
  "factors": ["Factor1", "Factor2", ...]  // the 30 factors used
}
```

#### `replication_tracker.json`
Comparison of original paper t-stats vs replicated t-stats.

```
{
  "factors": [
    {
      "acronym": "BM",
      "original_tstat": 4.5,
      "replicated_tstat": 4.1,
      "replicated": true,
      "category": "Value"
    },
    ...
  ],
  "summary": {
    "replication_rate": 0.805,
    "n_total": 212,
    "n_replicated": 170
  }
}
```

#### `factor_timing.json`
Conditional Sharpe ratios by macro regime terciles.

```
{
  "macro_vars": ["INDPRO", "UNRATE", ...],
  "by_style": { ... },
  "by_factor": {
    "<factor_acronym>": {
      "<macro_var>": {
        "low": 0.3,       // Sharpe when macro var is in low tercile
        "mid": 0.5,
        "high": 0.1
      },
      ...
    },
    ...
  }
}
```

#### `long_short_decomp.json`
Decile D1 vs D10 return decomposition.

#### `decade_performance.json`
Factor Sharpe ratios by decade (1920s through 2020s).

#### `factor_seasonality.json`
Monthly seasonality patterns by factor.

#### `recent_performance.json`
1/3/6/12-month trailing performance leaderboard.

### Macro Data

#### `macro_series.json`
Time series for all macro variables (FRED-MD + supplemental + custom).

```
{
  "<FRED_ticker>": {
    "dates": ["1959-02-01", "1959-03-01", ...],  // first-of-month dates
    "values": [0.0012, -0.0003, null, ...],       // transformed values (nulls for missing)
    "description": "Industrial Production: Total Index (Index 2017=100, SA)"
  },
  ...  // 132+ series
}
```

**Important**: Values are McCracken-Ng *transformed* (not raw levels). See the transformation codes in `macro_metadata.json` to understand what transform was applied.

#### `macro_metadata.json`
Rich metadata for each macro series.

```
{
  "<FRED_ticker>": {
    "description": "Industrial Production: Total Index (Index 2017=100, SA)",
    "source": "FRED-MD (McCracken & Ng)",
    "transform": "log_first_diff",       // human-readable transform name
    "transform_code": 5,                 // McCracken-Ng code (1-7)
    "category": "FRED-MD",              // FRED-MD | fred_api | custom | placeholder
    "units": "Index 2017=100",
    "frequency": "Monthly",
    "seasonal_adjustment": "Seasonally Adjusted",
    "notes": "explanatory notes from FRED..."  // truncated to 500 chars
  },
  ...
}
```

#### `nber_recessions.json`
NBER recession date ranges for chart shading.

```
{
  "periods": [
    { "start": "1857-06-01", "end": "1858-12-01" },
    { "start": "1860-10-01", "end": "1861-06-01" },
    ...
    { "start": "2020-02-01", "end": "2020-04-01" }
  ]
}
```

## Date Conventions

| Data type | Date format | Convention | Example |
|-----------|-------------|------------|---------|
| Factor returns | `YYYY-MM-DD` | End of month | `2020-01-31` |
| Macro series | `YYYY-MM-DD` | First of month | `2020-01-01` |
| NBER recessions | `YYYY-MM-DD` | First of month | `2020-02-01` |

**Aligning factor and macro data**: Match on `YYYY-MM` (year-month) since the day-of-month differs. Factor return for January 2020 (`2020-01-31`) corresponds to macro observation for January 2020 (`2020-01-01`).

## Return Conventions

- All factor returns are in **decimal form** (0.01 = 1%)
- Returns are **long-short** portfolio returns (long top quantile, short bottom quantile)
- Cumulative returns are **growth of $1** (starts at ~1.0, multiply by returns)
- Drawdowns are **negative** decimals (e.g., -0.45 = -45% drawdown)
- Sharpe ratios are annualized: `mean_monthly / std_monthly * sqrt(12)`

## Common Data Access Patterns

### Python

```python
import json

# Load factor stats
with open("dashboard/public/data/factor_stats_op.json") as f:
    stats = json.load(f)

# Top 10 factors by Sharpe ratio
top10 = sorted(stats.items(), key=lambda x: x[1]["sharpe_ratio"], reverse=True)[:10]
for name, s in top10:
    print(f"{name:20s}  Sharpe={s['sharpe_ratio']:.3f}  AnnRet={s['ann_return']*100:.1f}%")

# Load monthly returns into pandas DataFrame
with open("dashboard/public/data/monthly_returns_op.json") as f:
    returns_raw = json.load(f)

import pandas as pd
frames = {}
for factor, data in returns_raw.items():
    frames[factor] = pd.Series(data["returns"], index=pd.to_datetime(data["dates"]))
returns_df = pd.DataFrame(frames)
```

### JavaScript / TypeScript

```typescript
// Fetch factor stats
const stats = await fetch("/data/factor_stats_op.json").then(r => r.json());

// Fetch macro series
const macro = await fetch("/data/macro_series.json").then(r => r.json());
const indpro = macro["INDPRO"];  // { dates: [...], values: [...], description: "..." }
```

### Aligning factor returns with macro data

```python
import pandas as pd

# Factor returns: end-of-month dates
factor_dates = pd.to_datetime(returns_data["dates"])
factor_ym = factor_dates.to_period("M")

# Macro data: first-of-month dates
macro_dates = pd.to_datetime(macro_data["dates"])
macro_ym = macro_dates.to_period("M")

# Merge on year-month
factor_df = pd.DataFrame({"ret": returns_data["returns"]}, index=factor_ym)
macro_df = pd.DataFrame({"macro": macro_data["values"]}, index=macro_ym)
aligned = factor_df.join(macro_df, how="inner")
```

## File Sizes (Approximate)

| File | Size | Notes |
|------|------|-------|
| `macro_series.json` | ~3.6 MB | Largest file — 132 series with full history |
| `monthly_returns_op.json` | ~8 MB | 212 factors x ~1200 months |
| `cumulative_returns_op.json` | ~8 MB | Same dimensions |
| `factor_stats_op.json` | ~120 KB | Summary only |
| `macro_metadata.json` | ~80 KB | Descriptions and metadata |
| All other files | 20-100 KB each | |

## Extending the Data

### Adding a new FRED series

1. Edit `data_pipeline/custom_fred_tickers.json`:
   ```json
   { "TICKER": { "transform_code": 1, "description": "My Series" } }
   ```
2. Run `FRED_API_KEY=<key> python3 data_pipeline/download_macro.py`
3. The series appears in `macro_series.json` and `macro_metadata.json`

### Adding a new computed analytics file

1. Create a new `compute_*.py` script in `data_pipeline/`
2. Read input from `dashboard/public/data/` or `data_pipeline/cache/`
3. Write output JSON to `dashboard/public/data/`
4. Sanitize all output with the `sanitize_for_json()` pattern (replace inf/nan with null)
5. Add the script to `refresh_data.sh`
