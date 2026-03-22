"""
Download macro data (FRED-MD + individual FRED series) and save JSON files
for the dashboard.

Output files (written to dashboard/public/data/):
  - macro_series.json
  - macro_metadata.json
  - nber_recessions.json

Usage:
  export FRED_API_KEY="your_key"   # optional; API-dependent series skipped if unset
  python download_macro.py
"""

import csv
import io
import json
import math
import os
import ssl
import urllib.request
from datetime import datetime

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "..", "dashboard", "public", "data")

FRED_MD_URLS = [
    "https://files.stlouisfed.org/files/htdocs/fred-md/monthly/current.csv",
    "https://s3.amazonaws.com/files.fred.stlouisfed.org/fred-md/monthly/current.csv",
]

# FRED API series to fetch (if API key available)
FRED_API_SERIES = {
    "USREC":       "NBER Recession Indicator",
    "NFCI":        "Chicago Fed National Financial Conditions Index",
    "ANFCI":       "Chicago Fed Adjusted NFCI",
    "CFNAI":       "Chicago Fed National Activity Index",
    "USEPUINDXM":  "Economic Policy Uncertainty Index (Monthly)",
}

# Placeholder series that require special data sources
PLACEHOLDER_SERIES = {
    "BW_SENTIMENT": {
        "description": "Baker-Wurgler Investor Sentiment Index",
        "source": "Jeffrey Wurgler's website (https://pages.stern.nyu.edu/~jwurgler/)",
        "note": "Download sentiment data manually from source.",
    },
    "EBP": {
        "description": "Excess Bond Premium (Gilchrist-Zakrajsek)",
        "source": "Federal Reserve Board (https://www.federalreserve.gov/econres/notes/feds-notes/updating-the-recession-risk-and-the-excess-bond-premium-20161006.html)",
        "note": "Download GZ spread / EBP data from the Fed website.",
    },
    "JLN_UNCERTAINTY": {
        "description": "Jurado-Ludvigson-Ng Macroeconomic Uncertainty (h=1)",
        "source": "Sydney Ludvigson's website (https://www.sydneyludvigson.com/macro-and-financial-uncertainty-indexes)",
        "note": "Download uncertainty index from source.",
    },
    "ADS_INDEX": {
        "description": "Aruoba-Diebold-Scotti Business Conditions Index",
        "source": "Philadelphia Fed (https://www.philadelphiafed.org/surveys-and-data/real-time-data-research/ads)",
        "note": "Download ADS index from Philadelphia Fed.",
    },
}

