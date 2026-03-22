#!/usr/bin/env python3
"""
Open Asset Pricing Data Pipeline
Downloads factor returns and signal documentation, converts to JSON for the dashboard.
"""

import os
import json
import sys
import argparse
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

# Output directory - dashboard's public/data folder
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_DIR / "dashboard" / "public" / "data"
CACHE_DIR = SCRIPT_DIR / "cache"


def ensure_dirs():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def download_portfolio_returns(port_type="op"):
    """Download portfolio returns using the openassetpricing package."""
    import openassetpricing as oap

    print(f"Downloading portfolio returns (type={port_type})...")
    openap = oap.OpenAP()
    df = openap.dl_port(port_type, "pandas")
    print(f"  Got {len(df)} rows, {len(df.columns)} columns")
    return df


def download_signal_doc():
    """Download signal documentation."""
    import openassetpricing as oap

    print("Downloading signal documentation...")
    openap = oap.OpenAP()
    df = openap.dl_signal_doc("pandas")
    print(f"  Got {len(df)} signals documented")
    return df


def process_monthly_returns(df):
    """Process monthly returns into JSON-friendly format."""
    # The data has a 'date' column and factor columns
    # Convert date to string format
    result = {}

    # Get factor names (all columns except date/identifier columns)
    meta_cols = {"date", "port", "ret", "signalname"}

    # Check the shape of the data
    print(f"  Columns: {list(df.columns[:10])}...")
    print(f"  Shape: {df.shape}")
    print(f"  Head:\n{df.head()}")

    # The openassetpricing package returns data in long format:
    # signalname, date, ret (and possibly port)
    if "signalname" in df.columns:
        # Long format - pivot to wide
        print("  Data is in long format, pivoting...")

        # For long-short returns, we want the 'LS' or 'long_short' portfolio
        if "port" in df.columns:
            # Filter to long-short portfolio
            ls_values = [p for p in df["port"].unique() if "LS" in str(p).upper() or "ls" in str(p).lower()]
            if ls_values:
                df = df[df["port"].isin(ls_values)]
                print(f"  Filtered to long-short portfolios: {ls_values}")
            else:
                print(f"  Available ports: {df['port'].unique()[:20]}")

        # Parse date
        if df["date"].dtype == object:
            # Try parsing various formats
            try:
                df["date"] = pd.to_datetime(df["date"])
            except Exception:
                # Handle YYYYm# format
                df["date"] = df["date"].apply(lambda x: pd.to_datetime(str(x).replace("m", "-"), format="%Y-%m"))

        # Pivot: rows=dates, columns=signal names
        pivot_df = df.pivot_table(index="date", columns="signalname", values="ret", aggfunc="first")
        pivot_df = pivot_df.sort_index()

        # Convert from percentage (e.g. 1.68 = 1.68%) to decimal (0.0168)
        pivot_df = pivot_df / 100.0

        return pivot_df
    else:
        # Already wide format
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"])
            df = df.set_index("date").sort_index()
        return df


def compute_factor_stats(returns_df):
    """Compute summary statistics for each factor."""
    stats = {}
    for col in returns_df.columns:
        series = returns_df[col].dropna()
        if len(series) < 12:
            continue

        cumulative = (1 + series).cumprod()
        total_return = cumulative.iloc[-1] - 1 if len(cumulative) > 0 else 0

        # Drawdown
        rolling_max = cumulative.cummax()
        drawdown = (cumulative - rolling_max) / rolling_max
        max_drawdown = drawdown.min()

        # Annualized stats
        n_years = len(series) / 12
        ann_return = (1 + total_return) ** (1 / max(n_years, 0.01)) - 1 if total_return > -1 else -1
        ann_vol = series.std() * np.sqrt(12)
        sharpe = ann_return / ann_vol if ann_vol > 0 else 0

        # Monthly stats
        pct_positive = (series > 0).mean()
        best_month = series.max()
        worst_month = series.min()

        # t-stat
        t_stat = series.mean() / (series.std() / np.sqrt(len(series))) if series.std() > 0 else 0

        stats[col] = {
            "name": col,
            "n_months": int(len(series)),
            "start_date": series.index[0].strftime("%Y-%m") if hasattr(series.index[0], "strftime") else str(series.index[0]),
            "end_date": series.index[-1].strftime("%Y-%m") if hasattr(series.index[-1], "strftime") else str(series.index[-1]),
            "ann_return": round(float(ann_return), 6),
            "ann_volatility": round(float(ann_vol), 6),
            "sharpe_ratio": round(float(sharpe), 4),
            "t_stat": round(float(t_stat), 4),
            "total_return": round(float(total_return), 6),
            "max_drawdown": round(float(max_drawdown), 6),
            "pct_positive": round(float(pct_positive), 4),
            "best_month": round(float(best_month), 6),
            "worst_month": round(float(worst_month), 6),
            "mean_monthly": round(float(series.mean()), 6),
            "median_monthly": round(float(series.median()), 6),
            "skewness": round(float(series.skew()), 4),
            "kurtosis": round(float(series.kurtosis()), 4),
        }

    return stats


