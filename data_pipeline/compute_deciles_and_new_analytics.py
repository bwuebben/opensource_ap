"""
Compute decile-based analytics and new factor research outputs.

Steps:
1. Download decile portfolio returns
2. Long vs Short Leg Decomposition
3. Decade-by-Decade Performance
4. Factor Seasonality
5. What Worked Recently
6. Factor Timing
7. Replication Tracker
"""

import json
import math
import os
import numpy as np
import pandas as pd

DATA_DIR = "/Users/bwuebben/opensource_ap/dashboard/public/data"
CACHE_DIR = "/Users/bwuebben/opensource_ap/data_pipeline/cache"


def sanitize(obj):
    """Recursively replace inf/nan with None for JSON serialization."""
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return round(obj, 6)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        if math.isnan(v) or math.isinf(v):
            return None
        return round(v, 6)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    return obj


def save_json(data, filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w") as f:
        json.dump(sanitize(data), f, separators=(",", ":"))
    print(f"  Saved {filename}")


def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path) as f:
        return json.load(f)


def ann_ret(returns_series):
    """Annualized return from monthly decimal returns."""
    r = returns_series.dropna()
    if len(r) < 12:
        return np.nan
    cum = (1 + r).prod()
    n_years = len(r) / 12.0
    if cum <= 0:
        return np.nan
    return cum ** (1.0 / n_years) - 1


def ann_sharpe(returns_series):
    """Annualized Sharpe from monthly decimal returns."""
    r = returns_series.dropna()
    if len(r) < 12:
        return np.nan
    mu = r.mean()
    sigma = r.std()
    if sigma == 0:
        return np.nan
    return (mu / sigma) * np.sqrt(12)


# ── Step 1: Download decile portfolio returns ──
print("Step 1: Downloading decile portfolio returns...")
cache_path = os.path.join(CACHE_DIR, "returns_deciles_ew.parquet")
if os.path.exists(cache_path):
    print("  Loading from cache...")
    df = pd.read_parquet(cache_path)
else:
    import openassetpricing as oap
    openap = oap.OpenAP()
    df = openap.dl_port("deciles_ew", "pandas")
    df.to_parquet(cache_path, index=False)
    print("  Cached to parquet.")

# Convert percentage returns to decimals
df["ret"] = df["ret"] / 100.0
df["date"] = pd.to_datetime(df["date"])
print(f"  Shape: {df.shape}, factors: {df['signalname'].nunique()}, date range: {df['date'].min()} to {df['date'].max()}")

factors_all = sorted(df["signalname"].unique())

# ── Step 2: Long vs Short Leg Decomposition ──
print("\nStep 2: Long vs Short Leg Decomposition...")
decomp = {}
for fac in factors_all:
    fd = df[df["signalname"] == fac]
    long_ret = fd.loc[fd["port"] == "10", "ret"]
    short_ret = fd.loc[fd["port"] == "01", "ret"]
    ls_ret = fd.loc[fd["port"] == "LS", "ret"]

    long_ann = ann_ret(long_ret)
    short_ann = ann_ret(short_ret)
    ls_ann = ann_ret(ls_ret)

    # Long pct of LS: fraction of LS return attributable to long side
    # Long contributes its excess return, short contributes negative of its return
    # Approximate: long_ann / (long_ann + abs(short_ann)) if signs make sense
    # More precisely: LS = Long - Short, so long_pct = long_ann / ls_ann if ls_ann != 0
    # But that's not quite right either. We just report what fraction of the mean monthly
    # LS return is from the long side mean.
    long_mean = long_ret.mean() if len(long_ret) > 0 else np.nan
    short_mean = short_ret.mean() if len(short_ret) > 0 else np.nan
    ls_mean = ls_ret.mean() if len(ls_ret) > 0 else np.nan

    if ls_mean and ls_mean != 0 and not np.isnan(ls_mean):
        # LS = Long - Short, so long contribution = long_mean, short contribution = -short_mean
        # long_pct = long_mean / (long_mean + (-short_mean)) but only if denominator > 0
        # Actually simpler: long_pct = long_mean / ls_mean (but ls_mean = long_mean - short_mean)
        # We want: what fraction of the LS return comes from the long side being positive
        # vs the short side being negative.
        # If both contribute positively to LS: long_pct = long_mean / (long_mean - short_mean)
        # This equals long_mean / ls_mean
        long_pct = long_mean / ls_mean if abs(ls_mean) > 1e-10 else np.nan
    else:
        long_pct = np.nan

    decomp[fac] = {
        "long_ann_ret": long_ann,
        "long_sharpe": ann_sharpe(long_ret),
        "short_ann_ret": short_ann,
        "short_sharpe": ann_sharpe(short_ret),
        "ls_ann_ret": ls_ann,
        "ls_sharpe": ann_sharpe(ls_ret),
        "long_pct_of_ls": long_pct,
    }