# McCracken-Ng transformation codes
# 1=levels, 2=first diff, 3=second diff, 4=log,
# 5=log first diff, 6=log second diff, 7=pct change (delta log * 100 approx)
TRANSFORM_LABELS = {
    1: "levels",
    2: "first_diff",
    3: "second_diff",
    4: "log",
    5: "log_first_diff",
    6: "log_second_diff",
    7: "pct_change",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def sanitize_for_json(obj):
    """Recursively replace inf / nan / numpy types with JSON-safe values."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    if isinstance(obj, np.ndarray):
        return sanitize_for_json(obj.tolist())
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.strftime("%Y-%m-%d")
    if obj is pd.NaT or obj is None:
        return None
    return obj


def apply_transform(series: pd.Series, tcode: int) -> pd.Series:
    """Apply McCracken-Ng transformation *tcode* to a pandas Series."""
    x = series.copy().astype(float)
    if tcode == 1:
        return x
    elif tcode == 2:
        return x.diff()
    elif tcode == 3:
        return x.diff().diff()
    elif tcode == 4:
        return np.log(x)
    elif tcode == 5:
        return np.log(x).diff()
    elif tcode == 6:
        return np.log(x).diff().diff()
    elif tcode == 7:
        # Approximate percent change: 100 * delta(log(x))
        return np.log(x).diff() * 100
    else:
        print(f"  [warn] Unknown tcode {tcode}, returning levels")
        return x


def _download_csv_text(urls):
    """Try multiple URLs to download FRED-MD CSV. Returns raw text or None."""
    # Method 1: urllib with various User-Agent strings
    user_agents = [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (compatible; research-bot/1.0)",
        "Python-urllib/3.13",
    ]
    ctx = ssl.create_default_context()

    for url in urls:
        for ua in user_agents:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "*/*"})
                with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
                    raw = resp.read().decode("utf-8", errors="replace")
                    if len(raw) > 1000 and "," in raw:
                        return raw
            except Exception:
                pass

    # Method 2: try requests library if available
    try:
        import requests
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Accept": "text/csv,text/plain,*/*",
        })
        for url in urls:
            try:
                r = session.get(url, timeout=60, allow_redirects=True)
                if r.status_code == 200 and len(r.text) > 1000:
                    return r.text
            except Exception:
                pass
    except ImportError:
        pass

    # Method 3: try pandas read_csv directly (handles some redirects)
    for url in urls:
        try:
            df = pd.read_csv(url, nrows=2)
            if len(df.columns) > 10:
                # If pandas can read it, re-read as text
                req = urllib.request.Request(url, headers={"User-Agent": "pandas"})
                with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
                    return resp.read().decode("utf-8", errors="replace")
        except Exception:
            pass

    return None


# ---------------------------------------------------------------------------
# 1. Download & process FRED-MD
# ---------------------------------------------------------------------------

def _fetch_fred_series_info(series_ids, api_key):
    """Fetch rich metadata for a list of FRED series IDs. Returns {id: info_dict}."""
    if not api_key:
        return {}
    import time
    result = {}
    # Some FRED-MD column names have 'x' suffix (e.g. CMRMTSPLx) — try without
    for sid in series_ids:
        # Try the ID as-is, then stripped of trailing 'x'
        candidates = [sid]
        if sid.endswith("x") and len(sid) > 1:
            candidates.append(sid[:-1])
        for try_id in candidates:
            try:
                url = (
                    f"https://api.stlouisfed.org/fred/series"
                    f"?series_id={try_id}&api_key={api_key}&file_type=json"
                )
                ctx = ssl.create_default_context()
                req = urllib.request.Request(url, headers={"User-Agent": "Python"})
                with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                info = data.get("seriess", [{}])[0]
                if info.get("title"):
                    result[sid] = {
                        "title": info.get("title", ""),
                        "units": info.get("units", ""),
                        "units_short": info.get("units_short", ""),
                        "frequency": info.get("frequency", ""),
                        "seasonal_adjustment": info.get("seasonal_adjustment", ""),
                        "seasonal_adjustment_short": info.get("seasonal_adjustment_short", ""),
                        "notes": (info.get("notes") or "")[:500],  # truncate long notes
                    }
                    break
            except Exception:
                continue
        # Rate-limit: FRED API allows 120 req/min
        time.sleep(0.55)
    return result


def _enrich_fred_md_cache_path():
    """Path to cache enriched FRED metadata so we don't re-fetch every run."""
    return os.path.join(SCRIPT_DIR, "cache", "fred_md_enriched_meta.json")


def _load_enriched_cache():
    """Load cached enriched metadata if it exists."""
    path = _enrich_fred_md_cache_path()
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_enriched_cache(data):
    """Save enriched metadata cache."""
    path = _enrich_fred_md_cache_path()
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def parse_fred_md_csv(raw_text):
    """Parse FRED-MD CSV text, apply transforms, return (series_dict, meta_dict)."""
    lines = raw_text.splitlines()
    reader = csv.reader(lines)
    header = next(reader)                       # column names
    tcode_row = next(reader)                    # transformation codes

    # Build column -> tcode mapping (skip first col which is date)
    col_names = header[1:]
    tcodes = {}
    for i, name in enumerate(col_names):
        try:
            tcodes[name] = int(float(tcode_row[i + 1]))
        except (ValueError, IndexError):
            tcodes[name] = 1  # default to levels

    # Read data rows into DataFrame
    data_rows = []
    for row in reader:
        if not row or not row[0].strip():
            continue
        data_rows.append(row)

    df = pd.DataFrame(data_rows, columns=header)
    # Parse date column — FRED-MD uses M/D/YY format (sasdate)
    df.rename(columns={header[0]: "date"}, inplace=True)
    df["date"] = pd.to_datetime(df["date"], format="%m/%d/%y", errors="coerce")
    # Fix century: pandas interprets 2-digit years > 68 as 19xx, <= 68 as 20xx
    # FRED-MD data starts 1959, so dates parsed as 2059+ are wrong — subtract 100 years
    future_mask = df["date"] > pd.Timestamp("2030-01-01")
    if future_mask.any():
        df.loc[future_mask, "date"] = df.loc[future_mask, "date"] - pd.DateOffset(years=100)
    df.dropna(subset=["date"], inplace=True)
    df.set_index("date", inplace=True)
    df.sort_index(inplace=True)

    # Convert to numeric
    for c in df.columns:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # Drop rows that are entirely NaN (trailing empty rows)
    df.dropna(how="all", inplace=True)

    print(f"  Parsed {len(df)} months x {len(df.columns)} series")
    print(f"  Date range: {df.index.min().date()} to {df.index.max().date()}")

    # --- Enrich descriptions from FRED API ---
    api_key = os.environ.get("FRED_API_KEY", "").strip()
    enriched_cache = _load_enriched_cache()
    missing = [c for c in df.columns if c not in enriched_cache]
    if missing and api_key:
        print(f"  Enriching metadata from FRED API for {len(missing)} series ...")
        new_info = _fetch_fred_series_info(missing, api_key)
        enriched_cache.update(new_info)
        _save_enriched_cache(enriched_cache)
        print(f"    Fetched info for {len(new_info)}/{len(missing)} series")
    elif missing:
        print(f"  [info] FRED_API_KEY not set — skipping metadata enrichment for {len(missing)} series")

    # Apply transformations
    print("  Applying McCracken-Ng transformations ...")
    series_dict = {}
    metadata_dict = {}

    for col in df.columns:
        tcode = tcodes.get(col, 1)
        transformed = apply_transform(df[col], tcode)
        # Drop leading NaN rows from differencing
        transformed = transformed.dropna()
        dates = [d.strftime("%Y-%m-%d") for d in transformed.index]
        values = transformed.tolist()

        # Build enriched description
        info = enriched_cache.get(col, {})
        title = info.get("title", "")
        units = info.get("units", "")
        sa = info.get("seasonal_adjustment_short", "")
        if title:
            desc = title
            qualifiers = []
            if units:
                qualifiers.append(units)
            if sa and sa != "Not Applicable":
                qualifiers.append(sa)
            if qualifiers:
                desc += f" ({', '.join(qualifiers)})"
        else:
            desc = col  # bare ticker as fallback

        series_dict[col] = {
            "dates": dates,
            "values": values,
            "description": desc,
        }
        metadata_dict[col] = {
            "description": desc,
            "source": "FRED-MD (McCracken & Ng)",
            "transform": TRANSFORM_LABELS.get(tcode, f"code_{tcode}"),
            "transform_code": tcode,
            "category": "FRED-MD",
            "units": units,
            "frequency": info.get("frequency", ""),
            "seasonal_adjustment": info.get("seasonal_adjustment", ""),
            "notes": info.get("notes", ""),
        }

    print(f"  Transformed {len(series_dict)} series")
    return series_dict, metadata_dict


def _find_local_fred_md_csv():
    """Look for a local FRED-MD CSV in the cache directory."""
    cache_dir = os.path.join(SCRIPT_DIR, "cache")
    if not os.path.isdir(cache_dir):
        return None
    # Match files like current.csv, 2026-02-MD.csv, *MD*.csv, *fred*.csv
    candidates = []
    for f in os.listdir(cache_dir):
        if f.lower().endswith(".csv"):
            candidates.append(os.path.join(cache_dir, f))
    if not candidates:
        return None
    # Prefer files with "MD" or "current" in the name, else newest
    for c in candidates:
        bn = os.path.basename(c).lower()
        if "md" in bn or "current" in bn or "fred" in bn:
            return c
    # Fall back to most recently modified CSV
    candidates.sort(key=os.path.getmtime, reverse=True)
    return candidates[0]


def download_fred_md():
    """Download FRED-MD CSV, parse, transform, return dict of series."""
    print("=" * 60)
    print("Loading FRED-MD data ...")
    print("=" * 60)

    # Check for local CSV first
    local_csv = _find_local_fred_md_csv()
    if local_csv:
        print(f"  Found local FRED-MD CSV: {local_csv}")
        with open(local_csv, "r", encoding="utf-8", errors="replace") as f:
            raw = f.read()
        print(f"  Read {len(raw):,} bytes from local file")
        return parse_fred_md_csv(raw)

    print("  No local CSV found in cache/, trying remote download ...")
    raw = _download_csv_text(FRED_MD_URLS)

    if raw is not None:
        print(f"  Downloaded {len(raw):,} bytes")
        return parse_fred_md_csv(raw)

    # -----------------------------------------------------------------------
    # Fallback: FRED-MD server is unavailable (e.g. 403).
    # Download a curated subset of key macro series individually from the
    # FRED API, so the pipeline still produces useful output.
    # -----------------------------------------------------------------------
    print("  [warn] Could not download FRED-MD CSV (server returned 403).")
    print("  Falling back to FRED API for key macro series ...")

    api_key = os.environ.get("FRED_API_KEY", "").strip()
    if not api_key:
        print("  [warn] FRED_API_KEY not set; cannot fetch fallback series.")
        print("         Returning empty FRED-MD dataset.")
        return {}, {}

    from fredapi import Fred
    fred = Fred(api_key=api_key)

    # A curated subset of the most important FRED-MD series
    FALLBACK_SERIES = {
        # Output & income
        "INDPRO":    (5, "Industrial Production Index"),
        "RPI":       (5, "Real Personal Income"),
        "CMRMTSPL":  (5, "Real Mfg. and Trade Industries Sales"),
        "UNRATE":    (2, "Unemployment Rate"),
        "PAYEMS":    (5, "All Employees: Total Nonfarm"),
        # Prices
        "CPIAUCSL":  (6, "CPI: All Items"),
        "PCEPI":     (6, "PCE Price Index"),
        "PPIFGS":    (6, "PPI: Finished Goods"),
        # Interest rates
        "FEDFUNDS":  (2, "Federal Funds Rate"),
        "GS1":       (2, "1-Year Treasury Rate"),
        "GS5":       (2, "5-Year Treasury Rate"),
        "GS10":      (2, "10-Year Treasury Rate"),
        "TB3MS":     (2, "3-Month Treasury Bill Rate"),
        "AAA":       (2, "Moody's AAA Corporate Bond Yield"),
        "BAA":       (2, "Moody's BAA Corporate Bond Yield"),
        # Money & credit
        "M1SL":      (6, "M1 Money Stock"),
        "M2SL":      (6, "M2 Money Stock"),
        "TOTRESNS":  (6, "Total Reserves"),
        "BUSLOANS":  (6, "Commercial and Industrial Loans"),
        # Stock market
        "S&P 500":   (5, "S&P 500 Index"),
        # Housing
        "HOUST":     (4, "Housing Starts"),
        "PERMIT":    (4, "Building Permits"),
        # Exchange rates
        "EXUSUKx":   (5, "US/UK Exchange Rate"),
        "EXJPUSx":   (5, "Japan/US Exchange Rate"),
        "EXCAUSx":   (5, "Canada/US Exchange Rate"),
        # Consumption
        "DPCERA3M086SBEA": (5, "Real PCE"),
    }

    series_dict = {}
    metadata_dict = {}

    for sid, (tcode, desc) in FALLBACK_SERIES.items():
        try:
            print(f"    Fetching {sid} ...")
            s = fred.get_series(sid)
            s = s.dropna()
            transformed = apply_transform(s, tcode)
            dates = [d.strftime("%Y-%m-%d") for d in transformed.index]
            values = transformed.tolist()

            series_dict[sid] = {
                "dates": dates,
                "values": values,
                "description": f"FRED-MD: {desc}",
            }
            metadata_dict[sid] = {
                "description": f"FRED-MD: {desc}",
                "source": "FRED-MD (McCracken & Ng) [fallback via API]",
                "transform": TRANSFORM_LABELS.get(tcode, f"code_{tcode}"),
                "transform_code": tcode,
                "category": "fred_md",
            }
            print(f"      -> {len(dates)} obs")
        except Exception as e:
            print(f"      [error] {sid}: {e}")

    print(f"  Fetched {len(series_dict)} fallback series via API")
    return series_dict, metadata_dict


# ---------------------------------------------------------------------------
# 2. Download individual FRED series via API
# ---------------------------------------------------------------------------

def download_fred_api_series():
    """Fetch extra FRED series using fredapi. Returns (series_dict, meta_dict)."""
    api_key = os.environ.get("FRED_API_KEY", "").strip()
    series_dict = {}
    metadata_dict = {}

    if not api_key:
        print("\n" + "=" * 60)
        print("FRED_API_KEY not set -- skipping API-dependent series")
        print("=" * 60)
        return series_dict, metadata_dict

    print("\n" + "=" * 60)
    print("Downloading individual FRED series via API ...")
    print("=" * 60)

    from fredapi import Fred
    fred = Fred(api_key=api_key)

    for sid, desc in FRED_API_SERIES.items():
        try:
            print(f"  Fetching {sid} ({desc}) ...")
            s = fred.get_series(sid)
            s = s.dropna()
            dates = [d.strftime("%Y-%m-%d") for d in s.index]
            values = s.tolist()

            series_dict[sid] = {
                "dates": dates,
                "values": values,
                "description": desc,
            }
            metadata_dict[sid] = {
                "description": desc,
                "source": "FRED API",
                "transform": "levels",
                "category": "fred_api",
            }
            print(f"    -> {len(dates)} observations")
        except Exception as e:
            print(f"    [error] Could not fetch {sid}: {e}")

    return series_dict, metadata_dict


# ---------------------------------------------------------------------------
# 2b. Download custom FRED tickers from custom_fred_tickers.json
# ---------------------------------------------------------------------------

CUSTOM_TICKERS_PATH = os.path.join(SCRIPT_DIR, "custom_fred_tickers.json")


def download_custom_fred_series():
    """Fetch user-defined custom FRED series. Returns (series_dict, meta_dict)."""
    series_dict = {}
    metadata_dict = {}

    if not os.path.exists(CUSTOM_TICKERS_PATH):
        return series_dict, metadata_dict

    api_key = os.environ.get("FRED_API_KEY", "").strip()
    if not api_key:
        print("\n  [info] FRED_API_KEY not set — skipping custom tickers")
        return series_dict, metadata_dict

    with open(CUSTOM_TICKERS_PATH, "r") as f:
        custom = json.load(f)

    if not custom:
        return series_dict, metadata_dict

    print("\n" + "=" * 60)
    print(f"Downloading {len(custom)} custom FRED series ...")
    print("=" * 60)

    from fredapi import Fred
    fred = Fred(api_key=api_key)

    # Load enriched metadata cache for descriptions
    enriched_cache = _load_enriched_cache()

    for sid, config in custom.items():
        tcode = config.get("transform_code", 1)
        user_desc = config.get("description", "")
        try:
            print(f"  Fetching {sid} ...")
            s = fred.get_series(sid)
            s = s.dropna()
            transformed = apply_transform(s, tcode)
            transformed = transformed.dropna()
            dates = [d.strftime("%Y-%m-%d") for d in transformed.index]
            values = transformed.tolist()

            # Enrich description from FRED API if not cached
            if sid not in enriched_cache:
                info = _fetch_fred_series_info([sid], api_key)
                enriched_cache.update(info)
                _save_enriched_cache(enriched_cache)

            cached_info = enriched_cache.get(sid, {})
            title = cached_info.get("title", "")
            units = cached_info.get("units", "")
            sa = cached_info.get("seasonal_adjustment_short", "")
            if title:
                desc = title
                qualifiers = []
                if units:
                    qualifiers.append(units)
                if sa and sa != "Not Applicable":
                    qualifiers.append(sa)
                if qualifiers:
                    desc += f" ({', '.join(qualifiers)})"
            else:
                desc = user_desc or sid

            series_dict[sid] = {
                "dates": dates,
                "values": values,
                "description": desc,
            }
            metadata_dict[sid] = {
                "description": desc,
                "source": "FRED API (custom)",
                "transform": TRANSFORM_LABELS.get(tcode, f"code_{tcode}"),
                "transform_code": tcode,
                "category": "custom",
                "units": units,
                "frequency": cached_info.get("frequency", ""),
                "seasonal_adjustment": cached_info.get("seasonal_adjustment", ""),
                "notes": cached_info.get("notes", ""),
            }
            print(f"    -> {len(dates)} obs ({desc})")
        except Exception as e:
            print(f"    [error] {sid}: {e}")

    return series_dict, metadata_dict


# ---------------------------------------------------------------------------
# 3. Build NBER recession date ranges from USREC (or hardcoded fallback)
# ---------------------------------------------------------------------------

# Hardcoded NBER recession dates (peak -> trough) for fallback
NBER_RECESSIONS_HARDCODED = [
    ("1857-06-01", "1858-12-01"),
    ("1860-10-01", "1861-06-01"),
    ("1865-04-01", "1867-12-01"),
    ("1869-06-01", "1870-12-01"),
    ("1873-10-01", "1879-03-01"),
    ("1882-03-01", "1885-05-01"),
    ("1887-03-01", "1888-04-01"),
    ("1890-07-01", "1891-05-01"),
    ("1893-01-01", "1894-06-01"),
    ("1895-12-01", "1897-06-01"),
    ("1899-06-01", "1900-12-01"),
    ("1902-09-01", "1904-08-01"),
    ("1907-05-01", "1908-06-01"),
    ("1910-01-01", "1912-01-01"),
    ("1913-01-01", "1914-12-01"),
    ("1918-08-01", "1919-03-01"),
    ("1920-01-01", "1921-07-01"),
    ("1923-05-01", "1924-07-01"),
    ("1926-10-01", "1927-11-01"),
    ("1929-08-01", "1933-03-01"),
    ("1937-05-01", "1938-06-01"),
    ("1945-02-01", "1945-10-01"),
    ("1948-11-01", "1949-10-01"),
    ("1953-07-01", "1954-05-01"),
    ("1957-08-01", "1958-04-01"),
    ("1960-04-01", "1961-02-01"),
    ("1969-12-01", "1970-11-01"),
    ("1973-11-01", "1975-03-01"),
    ("1980-01-01", "1980-07-01"),
    ("1981-07-01", "1982-11-01"),
    ("1990-07-01", "1991-03-01"),
    ("2001-03-01", "2001-11-01"),
    ("2007-12-01", "2009-06-01"),
    ("2020-02-01", "2020-04-01"),
]


def build_nber_recessions(series_dict):
    """Convert USREC indicator (0/1) into list of {start, end} periods."""
    print("\nBuilding NBER recession periods ...")
    if "USREC" not in series_dict:
        print("  USREC not available; using hardcoded NBER recession dates.")
        periods = [{"start": s, "end": e} for s, e in NBER_RECESSIONS_HARDCODED]
        print(f"  Loaded {len(periods)} recession periods (hardcoded)")
        return {"periods": periods}

    dates = series_dict["USREC"]["dates"]
    values = series_dict["USREC"]["values"]

    periods = []
    in_recession = False
    start = None

    for d, v in zip(dates, values):
        val = v if v is not None else 0
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            val = 0
        if val >= 0.5 and not in_recession:
            in_recession = True
            start = d
        elif val < 0.5 and in_recession:
            in_recession = False
            periods.append({"start": start, "end": d})

    # If still in recession at end of data
    if in_recession and start:
        periods.append({"start": start, "end": dates[-1]})

    print(f"  Found {len(periods)} recession periods")
    return {"periods": periods}


# ---------------------------------------------------------------------------
# 4. Add placeholder entries
# ---------------------------------------------------------------------------

def add_placeholders(metadata_dict):
    """Add placeholder metadata for series requiring special data sources."""
    for sid, info in PLACEHOLDER_SERIES.items():
        metadata_dict[sid] = {
            "description": info["description"],
            "source": info["source"],
            "transform": "levels",
            "category": "placeholder",
            "note": info["note"],
        }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. FRED-MD
    md_series, md_meta = download_fred_md()

    # 2. FRED API series
    api_series, api_meta = download_fred_api_series()

    # 2b. Custom FRED tickers
    custom_series, custom_meta = download_custom_fred_series()

    # 3. Merge (custom overrides API overrides FRED-MD)
    all_series = {**md_series, **api_series, **custom_series}
    all_meta = {**md_meta, **api_meta, **custom_meta}

    # 4. Placeholders
    add_placeholders(all_meta)

    # 5. NBER recessions
    nber = build_nber_recessions(all_series)

    # 6. Sanitize & write JSON
    print("\n" + "=" * 60)
    print("Writing JSON files ...")
    print("=" * 60)

    macro_series_path = os.path.join(OUTPUT_DIR, "macro_series.json")
    macro_meta_path = os.path.join(OUTPUT_DIR, "macro_metadata.json")
    nber_path = os.path.join(OUTPUT_DIR, "nber_recessions.json")

    clean_series = sanitize_for_json(all_series)
    clean_meta = sanitize_for_json(all_meta)
    clean_nber = sanitize_for_json(nber)

    with open(macro_series_path, "w") as f:
        json.dump(clean_series, f)
    print(f"  Wrote {macro_series_path}  ({os.path.getsize(macro_series_path):,} bytes)")

    with open(macro_meta_path, "w") as f:
        json.dump(clean_meta, f, indent=2)
    print(f"  Wrote {macro_meta_path}  ({os.path.getsize(macro_meta_path):,} bytes)")

    with open(nber_path, "w") as f:
        json.dump(clean_nber, f, indent=2)
    print(f"  Wrote {nber_path}  ({os.path.getsize(nber_path):,} bytes)")

    # 7. Coverage report: compare FRED-MD CSV vs API fallback
    print("\n" + "=" * 60)
    print("Coverage Report")
    print("=" * 60)
    md_tickers = set(md_series.keys())
    api_tickers = set(api_series.keys())
    print(f"  FRED-MD CSV series:    {len(md_tickers)}")
    print(f"  FRED API series:       {len(api_tickers)}")
    print(f"  Total (merged):        {len(all_series)}")

    if md_tickers and api_tickers:
        overlap = md_tickers & api_tickers
        api_only = api_tickers - md_tickers
        md_only = md_tickers - api_tickers
        if overlap:
            print(f"\n  Overlap (in both):     {len(overlap)}")
            for t in sorted(overlap):
                md_n = len(md_series[t]["dates"])
                api_n = len(api_series[t]["dates"])
                note = " (CSV has more)" if md_n > api_n else " (API has more)" if api_n > md_n else ""
                print(f"    {t:20s}  CSV: {md_n:5d} obs  API: {api_n:5d} obs{note}")
        if api_only:
            print(f"\n  API-only series ({len(api_only)}) -- not in FRED-MD CSV:")
            for t in sorted(api_only):
                print(f"    {t:20s}  {api_series[t].get('description', '')}")
        if md_only:
            print(f"\n  CSV-only series ({len(md_only)}) -- gained from FRED-MD CSV:")
            for t in sorted(list(md_only)[:20]):
                print(f"    {t:20s}  {md_series[t].get('description', '')}")
            if len(md_only) > 20:
                print(f"    ... and {len(md_only) - 20} more")

    print(f"\nDone!")
    print(f"  Total series in macro_series.json: {len(clean_series)}")
    print(f"  Total entries in macro_metadata.json: {len(clean_meta)}")
    print(f"  Recession periods in nber_recessions.json: {len(clean_nber['periods'])}")


if __name__ == "__main__":
    main()
