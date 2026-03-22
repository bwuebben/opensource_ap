# Data Pipeline

Downloads, transforms, and outputs all data consumed by the Open Asset Pricing dashboard. Produces **32 JSON files** in `dashboard/public/data/` — the frontend reads these as static files with no backend server.

## Data Sources

### 1. Open Asset Pricing (Chen & Zimmermann, 2022)

- **Source**: [openassetpricing.com](https://www.openassetpricing.com/) via the `openassetpricing` Python package
- **Content**: 212 equity factor long-short portfolio returns (monthly), signal documentation
- **Citation**: Chen & Zimmermann (2022), "Open Source Cross-Sectional Asset Pricing", *Critical Finance Review*
- **Access**: No WRDS credentials needed for portfolio returns; stock-level signals would require WRDS
- **Returns format**: Percentage form from source (e.g., 1.68 = 1.68%). Pipeline divides by 100 to get decimals.

### 2. FRED-MD (McCracken & Ng)

- **Source**: [McCracken FRED Databases](https://www.stlouisfed.org/research/economists/mccracken/fred-databases) — the "Monthly" CSV under FRED-MD
- **Content**: ~126 curated macroeconomic time series with standard transformation codes for stationarity
- **Citation**: McCracken & Ng (2016), "FRED-MD: A Monthly Database for Macroeconomic Research", *Journal of Business & Economic Statistics*
- **Why McCracken**: This dataset is the academic standard for macro-finance research. It provides pre-specified transformation codes (log-diff, second-diff, etc.) ensuring stationarity. We use this dataset rather than downloading individual FRED series to maintain consistency with the academic literature.

### 3. FRED API (Supplemental)

- **Source**: [FRED API](https://fred.stlouisfed.org/docs/api/fred/) via the `fredapi` Python package
- **Content**: 5 supplemental indicators not in FRED-MD (USREC, NFCI, ANFCI, CFNAI, USEPUINDXM), plus any custom tickers
- **API Key**: Required. Set via `FRED_API_KEY` environment variable. Current key: see `CLAUDE.md`

### 4. Custom FRED Tickers

- **Source**: `custom_fred_tickers.json` in this directory
- **Content**: User-defined additional FRED series to fetch via the API and merge into the output
- **See**: [Custom Tickers](#custom-fred-tickers) section below

## Setup

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install openassetpricing pandas numpy scipy fredapi
```

## Running the Pipeline

### Full refresh (all steps)

```bash
cd <project_root>
./refresh_data.sh
```

### Individual steps

```bash
source data_pipeline/.venv/bin/activate

# Step 1: Factor returns + signal documentation
python3 data_pipeline/download_data.py

# Step 2: Style group returns (14 equal-weighted styles)
python3 data_pipeline/compute_styles.py

# Step 3: Walk-forward optimized portfolios (slow, ~2 min)
python3 data_pipeline/compute_walkforward.py

# Step 4: Research analytics (post-pub decay, crises, factor momentum, tail risk)
python3 data_pipeline/compute_research.py

# Step 5: Decile decomposition + new analytics (decades, seasonality, timing, replication)
python3 data_pipeline/compute_deciles_and_new_analytics.py

# Step 6: Macro data (requires FRED_API_KEY)
FRED_API_KEY=<your_key> python3 data_pipeline/download_macro.py
```

### Execution order matters

Scripts must run in the order above. Each step depends on cached files from previous steps:
- `download_data.py` produces cached parquet files in `cache/` and base JSON files
- `compute_styles.py` reads `monthly_returns_op.json`
- `compute_research.py` reads `monthly_returns_op.json`
- `compute_deciles_and_new_analytics.py` reads cached parquet + base JSON files
- `download_macro.py` is independent (macro data only)

## FRED-MD (McCracken) Data — Manual Update Required

The FRED-MD CSV cannot be reliably auto-downloaded — the St. Louis Fed S3 bucket has bot protection that blocks programmatic access (returns 403).

### How to update

1. Go to [McCracken FRED Databases](https://www.stlouisfed.org/research/economists/mccracken/fred-databases)
2. Under **FRED-MD**, click the **Monthly** CSV download link (`current.csv`)
3. Save the file to `data_pipeline/cache/` — any filename with "MD", "current", or "fred" in it works (e.g., `current.csv`, `2026-02-MD.csv`)
4. Re-run the macro pipeline: `FRED_API_KEY=<key> python3 data_pipeline/download_macro.py`

### How the pipeline finds the CSV

The pipeline checks `data_pipeline/cache/` for CSV files in this priority:
1. Files with "md", "current", or "fred" in the filename
2. Most recently modified CSV file
3. If no local CSV: tries remote download from St. Louis Fed URLs
4. If remote fails: falls back to downloading ~26 key series individually from FRED API (significantly fewer series)

### What the McCracken CSV contains

- First row: column names (FRED tickers)
- Second row: McCracken-Ng transformation codes (1-7)
- Remaining rows: monthly observations with `sasdate` format dates (M/D/YY)

**Transformation codes** (applied to achieve stationarity):

| Code | Transform | Example series |
|------|-----------|---------------|
| 1 | Levels (no transform) | VIX, AWHMAN |
| 2 | First difference | UNRATE, FEDFUNDS |
| 3 | Second difference | — |
| 4 | Log | HOUST, PERMIT |
| 5 | Log first difference (growth rate) | INDPRO, PAYEMS, S&P 500 |
| 6 | Log second difference (acceleration) | CPIAUCSL, M2SL |
| 7 | Percent change (100 * delta log) | — |

## Custom FRED Tickers

To add additional FRED series beyond FRED-MD and the built-in supplemental set, edit `custom_fred_tickers.json`:

```json
{
  "CPILFESL": {
    "transform_code": 6,
    "description": "CPI Less Food and Energy (Core CPI)"
  },
  "DGS10": {
    "transform_code": 1,
    "description": "10-Year Treasury Constant Maturity Rate (daily)"
  }
}
```

**Fields**:
- `transform_code` (required): McCracken-Ng transform to apply (1-7, see table above). Use 1 for levels if unsure.
- `description` (optional): Human-readable label. The pipeline will also fetch the full FRED title automatically.

After editing, re-run:
```bash
FRED_API_KEY=<key> python3 data_pipeline/download_macro.py
```

The custom series will be merged into `macro_series.json` and `macro_metadata.json`, making them available across all dashboard pages (Macro Dashboard, Macro Dictionary, Factor-Macro Regressions).

### Adding custom tickers from the dashboard

The Macro Dictionary page (`/macro-dictionary`) has a "Fetch Custom FRED Series" section where you can type any FRED ticker and preview it live. These previews are cached in your browser's localStorage. To make them permanent and available across all pages, add the ticker to `custom_fred_tickers.json` and re-run the pipeline.

## Metadata Enrichment

On the first run with a FRED API key, the pipeline fetches rich metadata (title, units, frequency, seasonal adjustment, notes) from the FRED API for all FRED-MD series. This is cached in `cache/fred_md_enriched_meta.json` and reused on subsequent runs — only new/unknown tickers trigger additional API calls.

For 9 FRED-MD series with non-standard IDs (e.g., "S&P 500", "HWI"), manual descriptions are provided in the cache.

## Pipeline Scripts

| Script | Input | Output | Description |
|--------|-------|--------|-------------|
| `download_data.py` | openassetpricing package | 10 JSON files + 3 parquet cache files | Factor returns, stats, cumulative returns, correlations, drawdowns, signal docs |
| `compute_styles.py` | `monthly_returns_op.json`, `signal_doc.json` | 8 JSON files | 14 equal-weighted style groups (Value, Momentum, Quality, etc.) |
| `compute_walkforward.py` | `monthly_returns_op.json` | 3 JSON files | Walk-forward optimization with expanding window, annual rebalance |
| `compute_research.py` | `monthly_returns_op.json`, `signal_doc.json` | 5 JSON files | Post-pub decay, crisis performance, factor momentum, tail risk, crowding |
| `compute_deciles_and_new_analytics.py` | Cached parquet + JSON | 6 JSON files | Decile decomposition, decade performance, seasonality, timing, replication |
| `download_macro.py` | FRED-MD CSV + FRED API | 3 JSON files | Macro series, metadata, NBER recessions |

## Cache Directory

`data_pipeline/cache/` contains intermediate/raw data:

| File | Source | Purpose |
|------|--------|---------|
| `returns_op.parquet` | openassetpricing | Raw factor returns (monthly, long-short) |
| `returns_deciles_ew.parquet` | openassetpricing | Decile portfolio returns (equal-weighted) |
| `signal_doc.parquet` | openassetpricing | Signal documentation with metadata |
| `2026-02-MD.csv` (or `current.csv`) | McCracken FRED-MD | Raw macro CSV (manually downloaded) |
| `fred_md_enriched_meta.json` | FRED API | Cached rich descriptions for FRED-MD tickers |

## JSON Sanitization

All pipeline scripts sanitize output for valid JSON:
- `Infinity` / `-Infinity` / `NaN` → `null`
- NumPy types → Python native types
- Timestamps → `"YYYY-MM-DD"` strings

## Key Technical Notes

- **Returns scaling**: Factor returns from openassetpricing are in percentage form. Pipeline divides by 100 before computing stats. This prevents cumulative return overflow.
- **Date formats**: Factor returns use end-of-month (2020-01-31). Macro data uses first-of-month (2020-01-01). The Factor-Macro Regression page aligns on YYYY-MM.
- **FRED-MD date parsing**: The CSV uses 2-digit year `sasdate` format (M/D/YY). Python's `strptime` maps years >68 to 19xx and <=68 to 20xx. The pipeline corrects dates beyond 2030 by subtracting 100 years.
- **Trailing rows**: The FRED-MD CSV sometimes has rows with all-NaN data at the end. The pipeline drops these (`dropna(how="all")`).
