export default function DataSources() {
  return (
    <div className="space-y-6 text-sm text-[#94a3b8] leading-relaxed max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold text-[#f1f5f9] mb-2">Data Sources & Processing</h2>
        <p>
          This dashboard combines two primary datasets: equity factor returns from the Open Asset Pricing
          project and macroeconomic time series from the FRED-MD database. This page explains where the
          data comes from, how it is processed, and any important caveats.
        </p>
      </div>

      {/* Factor Returns */}
      <section className="bg-[#1e293b] rounded-lg p-5 border border-[#334155] space-y-3">
        <h3 className="text-base font-semibold text-[#f1f5f9]">Equity Factor Returns</h3>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Source</h4>
          <p>
            <a href="https://www.openassetpricing.com/" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">
              openassetpricing.com
            </a> — Chen & Zimmermann (2022), "Open Source Cross-Sectional Asset Pricing,"
            {" "}<em>Critical Finance Review</em>. Data is accessed via the{" "}
            <code className="bg-[#0f172a] px-1 rounded text-[#e2e8f0]">openassetpricing</code> Python package.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">What It Contains</h4>
          <p>
            212 long-short equity factor portfolios with monthly returns. Each factor represents a published
            anomaly (e.g., Value, Momentum, Quality) where stocks are sorted into portfolios based on a
            predictive signal. The "return" is the spread between the top and bottom portfolios — what you
            would earn going long the predicted winners and short the predicted losers.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Portfolio Construction</h4>
          <p>
            All portfolios use the "OP" (original paper) methodology from Chen & Zimmermann, which
            standardizes construction across factors: stocks are sorted into quantile portfolios each month
            based on the signal, and returns are equal-weighted within each portfolio. The long-short return
            is the top quantile minus the bottom quantile.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Return Format</h4>
          <p>
            Raw returns from the source are in percentage form (e.g., 1.68 means 1.68%). The pipeline
            divides by 100 to convert to decimal form (0.0168) before computing any statistics. All returns
            displayed in the dashboard are in decimal unless explicitly labeled as percentages.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Sample Periods</h4>
          <p>
            Factor start dates vary depending on when the underlying data becomes available. The earliest
            factors begin in July 1926 (e.g., Size, Value); many start in the 1960s-1970s when CRSP/Compustat
            data coverage improves. All factors end at the same date (latest available, currently November 2024).
            There is no backfilling — if a factor does not have data for a month, that month is simply absent.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Missing Data Treatment</h4>
          <p>
            Missing monthly returns are left as gaps — they are not zero-filled, forward-filled, or
            interpolated. When computing statistics (Sharpe ratio, correlation, etc.), only months with
            actual data are used. For pairwise statistics (e.g., correlation between two factors), only
            months where both factors have data are included. This means different factor pairs may use
            different observation counts.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Decile Portfolios</h4>
          <p>
            In addition to long-short returns, the pipeline downloads equal-weighted decile portfolio returns
            (D1 through D10) used on the Long/Short Decomposition page. These show the return of each
            decile individually, allowing you to see whether a factor's performance comes from the long side,
            the short side, or both.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Signal Documentation</h4>
          <p>
            The signal documentation file provides metadata for each factor: original authors, publication
            year, journal, signal definition, economic category, signal type (Predictor, Placebo, etc.),
            and replication quality rating. This data powers the Factor Dictionary and is used for
            categorization throughout the dashboard.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Important Caveats</h4>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Returns do not include transaction costs, shorting fees, market impact, or financing costs</li>
            <li>Equal-weighted portfolios may include very small, illiquid stocks that are hard to trade in practice</li>
            <li>No adjustment for multiple testing — with 212 factors, some will appear significant by chance</li>
            <li>Survivorship bias in the factor literature: published factors tend to have stronger in-sample results</li>
            <li>The "OP" methodology standardizes construction, which may differ from the original paper's exact method</li>
          </ul>
        </div>
      </section>

      {/* Style Groups */}
      <section className="bg-[#1e293b] rounded-lg p-5 border border-[#334155] space-y-3">
        <h3 className="text-base font-semibold text-[#f1f5f9]">Style Groups</h3>
        <p>
          The 212 individual factors are grouped into 14 style categories following the Chen & Zimmermann
          economic taxonomy: Value, Momentum, Quality, Investment, Risk, Size, Accruals, Liquidity,
          Leverage & Financing, Analyst & Sentiment, Intangibles & Innovation, Payout & Ownership,
          Sales Growth, and Other.
        </p>
        <p>
          Style-level returns are computed as the equal-weighted average of all constituent factor returns
          each month. The number of factors in each style can vary over time as factors enter or leave the
          sample. No transaction costs or rebalancing frictions are applied.
        </p>
      </section>

      {/* Macro Data */}
      <section className="bg-[#1e293b] rounded-lg p-5 border border-[#334155] space-y-3">
        <h3 className="text-base font-semibold text-[#f1f5f9]">Macroeconomic Data</h3>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Primary Source: FRED-MD</h4>
          <p>
            The core macro dataset is{" "}
            <a href="https://research.stlouisfed.org/econ/mccracken/fred-databases/" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">
              FRED-MD
            </a> (McCracken & Ng, 2016), a curated panel of ~126 monthly macroeconomic time series widely
            used in academic research. It covers output, employment, prices, interest rates, money supply,
            housing, exchange rates, and stock market indicators.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Stationarity Transformations</h4>
          <p>
            Raw macroeconomic series are typically non-stationary (trending, unit roots). FRED-MD specifies
            a transformation code for each series to achieve stationarity, following the McCracken & Ng
            methodology. The transformations applied are:
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="px-3 py-1 text-left text-[#e2e8f0]">Code</th>
                  <th className="px-3 py-1 text-left text-[#e2e8f0]">Transformation</th>
                  <th className="px-3 py-1 text-left text-[#e2e8f0]">Example Series</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#334155]/30"><td className="px-3 py-1">1</td><td className="px-3 py-1">No transformation (levels)</td><td className="px-3 py-1">VIX, Average Weekly Hours</td></tr>
                <tr className="border-b border-[#334155]/30"><td className="px-3 py-1">2</td><td className="px-3 py-1">First difference</td><td className="px-3 py-1">Unemployment Rate, Fed Funds Rate</td></tr>
                <tr className="border-b border-[#334155]/30"><td className="px-3 py-1">3</td><td className="px-3 py-1">Second difference</td><td className="px-3 py-1">(rarely used)</td></tr>
                <tr className="border-b border-[#334155]/30"><td className="px-3 py-1">4</td><td className="px-3 py-1">Log</td><td className="px-3 py-1">Housing Starts, Building Permits</td></tr>
                <tr className="border-b border-[#334155]/30"><td className="px-3 py-1">5</td><td className="px-3 py-1">Log first difference (growth rate)</td><td className="px-3 py-1">Industrial Production, Payrolls, S&P 500</td></tr>
                <tr className="border-b border-[#334155]/30"><td className="px-3 py-1">6</td><td className="px-3 py-1">Log second difference (acceleration)</td><td className="px-3 py-1">CPI, M2 Money Stock</td></tr>
                <tr><td className="px-3 py-1">7</td><td className="px-3 py-1">Percent change (100 × Δlog)</td><td className="px-3 py-1">(rarely used)</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            This means the values displayed on the Macro Dashboard are <strong>not raw levels</strong> — they
            are the transformed series. For example, the S&P 500 is shown as log first-differences
            (approximately monthly returns), not price levels. The Macro Dictionary page shows each
            series' transformation code.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Supplemental FRED API Series</h4>
          <p>
            Five additional indicators not included in FRED-MD are fetched directly from the FRED API:
            USREC (NBER recession indicator), NFCI (National Financial Conditions Index), ANFCI (Adjusted NFCI),
            CFNAI (Chicago Fed National Activity Index), and USEPUINDXM (Economic Policy Uncertainty Index).
            These are stored as raw levels (no transformation applied).
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Custom FRED Series</h4>
          <p>
            Additional FRED series can be added via the <code className="bg-[#0f172a] px-1 rounded text-[#e2e8f0]">custom_fred_tickers.json</code> configuration
            file. Each custom series specifies a transformation code. These are fetched from the FRED API,
            transformed, and merged into the main dataset on each pipeline run.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Date Convention</h4>
          <p>
            Macro data uses first-of-month dates (e.g., 2020-01-01 for January 2020), while factor returns
            use end-of-month dates (e.g., 2020-01-31). When aligning factor and macro data (as on the
            Factor-Macro Regressions page), matching is done on year-month (YYYY-MM). FRED-MD data
            starts January 1959 for most series.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Missing Data Treatment</h4>
          <p>
            Missing values in macro series appear as <code className="bg-[#0f172a] px-1 rounded text-[#e2e8f0]">null</code> and
            are displayed as gaps in charts. No forward-filling, interpolation, or imputation is applied.
            Differencing transformations (codes 2, 3, 5, 6, 7) consume one or two observations at the start
            of each series. After transformation, any remaining NaN values from the differencing are dropped.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">NBER Recessions</h4>
          <p>
            Recession periods shown as shaded regions on charts are derived from the USREC indicator
            (1 = recession, 0 = expansion). When USREC is unavailable, hardcoded NBER recession dates
            are used as a fallback (35 recession periods from 1857 to 2020).
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Metadata Enrichment</h4>
          <p>
            Series descriptions, units, frequency, and seasonal adjustment information are fetched from
            the FRED API and cached locally. This metadata powers the Macro Dictionary page. For 9 FRED-MD
            series with non-standard identifiers (e.g., "S&P 500", "HWI"), descriptions are manually curated.
          </p>
        </div>
      </section>

      {/* Data Pipeline */}
      <section className="bg-[#1e293b] rounded-lg p-5 border border-[#334155] space-y-3">
        <h3 className="text-base font-semibold text-[#f1f5f9]">Data Pipeline & Updates</h3>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">How It Works</h4>
          <p>
            The data pipeline is a set of Python scripts that download raw data, apply transformations,
            compute analytics, and write static JSON files. The dashboard reads these JSON files directly —
            there is no backend server or database. All computations happen offline in the pipeline.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">Update Frequency</h4>
          <p>
            Factor returns from OpenAP are updated when Chen & Zimmermann release new data (typically
            with a lag of several months). FRED-MD is updated monthly by McCracken & Ng. To refresh the
            dashboard, re-run the data pipeline. Factor data updates automatically via the Python package;
            FRED-MD requires a manual CSV download due to server access restrictions.
          </p>
        </div>

        <div>
          <h4 className="text-[#e2e8f0] font-semibold mb-1">JSON Sanitization</h4>
          <p>
            All pipeline output is sanitized for valid JSON: infinity and NaN values are converted
            to <code className="bg-[#0f172a] px-1 rounded text-[#e2e8f0]">null</code>, NumPy types are
            converted to native Python types, and timestamps are formatted as ISO date strings (YYYY-MM-DD).
          </p>
        </div>
      </section>
    </div>
  );
}