def compute_correlation_matrix(returns_df, top_n=50):
    """Compute correlation matrix for top N factors by Sharpe ratio."""
    # Pick top N factors by absolute Sharpe
    stats = compute_factor_stats(returns_df)
    sorted_factors = sorted(stats.values(), key=lambda x: abs(x["sharpe_ratio"]), reverse=True)
    top_factors = [f["name"] for f in sorted_factors[:top_n]]

    sub = returns_df[top_factors].dropna(how="all")
    corr = sub.corr()

    return {
        "factors": top_factors,
        "matrix": corr.values.tolist(),
    }


def compute_cumulative_returns(returns_df):
    """Compute cumulative returns for each factor."""
    result = {}
    for col in returns_df.columns:
        series = returns_df[col].dropna()
        if len(series) < 2:
            continue
        cumulative = (1 + series).cumprod()
        dates = [d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d) for d in cumulative.index]
        result[col] = {
            "dates": dates,
            "values": [round(float(v), 6) for v in cumulative.values],
        }
    return result


def compute_monthly_heatmap(returns_df, factor_name):
    """Compute monthly return heatmap data for a single factor."""
    series = returns_df[factor_name].dropna()
    if len(series) == 0:
        return None

    # Group by year and month
    df = pd.DataFrame({"ret": series})
    df["year"] = df.index.year
    df["month"] = df.index.month
    pivot = df.pivot_table(index="year", columns="month", values="ret", aggfunc="first")

    return {
        "years": pivot.index.tolist(),
        "months": list(range(1, 13)),
        "values": [[round(float(v), 6) if not pd.isna(v) else None for v in row] for row in pivot.values],
    }


def compute_drawdowns(returns_df):
    """Compute drawdown series for each factor."""
    result = {}
    for col in returns_df.columns:
        series = returns_df[col].dropna()
        if len(series) < 2:
            continue
        cumulative = (1 + series).cumprod()
        rolling_max = cumulative.cummax()
        drawdown = (cumulative - rolling_max) / rolling_max

        dates = [d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d) for d in drawdown.index]
        result[col] = {
            "dates": dates,
            "values": [round(float(v), 6) for v in drawdown.values],
        }
    return result


def compute_annual_returns(returns_df):
    """Compute annual returns for each factor."""
    result = {}
    for col in returns_df.columns:
        series = returns_df[col].dropna()
        if len(series) < 2:
            continue
        # Group by year, compound monthly returns
        df = pd.DataFrame({"ret": series})
        df["year"] = df.index.year
        annual = df.groupby("year")["ret"].apply(lambda x: (1 + x).prod() - 1)
        result[col] = {
            "years": annual.index.tolist(),
            "values": [round(float(v), 6) for v in annual.values],
        }
    return result


