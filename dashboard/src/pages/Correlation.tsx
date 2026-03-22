import { useCallback } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { loadCorrelation } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";
import Methodology, { MathBlock, MNote } from "../components/Methodology";

interface CorrData {
  factors: string[];
  matrix: number[][];
}

async function loadStyleCorrelation(): Promise<CorrData | null> {
  const r = await fetch("/data/style_correlation.json");
  if (!r.ok) return null;
  return r.json();
}

export default function Correlation() {
  const { data: corr, loading: l1 } = useData(
    useCallback(() => loadCorrelation(), [])
  );
  const { data: styleCorr, loading: l2 } = useData(
    useCallback(() => loadStyleCorrelation(), [])
  );

  if (l1 || l2) return <LoadingSpinner />;
  if (!corr) return <div className="text-red-400">No data</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#94a3b8]">
        Pairwise correlation matrix of monthly returns for the top 50 factors by absolute Sharpe ratio. Red clusters indicate groups of factors that move together — useful for portfolio construction (you want low correlation between factors) and understanding which anomalies are truly distinct vs. variations of the same signal.
      </p>

      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Individual Factor Correlations (Top 50 by Sharpe)</h3>
        <Plot
          data={[
            {
              z: corr.matrix,
              x: corr.factors,
              y: corr.factors,
              type: "heatmap",
              colorscale: [
                [0, "#3b82f6"],
                [0.5, "#0f172a"],
                [1, "#ef4444"],
              ],
              zmid: 0,
              zmin: -1,
              zmax: 1,
              colorbar: {
                title: "Correlation",
                titlefont: { color: "#94a3b8" },
                tickfont: { color: "#94a3b8" },
              },
              hovertemplate: "%{x} vs %{y}: %{z:.3f}<extra></extra>",
            },
          ]}
          layout={{
            height: 800,
            width: 900,
            margin: { t: 10, b: 120, l: 120, r: 50 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: "#94a3b8", size: 8 },
            xaxis: { tickangle: -45 },
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      {styleCorr && (
        <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
          <h3 className="text-sm font-semibold text-[#f1f5f9] mb-2">Style Factor Correlations</h3>
          <p className="text-xs text-[#94a3b8] mb-3">
            Pairwise correlation of the 14 equal-weighted style group returns. Shows how the broad factor themes relate to each other — e.g., whether Value and Momentum are negatively correlated (historically they are, making them good diversifiers).
          </p>
          <Plot
            data={[
              {
                z: styleCorr.matrix,
                x: styleCorr.factors,
                y: styleCorr.factors,
                type: "heatmap",
                colorscale: [
                  [0, "#3b82f6"],
                  [0.5, "#0f172a"],
                  [1, "#ef4444"],
                ],
                zmid: 0,
                zmin: -1,
                zmax: 1,
                colorbar: {
                  title: "Correlation",
                  titlefont: { color: "#94a3b8" },
                  tickfont: { color: "#94a3b8" },
                },
                hovertemplate: "%{x} vs %{y}: %{z:.3f}<extra></extra>",
              },
            ]}
            layout={{
              height: 500,
              margin: { t: 10, b: 120, l: 160, r: 50 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { color: "#94a3b8", size: 10 },
              xaxis: { tickangle: -45 },
            }}
            config={{ responsive: true }}
            style={{ width: "100%" }}
          />
        </div>
      )}

      <Methodology>
        <MNote title="Correlation Matrix">Pearson pairwise correlation of monthly returns:</MNote>
        <MathBlock>{"$$\\rho_{ij} = \\frac{\\sum_t (r_{i,t} - \\bar{r}_i)(r_{j,t} - \\bar{r}_j)}{\\sqrt{\\sum_t (r_{i,t} - \\bar{r}_i)^2 \\sum_t (r_{j,t} - \\bar{r}_j)^2}}$$"}</MathBlock>
        <MNote title="Factor Selection">Top 50 factors by absolute Sharpe ratio are included. Correlation is computed over all months where both factors have data (pairwise complete observations).</MNote>
        <MNote title="Interpretation">Values near +1 indicate factors that move together (potential redundancy). Values near -1 indicate natural hedges. Near-zero means the factors are roughly independent. For portfolio construction, combining low-correlation factors maximizes diversification benefit.</MNote>
      </Methodology>
    </div>
  );
}
