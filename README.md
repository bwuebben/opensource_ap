# Bernd's Equity Factor Lab

**[Live Site](https://bwuebben.github.io/opensource_ap/)**

Interactive research dashboard for exploring **212 equity factors** from Chen & Zimmermann (2022), "[Open Source Cross-Sectional Asset Pricing](https://www.openassetpricing.com/)" (*Critical Finance Review*).

Built for researchers and practitioners who want to dig into the full cross-section of published equity anomalies — their returns, risk characteristics, style exposures, macro sensitivities, and post-publication performance.

## What's Inside

**212 long-short factor portfolios**, monthly returns from 1926 to 2024, spanning every major anomaly category: Value, Momentum, Quality, Size, Investment, Profitability, Risk, Accruals, and more.

**132 macroeconomic time series** from [FRED-MD](https://research.stlouisfed.org/econ/mccracken/fred-databases/) (McCracken & Ng) plus supplemental FRED indicators, with McCracken-Ng stationarity transformations applied.

### 29 Dashboard Pages

| Section | Pages |
|---------|-------|
| **Overview** | Summary dashboard with Sharpe/t-stat distributions, top performers, category breakdown |
| **Factors** | Factor Browser, Factor Dictionary, Factor Scatter, Factor Screener, Rolling Stats, What Worked Recently |
| **Returns** | Cumulative Returns, Monthly Heatmap, Drawdowns, Correlation Matrix, Annual Returns, Seasonality, Decade Performance |
| **Styles & Portfolios** | Style Analysis (14 EW style groups), Style Portfolio Builder, Walk-Forward Optimization |
| **Research** | Replication Tracker, Post-Publication Decay, Long/Short Decomposition, Regimes & Crises, Crowding & Overlap, Factor Momentum, Tail Risk, Factor Timing |
| **Macro** | Macro Dashboard, Macro Dictionary, Factor-Macro Regressions |
| **Reference** | Data Sources |

### Research Highlights

- **Factor Momentum**: 4 strategies (quintile L/S, long-only, z-score weighted L/S, z-score long-only). The z-score weighted approach achieves Sharpe ~0.85 vs ~0.63 for the naive quintile strategy.
- **Post-Publication Decay**: Pre- vs post-publication Sharpe comparison for all 212 factors, broken out by category and decade of publication.
- **Replication Tracker**: 80.5% of factors replicate at conventional significance levels.
- **Walk-Forward Optimization**: Expanding-window max-Sharpe and max-return portfolios with annual rebalance, benchmarked against equal weight.
- **Factor-Macro Regressions**: OLS regression of any factor (or style group) on any macro variable, with cross-factor sensitivity rankings.

## Quick Start

```bash
# Clone and install frontend dependencies
git clone https://github.com/bwuebben/opensource_ap.git && cd opensource_ap
cd dashboard && npm install

# Start the dashboard (data is included in the repo)
npm run dev
# Open http://localhost:5173
```

The dashboard works immediately — all data files are included in the repo. No pipeline run needed for first use.

### Refreshing Data

To update with latest factor returns and macro data:

```bash
# Set up Python environment (one time)
cd data_pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install openassetpricing pandas numpy scipy fredapi

# Run full pipeline
cd ..
export FRED_API_KEY=<your_key>  # get one free at https://fred.stlouisfed.org/docs/api/api_key.html
./refresh_data.sh
```

FRED-MD data requires a manual CSV download from [McCracken's page](https://www.stlouisfed.org/research/economists/mccracken/fred-databases) — place the CSV in `data_pipeline/cache/`. See [data_pipeline/README.md](data_pipeline/README.md) for details.

## Project Structure

```
opensource_ap/
├── dashboard/                    # React + Vite + TypeScript frontend
│   ├── public/data/              # 33 JSON files consumed by the frontend
│   └── src/
│       ├── pages/                # 29 page components
│       ├── components/           # Layout, FactorName, FactorInfoModal, etc.
│       ├── PlotlyChart.tsx       # Custom Plotly wrapper
│       └── dataLoader.ts        # Data fetch functions
├── data_pipeline/                # Python data download & analytics
│   ├── cache/                    # Raw downloads (parquet, CSV) — gitignored
│   ├── download_data.py          # Factor returns + signal docs
│   ├── download_macro.py         # FRED-MD + FRED API macro data
│   ├── compute_styles.py         # 14 equal-weighted style groups
│   ├── compute_walkforward.py    # Walk-forward portfolio optimization
│   ├── compute_research.py       # Post-pub decay, crises, factor momentum, tail risk
│   ├── compute_deciles_and_new_analytics.py  # Decile decomp, decades, seasonality
│   ├── custom_fred_tickers.json  # User-defined additional FRED series
│   ├── README.md                 # Pipeline documentation
│   └── DATA_GUIDE.md             # Data format guide for building apps
└── refresh_data.sh               # One-command full data refresh
```

## Tech Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4
- **Charts**: plotly.js-dist-min (custom wrapper — react-plotly.js has CJS/ESM issues with Vite)
- **Data Pipeline**: Python 3.13, pandas, numpy, scipy
- **Factor Data**: [openassetpricing](https://pypi.org/project/openassetpricing/) package
- **Macro Data**: FRED-MD (McCracken & Ng) + [fredapi](https://pypi.org/project/fredapi/)
- **No backend server** — the frontend reads static JSON files

## Adding Custom Macro Series

You can add any FRED series to the dashboard:

1. **Quick preview**: Use the Macro Dictionary page (`/macro-dictionary`) to fetch and chart any FRED ticker live
2. **Permanent addition**: Add the ticker to `data_pipeline/custom_fred_tickers.json` and re-run the pipeline:

```json
{
  "CPILFESL": { "transform_code": 6, "description": "Core CPI" },
  "DGS10": { "transform_code": 1, "description": "10-Year Treasury Rate" }
}
```

## Building Other Apps with This Data

See [data_pipeline/DATA_GUIDE.md](data_pipeline/DATA_GUIDE.md) for complete JSON schemas, date/return conventions, code examples in Python and JavaScript, and instructions for extending the dataset.

## Deployment

The site is a fully static SPA — no backend required. It auto-deploys to GitHub Pages on every push to `main` via GitHub Actions.

**Live at**: https://bwuebben.github.io/opensource_ap/

To build locally:

```bash
cd dashboard && npm run build
# Output in dashboard/dist/ — serve with any static file server
```

## Data Sources

- **Factor Returns**: [openassetpricing.com](https://www.openassetpricing.com/) — Chen & Zimmermann (2022), *Critical Finance Review*
- **Macro Data**: [FRED-MD](https://research.stlouisfed.org/econ/mccracken/fred-databases/) — McCracken & Ng (2016), *Journal of Business & Economic Statistics*
- **Supplemental Macro**: [FRED API](https://fred.stlouisfed.org/docs/api/fred/) — NFCI, CFNAI, EPU, recession indicators

## License

Data is sourced from publicly available academic datasets. Factor returns from openassetpricing.com are free for research use. FRED data is public domain.
