#!/usr/bin/env python3
"""Compute research analytics from factor data and save JSON files."""

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path("/Users/bwuebben/opensource_ap/dashboard/public/data")
OUTPUT_DIR = DATA_DIR  # save alongside existing files


def load_json(name):
    with open(DATA_DIR / name) as f:
        return json.load(f)


def sanitize(obj):
    """Recursively replace inf/nan with None."""
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return round(obj, 6)
    if isinstance(obj, (np.floating, np.float64, np.float32)):
        v = float(obj)
        if math.isnan(v) or math.isinf(v):
            return None
        return round(v, 6)
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    return obj


def save_json(data, name):
    data = sanitize(data)
    with open(OUTPUT_DIR / name, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"  Saved {name} ({(OUTPUT_DIR / name).stat().st_size:,} bytes)")


def build_returns_df(monthly_returns):
    """Build a DataFrame: rows=dates, cols=factors, values=monthly returns."""
    series = {}
    for factor, fdata in monthly_returns.items():
        dates = pd.to_datetime(fdata["dates"])
        vals = pd.Series(fdata["values"], index=dates, dtype=float)
        series[factor] = vals
    df = pd.DataFrame(series)
    df.index.name = "date"
    df = df.sort_index()
    return df


# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------
print("Loading data...")
monthly_returns = load_json("monthly_returns_op.json")
factor_stats = load_json("factor_stats_op.json")
signal_doc = load_json("signal_doc.json")

# Build lookup: acronym -> signal_doc entry
sig_lookup = {}
for entry in signal_doc:
    sig_lookup[entry["Acronym"]] = entry

# Build returns DataFrame
print("Building returns DataFrame...")
returns_df = build_returns_df(monthly_returns)
print(f"  {returns_df.shape[1]} factors, {returns_df.shape[0]} months")

# ---------------------------------------------------------------------------
# 1. Post-Publication Decay
# ---------------------------------------------------------------------------
print("\n1. Computing post-publication decay...")

decay_factors = []
for acronym in returns_df.columns:
    doc = sig_lookup.get(acronym)
    if doc is None:
        continue
    pub_year_raw = doc.get("Year")
    if pub_year_raw is None or str(pub_year_raw).strip() == "":
        continue
    try:
        pub_year = int(pub_year_raw)
    except (ValueError, TypeError):
        continue

    cat_economic = doc.get("Cat.Economic", "")
    ser = returns_df[acronym].dropna()
    if len(ser) < 24:
        continue

    # Use year-month from index
    pub_date = pd.Timestamp(year=pub_year, month=1, day=1)
    pre = ser[ser.index < pub_date]
    post = ser[ser.index >= pub_date]

    def calc_stats(s):
        if len(s) < 12:
            return None, None, None, len(s)
        mean_m = s.mean()
        std_m = s.std()
        sharpe = (mean_m / std_m * np.sqrt(12)) if std_m > 0 else None
        tstat = (mean_m / (std_m / np.sqrt(len(s)))) if std_m > 0 else None
        return sharpe, mean_m, tstat, len(s)

    pre_sharpe, pre_mean, pre_tstat, pre_months = calc_stats(pre)
    post_sharpe, post_mean, post_tstat, post_months = calc_stats(post)

    decay_ratio = None
    if pre_sharpe is not None and post_sharpe is not None and pre_sharpe != 0:
        decay_ratio = post_sharpe / pre_sharpe

    decay_factors.append({
        "acronym": acronym,
        "pub_year": pub_year,
        "pre_sharpe": pre_sharpe,
        "post_sharpe": post_sharpe,
        "pre_mean": pre_mean,
        "post_mean": post_mean,
        "pre_tstat": pre_tstat,
        "post_tstat": post_tstat,
        "pre_months": pre_months,
        "post_months": post_months,
        "decay_ratio": decay_ratio,
        "cat_economic": cat_economic,
    })

# Aggregate stats
decay_by_cat = {}
for f in decay_factors:
    cat = f["cat_economic"] or "unknown"
    if f["decay_ratio"] is not None:
        decay_by_cat.setdefault(cat, []).append(f["decay_ratio"])
