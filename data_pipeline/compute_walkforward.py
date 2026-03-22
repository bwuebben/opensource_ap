#!/usr/bin/env python3
"""
Walk-forward optimized multi-factor portfolio.

At each year-end, uses an expanding window of all available history to find
optimal factor weights (max Sharpe or max return), then applies those weights
out-of-sample for the next year.

Requires at least 60 months (5 years) of data per factor to include it.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import minimize

PROJECT_DIR = Path(__file__).parent.parent
DATA_DIR = PROJECT_DIR / "dashboard" / "public" / "data"

MIN_MONTHS = 60  # 5 years minimum history
MAX_WEIGHT = 0.10  # max 10% per factor to avoid concentration


def load_returns():
    """Load monthly factor returns into a DataFrame."""
    monthly = json.load(open(DATA_DIR / "monthly_returns_op.json"))

    # Build DataFrame
    all_dates = set()
    for f, ts in monthly.items():
        all_dates.update(ts["dates"])
    all_dates = sorted(all_dates)

    df = pd.DataFrame(index=pd.to_datetime(all_dates))
    for f, ts in monthly.items():
        s = pd.Series(ts["values"], index=pd.to_datetime(ts["dates"]), name=f)
        df[f] = s

    df = df.sort_index()
    return df


def optimize_max_sharpe(mu, cov, n_assets, max_weight):
    """Find weights that maximize Sharpe ratio (long-only, sum-to-1)."""
    def neg_sharpe(w):
        port_ret = w @ mu
        port_vol = np.sqrt(w @ cov @ w)
        if port_vol < 1e-10:
            return 0
        return -port_ret / port_vol

    # Constraints: weights sum to 1
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
    bounds = [(0, max_weight)] * n_assets

    # Initial: equal weight
    w0 = np.ones(n_assets) / n_assets

    result = minimize(
        neg_sharpe, w0, method="SLSQP",
        bounds=bounds, constraints=constraints,
        options={"maxiter": 1000, "ftol": 1e-12},
    )

    if result.success:
        return result.x
    else:
        # Fallback to equal weight
        return np.ones(n_assets) / n_assets


def optimize_max_return(mu, cov, n_assets, max_weight):
    """Find weights that maximize expected return (long-only, sum-to-1)."""
    def neg_return(w):
        return -(w @ mu)

    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
    bounds = [(0, max_weight)] * n_assets

    w0 = np.ones(n_assets) / n_assets

    result = minimize(
        neg_return, w0, method="SLSQP",
        bounds=bounds, constraints=constraints,
        options={"maxiter": 1000, "ftol": 1e-12},
    )

    if result.success:
        return result.x
    else:
        return np.ones(n_assets) / n_assets


def run_walkforward(returns_df, objective="sharpe"):
    """
    Walk-forward optimization.

    At each year-end, optimize weights using expanding window,
    then apply out-of-sample for the next year.
    """
    optimize_fn = optimize_max_sharpe if objective == "sharpe" else optimize_max_return

    # Get year boundaries
    returns_df.index = pd.to_datetime(returns_df.index)
    years = sorted(returns_df.index.year.unique())

    # We need at least 5 years of lookback, so first OOS year is min_year + 5
    min_year = years[0]
    first_oos_year = min_year + 5

    results = {
        "oos_dates": [],
        "oos_returns": [],
        "weights_history": [],  # list of {year, weights: {factor: weight}}
        "n_factors_history": [],
        "lookback_sharpe_history": [],
    }

    for oos_year in range(first_oos_year, years[-1] + 1):
        # Lookback: all data before this year
        lookback = returns_df[returns_df.index.year < oos_year]

        # Filter to factors with at least MIN_MONTHS of data in lookback
        valid_counts = lookback.notna().sum()
        valid_factors = valid_counts[valid_counts >= MIN_MONTHS].index.tolist()

        if len(valid_factors) < 2:
            print(f"  {oos_year}: Only {len(valid_factors)} factors with enough data, skipping")
            continue

        # Get lookback returns for valid factors, drop NaN rows
        lb_ret = lookback[valid_factors].dropna(how="all")

        # Fill remaining NaNs with 0 (factor not yet available)
        lb_ret = lb_ret.fillna(0)

        # Compute mean and covariance
        mu = lb_ret.mean().values
        cov = lb_ret.cov().values

        # Add small ridge to covariance for numerical stability
        cov += np.eye(len(valid_factors)) * 1e-8

        n = len(valid_factors)

        # Dynamic max weight: at least equal weight, but capped
        dynamic_max = max(MAX_WEIGHT, 1.5 / n)

        # Optimize
        weights = optimize_fn(mu, cov, n, dynamic_max)

        # Compute in-sample Sharpe for diagnostics
        lb_port_ret = lb_ret.values @ weights
        lb_sharpe = lb_port_ret.mean() / lb_port_ret.std() * np.sqrt(12) if lb_port_ret.std() > 0 else 0

        # OOS: get next year's returns
        oos_data = returns_df[returns_df.index.year == oos_year][valid_factors].fillna(0)

        if len(oos_data) == 0:
            continue

        # Compute OOS portfolio returns
        oos_port_ret = oos_data.values @ weights

        # Record
        for i, (date, ret) in enumerate(zip(oos_data.index, oos_port_ret)):
            results["oos_dates"].append(date.strftime("%Y-%m-%d"))
            results["oos_returns"].append(round(float(ret), 8))

        # Record weights (top 20 by weight for readability)
        weight_dict = dict(zip(valid_factors, weights))
        top_weights = dict(sorted(weight_dict.items(), key=lambda x: -x[1])[:30])
        results["weights_history"].append({
            "year": int(oos_year),
            "n_factors": len(valid_factors),
            "lookback_sharpe": round(float(lb_sharpe), 4),
            "weights": {k: round(float(v), 6) for k, v in top_weights.items()},
            "all_weights": {k: round(float(v), 6) for k, v in weight_dict.items() if v > 0.001},
        })

        n_nonzero = sum(1 for w in weights if w > 0.001)
        print(
            f"  {oos_year}: {len(valid_factors)} factors eligible, "
            f"{n_nonzero} with weight > 0.1%, "
            f"lookback SR={lb_sharpe:.3f}, "
            f"OOS mean={np.mean(oos_port_ret)*100:.3f}%/mo"
        )

    return results


def compute_stats(returns):
    """Compute portfolio statistics from return series."""
    vals = np.array(returns)
    n = len(vals)
    if n < 2:
        return {}

    mean = vals.mean()
    std = vals.std()
    ann_vol = std * np.sqrt(12)

    cum = np.cumprod(1 + vals)
    total_ret = cum[-1] - 1
    n_years = n / 12
    ann_ret = (1 + total_ret) ** (1 / n_years) - 1 if total_ret > -1 else -1
    sharpe = ann_ret / ann_vol if ann_vol > 0 else 0
    t_stat = mean / (std / np.sqrt(n)) if std > 0 else 0

    peak = np.maximum.accumulate(cum)
    dd = (cum - peak) / peak
    max_dd = dd.min()

    # Skewness & kurtosis
    skew = ((vals - mean) / std) ** 3
    kurt = ((vals - mean) / std) ** 4

    return {
        "n_months": int(n),
        "ann_return": round(float(ann_ret), 6),
        "ann_volatility": round(float(ann_vol), 6),
        "sharpe_ratio": round(float(sharpe), 4),
        "t_stat": round(float(t_stat), 4),
        "total_return": round(float(total_ret), 6),
        "max_drawdown": round(float(max_dd), 6),
        "pct_positive": round(float((vals > 0).mean()), 4),
        "best_month": round(float(vals.max()), 6),
        "worst_month": round(float(vals.min()), 6),
        "mean_monthly": round(float(mean), 8),
        "skewness": round(float(skew.mean()), 4),
        "kurtosis": round(float(kurt.mean() - 3), 4),
        "calmar": round(float(ann_ret / abs(max_dd)) if max_dd != 0 else 0, 4),
    }


def save(data, name):
    """Save JSON with inf/nan sanitization."""
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


def main():
    print("Loading factor returns...")
    returns_df = load_returns()
    print(f"  {returns_df.shape[1]} factors, {returns_df.shape[0]} months")

    # Run both objectives
    for objective in ["sharpe", "return"]:
        print(f"\n=== Walk-forward: maximize {objective} ===")
        results = run_walkforward(returns_df, objective=objective)

        # Compute cumulative returns
        cum = []
        c = 1
        for r in results["oos_returns"]:
            c *= 1 + r
            cum.append(round(c, 6))

        # Compute drawdown
        dd = []
        peak = 0
        for c_val in cum:
            if c_val > peak:
                peak = c_val
            dd.append(round((c_val - peak) / peak, 6))

        # Annual OOS returns
        annual = {}
        for date, ret in zip(results["oos_dates"], results["oos_returns"]):
            year = int(date[:4])
            if year not in annual:
                annual[year] = []
            annual[year].append(ret)

        annual_returns = {}
        for year in sorted(annual.keys()):
            ann = 1
            for r in annual[year]:
                ann *= 1 + r
            annual_returns[year] = round(ann - 1, 6)

        stats = compute_stats(results["oos_returns"])

        output = {
            "objective": objective,
            "dates": results["oos_dates"],
            "returns": results["oos_returns"],
            "cumulative": cum,
            "drawdown": dd,
            "annual_returns": {
                "years": list(annual_returns.keys()),
                "values": list(annual_returns.values()),
            },
            "weights_history": results["weights_history"],
            "stats": stats,
        }

        save(output, f"walkforward_{objective}.json")

    # Also compute an equal-weight (1/N) benchmark across ALL factors
    print("\n=== Equal-weight (1/N) benchmark ===")
    ew_ret = returns_df.mean(axis=1).dropna()
    # Align to same period as walkforward
    wf = json.load(open(DATA_DIR / "walkforward_sharpe.json"))
    start_date = wf["dates"][0]
    ew_ret = ew_ret[ew_ret.index >= start_date]

    ew_cum = []
    c = 1
    for r in ew_ret.values:
        c *= 1 + r
        ew_cum.append(round(c, 6))

    ew_dd = []
    peak = 0
    for c_val in ew_cum:
        if c_val > peak:
            peak = c_val
        ew_dd.append(round((c_val - peak) / peak, 6))

    ew_stats = compute_stats(ew_ret.values.tolist())
    ew_dates = [d.strftime("%Y-%m-%d") for d in ew_ret.index]

    save({
        "objective": "equal_weight",
        "dates": ew_dates,
        "returns": [round(float(v), 8) for v in ew_ret.values],
        "cumulative": ew_cum,
        "drawdown": ew_dd,
        "stats": ew_stats,
    }, "walkforward_equal_weight.json")

    print("\nDone!")


if __name__ == "__main__":
    main()
