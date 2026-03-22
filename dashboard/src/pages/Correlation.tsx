import { useCallback } from "react";
import Plot from "../PlotlyChart";
import { useData } from "../hooks";
import { loadCorrelation } from "../dataLoader";
import LoadingSpinner from "../components/LoadingSpinner";

export default function Correlation() {
  const { data: corr, loading } = useData(
    useCallback(() => loadCorrelation(), [])
  );

  if (loading) return <LoadingSpinner />;
  if (!corr) return <div className="text-red-400">No data</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#94a3b8]">
        Pairwise correlation matrix of monthly returns for the top 50 factors by absolute Sharpe ratio. Red clusters indicate groups of factors that move together — useful for portfolio construction (you want low correlation between factors) and understanding which anomalies are truly distinct vs. variations of the same signal.
      </p>

      <div className="bg-[#1e293b] rounded-lg p-4 border border-[#334155]">
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
    </div>
  );
}