save_json({"factors": decomp}, "long_short_decomp.json")

# ── Step 3: Decade-by-Decade Performance ──
print("\nStep 3: Decade-by-Decade Performance...")
ls_df = df[df["port"] == "LS"].copy()
ls_df["decade"] = (ls_df["date"].dt.year // 10 * 10).astype(str) + "s"
all_decades = sorted(ls_df["decade"].unique())

decade_data = {}
for fac in factors_all:
    fd = ls_df[ls_df["signalname"] == fac]
    dec_sharpes = {}
    for dec in all_decades:
        dd = fd[fd["decade"] == dec]["ret"]
        dec_sharpes[dec] = ann_sharpe(dd)
    decade_data[fac] = {"decades": dec_sharpes}

save_json({"decades": all_decades, "factors": decade_data}, "decade_performance.json")

# ── Step 4: Factor Seasonality ──
print("\nStep 4: Factor Seasonality...")
ls_df["month"] = ls_df["date"].dt.month

by_factor = {}
for fac in factors_all:
    fd = ls_df[ls_df["signalname"] == fac]
    monthly_avgs = []
    for m in range(1, 13):
        monthly_avgs.append(fd[fd["month"] == m]["ret"].mean())
    by_factor[fac] = monthly_avgs

# Cross-factor average by month
cross_factor = []
for m in range(1, 13):
    month_vals = [by_factor[f][m - 1] for f in factors_all if by_factor[f][m - 1] is not None and not (isinstance(by_factor[f][m - 1], float) and np.isnan(by_factor[f][m - 1]))]
    cross_factor.append(np.mean(month_vals) if month_vals else None)

save_json({
    "months": list(range(1, 13)),
    "by_factor": by_factor,
    "cross_factor": cross_factor,
}, "factor_seasonality.json")

# ── Step 5: What Worked Recently ──
print("\nStep 5: What Worked Recently...")
latest_date = ls_df["date"].max()
print(f"  Latest date: {latest_date.strftime('%Y-%m-%d')}")

recent = {}
for fac in factors_all:
    fd = ls_df[ls_df["signalname"] == fac].sort_values("date")
    if len(fd) == 0:
        continue
    fac_latest = fd["date"].max()
    fd_recent = fd.set_index("date")["ret"]

    def trailing_return(months):
        cutoff = fac_latest - pd.DateOffset(months=months)
        r = fd_recent[fd_recent.index > cutoff]
        if len(r) == 0:
            return np.nan
        return float((1 + r).prod() - 1)

    recent[fac] = {
        "ret_1m": trailing_return(1),
        "ret_3m": trailing_return(3),
        "ret_6m": trailing_return(6),
        "ret_12m": trailing_return(12),
    }

save_json({
    "as_of": latest_date.strftime("%Y-%m-%d"),
    "factors": recent,
}, "recent_performance.json")

# ── Step 6: Factor Timing ──
print("\nStep 6: Factor Timing...")
macro_series = load_json("macro_series.json")
style_comp = load_json("style_composition.json")
factor_stats = load_json("factor_stats_op.json")

# Prepare LS returns with YYYY-MM key
ls_df["ym"] = ls_df["date"].dt.to_period("M").astype(str)

# Macro variables to use
macro_vars_wanted = ["INDPRO", "UNRATE", "FEDFUNDS", "GS10", "TB3MS", "VIXCLS"]
# Also compute BAA-AAA spread
macro_vars_available = []
macro_frames = {}

for mv in macro_vars_wanted:
    if mv in macro_series:
        dates = macro_series[mv]["dates"]
        values = macro_series[mv]["values"]
        mdf = pd.DataFrame({"date": pd.to_datetime(dates), "value": values})
        mdf["ym"] = mdf["date"].dt.to_period("M").astype(str)
        # Take last value per month
        mdf = mdf.groupby("ym")["value"].last().reset_index()
        macro_frames[mv] = mdf
        macro_vars_available.append(mv)

# BAA-AAA spread
if "BAA" in macro_series and "AAA" in macro_series:
    baa_df = pd.DataFrame({"date": pd.to_datetime(macro_series["BAA"]["dates"]), "baa": macro_series["BAA"]["values"]})
    aaa_df = pd.DataFrame({"date": pd.to_datetime(macro_series["AAA"]["dates"]), "aaa": macro_series["AAA"]["values"]})
    baa_df["ym"] = baa_df["date"].dt.to_period("M").astype(str)
    aaa_df["ym"] = aaa_df["date"].dt.to_period("M").astype(str)
    baa_m = baa_df.groupby("ym")["baa"].last().reset_index()
    aaa_m = aaa_df.groupby("ym")["aaa"].last().reset_index()
    spread = baa_m.merge(aaa_m, on="ym")
    spread["value"] = spread["baa"] - spread["aaa"]
    macro_frames["BAA-AAA"] = spread[["ym", "value"]]
    macro_vars_available.append("BAA-AAA")

print(f"  Macro vars: {macro_vars_available}")

# Build factor -> style mapping
factor_to_style = {}
for style, facs in style_comp.items():
    for f in facs:
        factor_to_style[f] = style

# Top 30 factors by Sharpe
sorted_factors = sorted(factor_stats.items(), key=lambda x: abs(x[1].get("sharpe_ratio", 0)), reverse=True)
top30 = [f[0] for f in sorted_factors[:30]]

by_style_result = {}
by_factor_result = {}

for mv in macro_vars_available:
    mdf = macro_frames[mv]
    # Merge macro with factor returns
    merged = ls_df.merge(mdf, on="ym", how="inner")
    if len(merged) == 0:
        continue

    # Compute tercile cutoffs across all dates
    tercile_cuts = merged["value"].quantile([1/3, 2/3]).values
    merged["tercile"] = pd.cut(
        merged["value"],
        bins=[-np.inf, tercile_cuts[0], tercile_cuts[1], np.inf],
        labels=["low", "mid", "high"],
    )

    # By style
    style_tercile = {}
    for style in style_comp:
        style_facs = [f for f in style_comp[style] if f in factors_all]
        if not style_facs:
            continue
        style_data = merged[merged["signalname"].isin(style_facs)]
        t_sharpes = {}
        for t in ["low", "mid", "high"]:
            tdata = style_data[style_data["tercile"] == t]["ret"]
            t_sharpes[t] = ann_sharpe(tdata)
        style_tercile[style] = t_sharpes
    by_style_result[mv] = style_tercile

    # By factor (top 30)
    factor_tercile = {}
    for fac in top30:
        fac_data = merged[merged["signalname"] == fac]
        if len(fac_data) == 0:
            continue
        t_sharpes = {}
        for t in ["low", "mid", "high"]:
            tdata = fac_data[fac_data["tercile"] == t]["ret"]
            t_sharpes[t] = ann_sharpe(tdata)
        factor_tercile[fac] = t_sharpes
    by_factor_result[mv] = factor_tercile

save_json({
    "macro_vars": macro_vars_available,
    "by_style": by_style_result,
    "by_factor": by_factor_result,
}, "factor_timing.json")

# ── Step 7: Replication Tracker ──
print("\nStep 7: Replication Tracker...")
signal_doc = load_json("signal_doc.json")

# Build lookup from signal_doc
doc_lookup = {}
for entry in signal_doc:
    acr = entry.get("Acronym")
    if acr:
        doc_lookup[acr] = entry

replication_factors = []
n_sig_orig = 0
n_sig_repl = 0

for acr, stats in factor_stats.items():
    if acr not in doc_lookup:
        continue
    doc = doc_lookup[acr]

    orig_tstat_raw = doc.get("T-Stat")
    orig_ret_raw = doc.get("Return")

    if orig_tstat_raw is None or orig_ret_raw is None:
        continue

    try:
        orig_tstat = float(orig_tstat_raw)
        orig_ret = float(orig_ret_raw)
    except (ValueError, TypeError):
        continue

    repl_tstat = stats.get("t_stat")
    repl_sharpe = stats.get("sharpe_ratio")
    repl_ann_ret = stats.get("ann_return")

    if repl_tstat is None:
        continue

    tstat_ratio = repl_tstat / orig_tstat if orig_tstat != 0 else np.nan

    if abs(orig_tstat) >= 1.96:
        n_sig_orig += 1
    if abs(repl_tstat) >= 1.96:
        n_sig_repl += 1

    replication_factors.append({
        "acronym": acr,
        "original_tstat": orig_tstat,
        "original_return": orig_ret,
        "replicated_tstat": repl_tstat,
        "replicated_sharpe": repl_sharpe,
        "replicated_ann_return": repl_ann_ret,
        "quality": doc.get("Signal Rep Quality"),
        "predictability": doc.get("Predictability in OP"),
        "journal": doc.get("Journal"),
        "year": doc.get("Year"),
        "tstat_ratio": tstat_ratio,
    })

# Replication rate: of originally significant, how many remain significant
n_both_sig = sum(
    1 for f in replication_factors
    if abs(f["original_tstat"]) >= 1.96 and abs(f["replicated_tstat"]) >= 1.96
)
repl_rate = n_both_sig / n_sig_orig if n_sig_orig > 0 else np.nan

save_json({
    "factors": replication_factors,
    "summary": {
        "n_total": len(replication_factors),
        "n_significant_original": n_sig_orig,
        "n_significant_replicated": n_sig_repl,
        "replication_rate": repl_rate,
    },
}, "replication_tracker.json")

print("\nDone! All files saved.")