def sanitize_for_json(obj):
    """Recursively replace inf/-inf/nan with None for valid JSON."""
    if isinstance(obj, float):
        if np.isinf(obj) or np.isnan(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    return obj


def save_json(data, filename):
    """Save data as JSON file."""
    filepath = OUTPUT_DIR / filename
    clean = sanitize_for_json(data)
    with open(filepath, "w") as f:
        json.dump(clean, f, separators=(",", ":"))  # compact JSON
    size_mb = filepath.stat().st_size / (1024 * 1024)
    print(f"  Saved {filename} ({size_mb:.1f} MB)")


def process_signal_doc(doc_df):
    """Process signal documentation into a clean dictionary."""
    signals = []
    for _, row in doc_df.iterrows():
        signal = {}
        for col in doc_df.columns:
            val = row[col]
            if pd.isna(val):
                signal[col] = None
            elif isinstance(val, (np.integer,)):
                signal[col] = int(val)
            elif isinstance(val, (np.floating,)):
                signal[col] = round(float(val), 6)
            else:
                signal[col] = str(val)
        signals.append(signal)
    return signals


def main():
    parser = argparse.ArgumentParser(description="Download Open Asset Pricing data")
    parser.add_argument("--port-types", nargs="+", default=["op"],
                        help="Portfolio types to download (op, deciles_ew, deciles_vw, quintiles_ew, quintiles_vw)")
    parser.add_argument("--skip-download", action="store_true",
                        help="Skip download, use cached data")
    args = parser.parse_args()

    ensure_dirs()

    # Download or load data
    for port_type in args.port_types:
        cache_file = CACHE_DIR / f"returns_{port_type}.parquet"

        if args.skip_download and cache_file.exists():
            print(f"Loading cached {port_type} returns...")
            raw_df = pd.read_parquet(cache_file)
        else:
            raw_df = download_portfolio_returns(port_type)
            raw_df.to_parquet(cache_file)
            print(f"  Cached to {cache_file}")

        # Process returns
        returns_df = process_monthly_returns(raw_df)
        print(f"  Processed: {returns_df.shape[0]} dates x {returns_df.shape[1]} factors")

        # Save monthly returns (compact: just dates + values per factor)
        monthly_data = {}
        for col in returns_df.columns:
            series = returns_df[col].dropna()
            dates = [d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d) for d in series.index]
            monthly_data[col] = {
                "dates": dates,
                "values": [round(float(v), 6) for v in series.values],
            }
        save_json(monthly_data, f"monthly_returns_{port_type}.json")

        # Compute and save stats
        print("Computing factor statistics...")
        stats = compute_factor_stats(returns_df)
        save_json(stats, f"factor_stats_{port_type}.json")

        # Compute cumulative returns
        print("Computing cumulative returns...")
        cum_returns = compute_cumulative_returns(returns_df)
        save_json(cum_returns, f"cumulative_returns_{port_type}.json")

        # Compute drawdowns
        print("Computing drawdowns...")
        drawdowns = compute_drawdowns(returns_df)
        save_json(drawdowns, f"drawdowns_{port_type}.json")

        # Compute annual returns
        print("Computing annual returns...")
        annual = compute_annual_returns(returns_df)
        save_json(annual, f"annual_returns_{port_type}.json")

        # Correlation matrix (top 50 factors)
        print("Computing correlation matrix...")
        corr = compute_correlation_matrix(returns_df, top_n=50)
        save_json(corr, f"correlation_{port_type}.json")

    # Download signal documentation
    doc_cache = CACHE_DIR / "signal_doc.parquet"
    if args.skip_download and doc_cache.exists():
        print("Loading cached signal documentation...")
        doc_df = pd.read_parquet(doc_cache)
    else:
        doc_df = download_signal_doc()
        doc_df.to_parquet(doc_cache)

    signals = process_signal_doc(doc_df)
    save_json(signals, "signal_doc.json")

    # Save metadata
    metadata = {
        "last_updated": datetime.now().isoformat(),
        "port_types": args.port_types,
        "n_factors": len(returns_df.columns) if 'returns_df' in dir() else 0,
        "source": "openassetpricing.com",
        "version": "2.0.0",
    }
    save_json(metadata, "metadata.json")

    print("\nDone! All data saved to", OUTPUT_DIR)


if __name__ == "__main__":
    main()
