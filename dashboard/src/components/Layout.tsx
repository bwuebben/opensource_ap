import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";

interface NavSection {
  label: string;
  items: { to: string; label: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard" }],
  },
  {
    label: "Factors",
    items: [
      { to: "/factors", label: "Factor Browser" },
      { to: "/dictionary", label: "Factor Dictionary" },
      { to: "/scatter", label: "Factor Scatter" },
      { to: "/screener", label: "Factor Screener" },
      { to: "/rolling", label: "Rolling Stats" },
      { to: "/recent", label: "What Worked Recently" },
    ],
  },
  {
    label: "Returns",
    items: [
      { to: "/cumulative", label: "Cumulative Returns" },
      { to: "/heatmap", label: "Monthly Heatmap" },
      { to: "/drawdowns", label: "Drawdowns" },
      { to: "/correlation", label: "Correlation" },
      { to: "/annual", label: "Annual Returns" },
      { to: "/seasonality", label: "Seasonality" },
      { to: "/decades", label: "Decade Performance" },
    ],
  },
  {
    label: "Styles & Portfolios",
    items: [
      { to: "/styles", label: "Style Analysis" },
      { to: "/portfolio", label: "Style Portfolio" },
      { to: "/walkforward", label: "Walk-Forward" },
    ],
  },
  {
    label: "Research",
    items: [
      { to: "/replication", label: "Replication Tracker" },
      { to: "/decay", label: "Post-Publication Decay" },
      { to: "/long-short", label: "Long/Short Decomposition" },
      { to: "/regimes", label: "Regimes & Crises" },
      { to: "/crowding", label: "Crowding & Overlap" },
      { to: "/factor-momentum", label: "Factor Momentum" },
      { to: "/tail-risk", label: "Tail Risk" },
      { to: "/timing", label: "Factor Timing" },
    ],
  },
  {
    label: "Macro",
    items: [
      { to: "/macro", label: "Macro Dashboard" },
      { to: "/macro-dictionary", label: "Macro Dictionary" },
      { to: "/factor-macro", label: "Factor-Macro Regressions" },
    ],
  },
  {
    label: "Reference",
    items: [
      { to: "/data", label: "Data Sources" },
    ],
  },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-56" : "w-0"
        } flex-shrink-0 bg-[#1e293b] border-r border-[#334155] transition-all duration-200 overflow-hidden flex flex-col`}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b border-[#334155]">
          <h1 className="text-sm font-bold text-white tracking-tight leading-tight">
            Open Asset Pricing
          </h1>
          <p className="text-[10px] text-[#64748b] mt-0.5">
            212 factors | Chen & Zimmermann
          </p>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-1">
              <div className="px-4 py-1.5 text-[10px] font-semibold text-[#475569] uppercase tracking-wider">
                {section.label}
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `block px-4 py-1.5 text-xs transition-colors ${
                      isActive
                        ? "bg-[#3b82f6]/15 text-[#3b82f6] border-r-2 border-[#3b82f6]"
                        : "text-[#94a3b8] hover:text-white hover:bg-[#334155]/50"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#334155] text-[10px] text-[#475569]">
          <a
            href="https://www.openassetpricing.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b82f6] hover:underline"
          >
            openassetpricing.com
          </a>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-[#1e293b] border-b border-[#334155] px-4 py-2 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-[#94a3b8] hover:text-white p-1"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
