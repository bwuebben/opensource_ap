#!/usr/bin/env python3
"""
Compute equal-weighted style factor returns by grouping individual factors
into style categories based on Cat.Economic from the signal documentation.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_DIR = Path(__file__).parent.parent
DATA_DIR = PROJECT_DIR / "dashboard" / "public" / "data"

# Map Cat.Economic categories to broader style groups
STYLE_MAP = {
    "Value": [
        "valuation",
        "long term reversal",
    ],
    "Momentum": [
        "momentum",
        "lead lag",
        "short-term reversal",
        "earnings event",
    ],
    "Quality": [
        "profitability",
        "profitability alt",
        "earnings growth",
        "earnings consistency",
    ],
    "Investment": [
        "investment",
        "investment alt",
        "investment growth",
    ],
    "Risk": [
        "risk",
        "market risk",
        "volatility",
        "default risk",
        "cash flow risk",
        "optionrisk",
    ],
    "Size": [
        "size",
    ],
    "Accruals": [
        "accruals",
        "composite accounting",
    ],
    "Liquidity": [
        "liquidity",
        "volume",
        "turnover",
    ],
    "Leverage & Financing": [
        "leverage",
        "external financing",
    ],
    "Analyst & Sentiment": [
        "earnings forecast",
        "recommendation",
        "info proxy",
        "short sale constraints",
    ],
    "Intangibles & Innovation": [
        "R&D",
        "asset composition",
    ],
    "Payout & Ownership": [
        "payout indicator",
        "ownership",
        "informed trading",
    ],
    "Sales Growth": [
        "sales growth",
    ],
}


def main():
    # Load signal doc to map acronyms to categories
    docs = json.load(open(DATA_DIR / "signal_doc.json"))
    acronym_to_cat = {}
    for d in docs:
        if d.get("Acronym") and d.get("Cat.Economic"):
            acronym_to_cat[d["Acronym"]] = d["Cat.Economic"]

    # Build reverse map: style -> list of factor acronyms
    cat_to_style = {}
    for style, cats in STYLE_MAP.items():
        for cat in cats:
            cat_to_style[cat] = style

    style_factors: dict[str, list[str]] = {s: [] for s in STYLE_MAP}
    unmapped_cats = set()
    for acronym, cat in acronym_to_cat.items():
        style = cat_to_style.get(cat)
        if style:
            style_factors[style].append(acronym)
        else:
            unmapped_cats.add(cat)

    if unmapped_cats:
        print(f"Unmapped categories (grouped under 'Other'): {unmapped_cats}")
        style_factors["Other"] = []
        for acronym, cat in acronym_to_cat.items():
            if cat in unmapped_cats:
                style_factors["Other"].append(acronym)

    # Print style composition
    for style, factors in sorted(style_factors.items()):
        print(f"  {style}: {len(factors)} factors")

    # Load monthly returns
    monthly = json.load(open(DATA_DIR / "monthly_returns_op.json"))

    # Build style return series
    style_returns: dict[str, dict] = {}
    style_composition: dict[str, list[str]] = {}

    for style, factors in style_factors.items():
        # Filter to factors that actually have return data
        available = [f for f in factors if f in monthly]
        if not available:
            print(f"  WARNING: No return data for style '{style}', skipping")
            continue

        style_composition[style] = sorted(available)

        # Build a DataFrame of all factor returns for this style
        # Find the union of all dates
        all_dates = set()
        for f in available:
            all_dates.update(monthly[f]["dates"])
        all_dates_sorted = sorted(all_dates)

        # Build matrix: rows=dates, cols=factors
        factor_data = {}
        for f in available:
            date_to_ret = dict(zip(monthly[f]["dates"], monthly[f]["values"]))
            factor_data[f] = [date_to_ret.get(d, None) for d in all_dates_sorted]

        df = pd.DataFrame(factor_data, index=all_dates_sorted)

        # Equal-weight average across available factors each month
        style_ret = df.mean(axis=1)  # nanmean by default

        # Drop dates where we have no data at all
        style_ret = style_ret.dropna()

        style_returns[style] = {
            "dates": style_ret.index.tolist(),
            "values": [round(float(v), 8) for v in style_ret.values],
        }

        print(f"  {style}: {len(available)} factors, {len(style_ret)} months of returns")

    # Compute cumulative returns
    style_cumulative = {}
    for style, data in style_returns.items():
        vals = np.array(data["values"])
        cum = np.cumprod(1 + vals)
        style_cumulative[style] = {
            "dates": data["dates"],
            "values": [round(float(v), 6) for v in cum],
        }

    # Compute style stats
    style_stats = {}
    for style, data in style_returns.items():
        vals = np.array(data["values"])
        n = len(vals)
        if n < 12:
            continue
        cum = np.cumprod(1 + vals)
        total_ret = cum[-1] - 1
        n_years = n / 12
        ann_ret = (1 + total_ret) ** (1 / n_years) - 1 if total_ret > -1 else -1
        ann_vol = vals.std() * np.sqrt(12)
        sharpe = ann_ret / ann_vol if ann_vol > 0 else 0
        t_stat = vals.mean() / (vals.std() / np.sqrt(n)) if vals.std() > 0 else 0

        rolling_max = np.maximum.accumulate(cum)
        drawdown = (cum - rolling_max) / rolling_max
        max_dd = drawdown.min()

        style_stats[style] = {
            "name": style,
            "n_factors": len(style_composition.get(style, [])),
            "n_months": int(n),
            "ann_return": round(float(ann_ret), 6),
            "ann_volatility": round(float(ann_vol), 6),
            "sharpe_ratio": round(float(sharpe), 4),
            "t_stat": round(float(t_stat), 4),
            "total_return": round(float(total_ret), 6),
            "max_drawdown": round(float(max_dd), 6),
            "pct_positive": round(float((vals > 0).mean()), 4),
            "mean_monthly": round(float(vals.mean()), 8),
            "best_month": round(float(vals.max()), 6),
            "worst_month": round(float(vals.min()), 6),
        }

    # Compute correlation matrix between styles
    # Build aligned DataFrame
    all_dates = set()
    for data in style_returns.values():
        all_dates.update(data["dates"])
    all_dates_sorted = sorted(all_dates)

    style_df = pd.DataFrame(index=all_dates_sorted)
    for style, data in style_returns.items():
        date_to_ret = dict(zip(data["dates"], data["values"]))
        style_df[style] = [date_to_ret.get(d, None) for d in all_dates_sorted]

    style_df = style_df.astype(float)
    corr = style_df.corr()
    style_names = list(corr.columns)

    correlation_data = {
        "factors": style_names,
        "matrix": [[round(float(v), 4) for v in row] for row in corr.values],
    }

    # Compute annual returns per style
    style_annual = {}
    for style, data in style_returns.items():
        df = pd.DataFrame({
            "ret": data["values"],
            "date": pd.to_datetime(data["dates"]),
        })
        df["year"] = df["date"].dt.year
        annual = df.groupby("year")["ret"].apply(lambda x: (1 + x).prod() - 1)
        style_annual[style] = {
            "years": annual.index.tolist(),
            "values": [round(float(v), 6) for v in annual.values],
        }

    # Compute rolling 12-month returns
    style_rolling = {}
    for style, data in style_returns.items():
        vals = np.array(data["values"])
        dates = data["dates"]
        if len(vals) < 12:
            continue
        rolling = []
        for i in range(11, len(vals)):
            r12 = np.prod(1 + vals[i-11:i+1]) - 1
            rolling.append(round(float(r12), 6))
        style_rolling[style] = {
            "dates": dates[11:],
            "values": rolling,
        }

    # Save everything
    def save(data, name):
        # Sanitize inf/nan
        def sanitize(obj):
            if isinstance(obj, float):
                if np.isinf(obj) or np.isnan(obj):
                    return None
                return obj
            if isinstance(obj, dict):
                return {k: sanitize(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [sanitize(v) for v in obj]
            return obj

        path = DATA_DIR / name
        with open(path, "w") as f:
            json.dump(sanitize(data), f, separators=(",", ":"))
        print(f"  Saved {name} ({path.stat().st_size / 1024:.0f} KB)")

    save(style_returns, "style_returns.json")
    save(style_cumulative, "style_cumulative.json")
    save(style_stats, "style_stats.json")
    save(correlation_data, "style_correlation.json")
    save(style_composition, "style_composition.json")
    save(style_annual, "style_annual.json")
    save(style_rolling, "style_rolling12m.json")

    print("\nDone!")


if __name__ == "__main__":
    main()
