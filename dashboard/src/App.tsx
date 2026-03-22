import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FactorProvider } from "./components/FactorContext";
import Layout from "./components/Layout";
import LoadingSpinner from "./components/LoadingSpinner";

import Overview from "./pages/Overview";
import FactorBrowser from "./pages/FactorBrowser";
import FactorDictionary from "./pages/FactorDictionary";

const CumulativeReturns = lazy(() => import("./pages/CumulativeReturns"));
const MonthlyHeatmap = lazy(() => import("./pages/MonthlyHeatmap"));
const Drawdowns = lazy(() => import("./pages/Drawdowns"));
const Correlation = lazy(() => import("./pages/Correlation"));
const AnnualReturns = lazy(() => import("./pages/AnnualReturns"));
const StyleAnalysis = lazy(() => import("./pages/StyleAnalysis"));
const StylePortfolio = lazy(() => import("./pages/StylePortfolio"));
const WalkForward = lazy(() => import("./pages/WalkForward"));
const FactorScatter = lazy(() => import("./pages/FactorScatter"));
const FactorScreener = lazy(() => import("./pages/FactorScreener"));
const RollingStats = lazy(() => import("./pages/RollingStats"));
const PostPubDecay = lazy(() => import("./pages/PostPubDecay"));
const RegimesCrises = lazy(() => import("./pages/RegimesCrises"));
const Crowding = lazy(() => import("./pages/Crowding"));
const FactorMomentum = lazy(() => import("./pages/FactorMomentum"));
const TailRisk = lazy(() => import("./pages/TailRisk"));
const MacroDashboard = lazy(() => import("./pages/MacroDashboard"));
const MacroDictionary = lazy(() => import("./pages/MacroDictionary"));
const FactorMacroReg = lazy(() => import("./pages/FactorMacroReg"));
const DecadePerformance = lazy(() => import("./pages/DecadePerformance"));
const LongShortDecomp = lazy(() => import("./pages/LongShortDecomp"));
const Seasonality = lazy(() => import("./pages/Seasonality"));
const RecentPerformance = lazy(() => import("./pages/RecentPerformance"));
const FactorTiming = lazy(() => import("./pages/FactorTiming"));
const ReplicationTracker = lazy(() => import("./pages/ReplicationTracker"));

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>;
}

export default function App() {
  return (
    <BrowserRouter>
      <FactorProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="factors" element={<FactorBrowser />} />
            <Route path="dictionary" element={<FactorDictionary />} />
            <Route path="cumulative" element={<S><CumulativeReturns /></S>} />
            <Route path="heatmap" element={<S><MonthlyHeatmap /></S>} />
            <Route path="drawdowns" element={<S><Drawdowns /></S>} />
            <Route path="correlation" element={<S><Correlation /></S>} />
            <Route path="annual" element={<S><AnnualReturns /></S>} />
            <Route path="styles" element={<S><StyleAnalysis /></S>} />
            <Route path="portfolio" element={<S><StylePortfolio /></S>} />
            <Route path="walkforward" element={<S><WalkForward /></S>} />
            <Route path="scatter" element={<S><FactorScatter /></S>} />
            <Route path="screener" element={<S><FactorScreener /></S>} />
            <Route path="rolling" element={<S><RollingStats /></S>} />
            <Route path="decay" element={<S><PostPubDecay /></S>} />
            <Route path="regimes" element={<S><RegimesCrises /></S>} />
            <Route path="crowding" element={<S><Crowding /></S>} />
            <Route path="factor-momentum" element={<S><FactorMomentum /></S>} />
            <Route path="tail-risk" element={<S><TailRisk /></S>} />
            <Route path="macro" element={<S><MacroDashboard /></S>} />
            <Route path="macro-dictionary" element={<S><MacroDictionary /></S>} />
            <Route path="factor-macro" element={<S><FactorMacroReg /></S>} />
            <Route path="decades" element={<S><DecadePerformance /></S>} />
            <Route path="long-short" element={<S><LongShortDecomp /></S>} />
            <Route path="seasonality" element={<S><Seasonality /></S>} />
            <Route path="recent" element={<S><RecentPerformance /></S>} />
            <Route path="timing" element={<S><FactorTiming /></S>} />
            <Route path="replication" element={<S><ReplicationTracker /></S>} />
          </Route>
        </Routes>
      </FactorProvider>
    </BrowserRouter>
  );
}