decay_by_cat_avg = {k: float(np.mean(v)) for k, v in decay_by_cat.items()}

decay_by_decade = {}
for f in decay_factors:
    decade = (f["pub_year"] // 10) * 10
    if f["decay_ratio"] is not None:
        decay_by_decade.setdefault(str(decade), []).append(f["decay_ratio"])
decay_by_decade_avg = {k: float(np.mean(v)) for k, v in decay_by_decade.items()}

post_pub_decay = {
    "factors": decay_factors,
    "avg_decay_by_category": decay_by_cat_avg,
    "avg_decay_by_decade": decay_by_decade_avg,
}
save_json(post_pub_decay, "post_pub_decay.json")
print(f"  {len(decay_factors)} factors with pub year")

# ---------------------------------------------------------------------------
# 2. Crisis/Regime Performance
# ---------------------------------------------------------------------------
print("\n2. Computing crisis performance...")

CRISES = [
    ("Great Depression", "1929-10", "1932-06"),
    ("Oil Crisis", "1973-10", "1974-09"),
    ("Black Monday", "1987-10", "1987-11"),
    ("LTCM/Russian", "1998-07", "1998-10"),
    ("Dot-com Crash", "2000-03", "2002-10"),
    ("Quant Quake", "2007-08", "2007-08"),
    ("GFC", "2008-01", "2009-03"),
    ("COVID", "2020-02", "2020-04"),
    ("2022 Rate Shock", "2022-01", "2022-10"),
]

# Convert index to year-month strings for slicing
ym_index = returns_df.index.to_period("M")

crisis_list = []
factor_returns_by_crisis = {}

for crisis_name, start, end in CRISES:
    crisis_list.append({"name": crisis_name, "start": start, "end": end})

    start_p = pd.Period(start, freq="M")
    end_p = pd.Period(end, freq="M")
    mask = (ym_index >= start_p) & (ym_index <= end_p)
    window = returns_df.loc[mask]

    crisis_results = {}
    for factor in returns_df.columns:
        rets = window[factor].dropna()
        if len(rets) < 1:
            continue
        # Total return = product of (1+r) - 1
        total_ret = float((1 + rets).prod() - 1)
        # Annualized vol
        ann_vol = float(rets.std() * np.sqrt(12)) if len(rets) > 1 else None
        crisis_results[factor] = {
            "total_return": total_ret,
            "ann_vol": ann_vol,
        }

    factor_returns_by_crisis[crisis_name] = crisis_results

crisis_performance = {
    "crises": crisis_list,
    "factor_returns": factor_returns_by_crisis,
}
save_json(crisis_performance, "crisis_performance.json")
print(f"  {len(CRISES)} crises computed")

# ---------------------------------------------------------------------------
# 3. Rolling Correlations / Crowding
# ---------------------------------------------------------------------------
print("\n3. Computing rolling correlations (top 30 by Sharpe)...")

# Get top 30 factors by Sharpe
sharpe_vals = []
for name, stats in factor_stats.items():
    sr = stats.get("sharpe_ratio")
    if sr is not None:
        sharpe_vals.append((name, sr))
sharpe_vals.sort(key=lambda x: x[1], reverse=True)
top30 = [x[0] for x in sharpe_vals[:30]]

# Subset returns
top30_rets = returns_df[top30].copy()
n_factors = len(top30)

# Rolling 36-month pairwise correlation average
window = 36
dates_out = []
avg_corr_out = []

for i in range(window - 1, len(top30_rets)):
    block = top30_rets.iloc[i - window + 1 : i + 1]
    # Only use factors with enough data in this window
    valid_cols = block.columns[block.notna().sum() >= window // 2]
    if len(valid_cols) < 2:
        continue
    corr_mat = block[valid_cols].corr()
    # Average of off-diagonal elements
    n = len(valid_cols)
    mask_upper = np.triu(np.ones((n, n), dtype=bool), k=1)
    avg_c = float(corr_mat.values[mask_upper].mean())
    dates_out.append(top30_rets.index[i].strftime("%Y-%m-%d"))
    avg_corr_out.append(avg_c)

rolling_corr = {
    "dates": dates_out,
    "avg_correlation": avg_corr_out,
    "top_factors": top30,
}
save_json(rolling_corr, "rolling_correlations.json")
print(f"  {len(dates_out)} monthly observations")

# ---------------------------------------------------------------------------
# 4. Factor Momentum
# ---------------------------------------------------------------------------
print("\n4. Computing factor momentum...")

all_factors = returns_df.columns.tolist()
n_all = len(all_factors)
quintile_size = max(1, n_all // 5)

fm_dates = []
ls_returns = []
lo_returns = []
zw_returns = []  # z-score weighted L/S
zw_lo_returns = []  # z-score weighted long-only

# Need 12-month lookback + 1 month forward
for i in range(12, len(returns_df) - 1):
    lookback = returns_df.iloc[i - 12 : i]
    # Trailing 12-month return for each factor (cumulative)
    trail_ret = (1 + lookback).prod() - 1  # per factor
    # Drop factors with NaN trailing return
    trail_ret = trail_ret.dropna()
    if len(trail_ret) < 10:
        continue

    n_q = max(1, len(trail_ret) // 5)
    ranked = trail_ret.sort_values()
    bottom_factors = ranked.index[:n_q].tolist()
    top_factors = ranked.index[-n_q:].tolist()

    # Next month return
    next_month = returns_df.iloc[i]

    top_ret = next_month[top_factors].dropna()
    bottom_ret = next_month[bottom_factors].dropna()

    if len(top_ret) == 0:
        continue

    lo_ret = float(top_ret.mean())
    ls_ret = float(top_ret.mean() - bottom_ret.mean()) if len(bottom_ret) > 0 else lo_ret

    # Z-score weighted portfolio: weight = zscore, normalized to leverage 1
    mu = trail_ret.mean()
    sigma = trail_ret.std()
    if sigma > 0:
        zscores = (trail_ret - mu) / sigma
        # Normalize so sum of |weights| = 1
        abs_sum = zscores.abs().sum()
        weights = zscores / abs_sum if abs_sum > 0 else zscores * 0
        # Portfolio return = sum(weight_i * next_month_return_i)
        common = weights.index.intersection(next_month.dropna().index)
        if len(common) > 0:
            w = weights[common]
            # Re-normalize after dropping missing factors
            abs_sum2 = w.abs().sum()
            if abs_sum2 > 0:
                w = w / abs_sum2
            zw_ret = float((w * next_month[common]).sum())
            # Long-only: only positive z-score factors, normalized to sum to 1
            w_long = w[w > 0]
            if len(w_long) > 0:
                w_long = w_long / w_long.sum()
                zw_lo_ret = float((w_long * next_month[w_long.index]).sum())
            else:
                zw_lo_ret = 0.0
        else:
            zw_ret = 0.0
            zw_lo_ret = 0.0
    else:
        zw_ret = 0.0
        zw_lo_ret = 0.0

    fm_dates.append(returns_df.index[i].strftime("%Y-%m-%d"))
    ls_returns.append(ls_ret)
    lo_returns.append(lo_ret)
    zw_returns.append(zw_ret)
    zw_lo_returns.append(zw_lo_ret)

# Cumulative returns
cum_ls = list(np.cumprod(1 + np.array(ls_returns)) - 1)
cum_lo = list(np.cumprod(1 + np.array(lo_returns)) - 1)
cum_zw = list(np.cumprod(1 + np.array(zw_returns)) - 1)
cum_zw_lo = list(np.cumprod(1 + np.array(zw_lo_returns)) - 1)

ls_arr = np.array(ls_returns)
lo_arr = np.array(lo_returns)
zw_arr = np.array(zw_returns)
zw_lo_arr = np.array(zw_lo_returns)


def quick_stats(r):
    if len(r) == 0:
        return {}
    mean_m = float(np.mean(r))
    std_m = float(np.std(r, ddof=1))
    sharpe = mean_m / std_m * np.sqrt(12) if std_m > 0 else None
    tstat = mean_m / (std_m / np.sqrt(len(r))) if std_m > 0 else None
    # Max drawdown
    cum = np.cumprod(1 + np.array(r))
    peak = np.maximum.accumulate(cum)
    dd = (cum - peak) / peak
    max_dd = float(np.min(dd)) if len(dd) > 0 else None
    # Pct positive months
    pct_pos = float(np.mean(np.array(r) > 0))
    return {
        "mean_monthly": mean_m,
        "ann_return": mean_m * 12,
        "ann_vol": std_m * np.sqrt(12),
        "ann_volatility": std_m * np.sqrt(12),
        "sharpe": sharpe,
        "sharpe_ratio": sharpe,
        "t_stat": tstat,
        "n_months": len(r),
        "max_drawdown": max_dd,
        "pct_positive": pct_pos,
    }


factor_momentum = {
    "dates": fm_dates,
    "long_short_returns": ls_returns,
    "long_only_returns": lo_returns,
    "zscore_weighted_returns": zw_returns,
    "zscore_weighted_lo_returns": zw_lo_returns,
    "cumulative_ls": cum_ls,
    "cumulative_lo": cum_lo,
    "cumulative_zw": cum_zw,
    "cumulative_zw_lo": cum_zw_lo,
    "stats_ls": quick_stats(ls_arr),
    "stats_lo": quick_stats(lo_arr),
    "stats_zw": quick_stats(zw_arr),
    "stats_zw_lo": quick_stats(zw_lo_arr),
}
save_json(factor_momentum, "factor_momentum.json")
print(f"  {len(fm_dates)} months of factor momentum")

# ---------------------------------------------------------------------------
# 5. Tail Risk
# ---------------------------------------------------------------------------
print("\n5. Computing tail risk...")

tail_risk = {}

for factor in returns_df.columns:
    ser = returns_df[factor].dropna()
    if len(ser) < 24:
        continue

    arr = ser.values

    # VaR and CVaR
    var_95 = float(np.percentile(arr, 5))
    below_var = arr[arr <= var_95]
    cvar_95 = float(np.mean(below_var)) if len(below_var) > 0 else var_95

    # Drawdowns: compute cumulative wealth
    wealth = np.cumprod(1 + arr)
    peak = np.maximum.accumulate(wealth)
    dd = (wealth - peak) / peak  # drawdown series (negative values)

    # Find drawdown episodes
    # An episode: from when dd starts going negative to when it recovers to 0
    episodes = []
    in_dd = False
    ep_start = 0
    trough_idx = 0
    trough_val = 0.0

    for j in range(len(dd)):
        if dd[j] < 0 and not in_dd:
            in_dd = True
            ep_start = j
            trough_idx = j
            trough_val = dd[j]
        elif dd[j] < trough_val and in_dd:
            trough_idx = j
            trough_val = dd[j]
        elif dd[j] >= 0 and in_dd:
            in_dd = False
            episodes.append({
                "start_idx": ep_start,
                "trough_idx": trough_idx,
                "end_idx": j,
                "depth": float(trough_val),
                "duration": j - ep_start,
            })

    # If still in drawdown at end
    if in_dd:
        episodes.append({
            "start_idx": ep_start,
            "trough_idx": trough_idx,
            "end_idx": len(dd) - 1,
            "depth": float(trough_val),
            "duration": len(dd) - 1 - ep_start,
        })

    # Sort by depth (most negative first)
    episodes.sort(key=lambda x: x["depth"])

    max_dd = float(dd.min())
    max_dd_dur = max((e["duration"] for e in episodes), default=0) if episodes else 0

    dates_list = ser.index.tolist()
    worst_3 = []
    for ep in episodes[:3]:
        worst_3.append({
            "start": dates_list[ep["start_idx"]].strftime("%Y-%m-%d"),
            "trough": dates_list[ep["trough_idx"]].strftime("%Y-%m-%d"),
            "end": dates_list[ep["end_idx"]].strftime("%Y-%m-%d"),
            "depth": ep["depth"],
        })

    tail_risk[factor] = {
        "var_95": var_95,
        "cvar_95": cvar_95,
        "max_dd": max_dd,
        "max_dd_duration_months": max_dd_dur,
        "worst_episodes": worst_3,
    }

save_json({"factors": tail_risk}, "tail_risk.json")
print(f"  {len(tail_risk)} factors computed")

print("\nDone!")
