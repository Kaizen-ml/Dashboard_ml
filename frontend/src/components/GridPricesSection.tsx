import React, { useState } from "react";

interface GridTrendPoint {
  timestamp: string;
  price: number;
  carbon_intensity: number;
  load_forecast: number;
}

interface GridPricesSectionProps {
  grid: GridTrendPoint[] | null;
  overview?: any;
}

export default function GridPricesSection({ grid, overview }: GridPricesSectionProps) {
  const gridList = grid || [];
  const [contractLocked, setContractLocked] = useState(false);
  const [feedSource, setFeedSource] = useState("us-west-1");

  const handleLockContract = () => {
    setContractLocked(true);
    setTimeout(() => setContractLocked(false), 4000);
  };

  // Extract latest grid metrics or fallback to standard values
  const latestPoint = gridList.length > 0 ? gridList[gridList.length - 1] : { price: 0.1, carbon_intensity: 228, load_forecast: 120 };
  const energyPriceRaw = overview?.energy_cost ?? latestPoint.price;
  const carbonVal = Math.round(latestPoint.carbon_intensity);
  const cleanPercentage = Math.min(99, Math.max(30, 100 - (carbonVal - 200) * 0.15));

  // Chart coordinates SVG
  const svgWidth = 520;
  const svgHeight = 220;
  const padding = 25;
  const barWidth = 14;
  const gap = 4;

  const maxPriceVal = 0.20; // scale up to $0.20/kWh raw
  const maxRenewableVal = 100; // 100%

  return (
    <>
      <div className="section-title-area">
        <div>
          <h2>Grid Intelligence & Pricing Markets</h2>
          <p>Smart grid arbitrage, locational marginal pricing (LMP), and real-time carbon intensity forecasting.</p>
        </div>
      </div>

      <div className="facility-layout-grid" style={{ gridTemplateColumns: "1fr 2.5fr" }}>
        
        {/* Left Side: Feeds and locks */}
        <div className="white-panel" style={{ gap: "20px" }}>
          <div>
            <span style={{ fontSize: "0.65rem", textTransform: "uppercase", fontWeight: "bold", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Power Feed Source</span>
            <select className="floor-level-select" value={feedSource} onChange={(e) => setFeedSource(e.target.value)}>
              <option value="us-west-1">US-West-1 (Clean Solar Grid)</option>
              <option value="us-east-2">US-East-2 (Mixed Gas Grid)</option>
              <option value="eu-west-1">EU-West-1 (Wind & Hydro Grid)</option>
            </select>
          </div>

          <div className="metric-card" style={{ padding: "16px", backgroundColor: "var(--bg-app)" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>Carbon Lock Rate</span>
            
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", borderBottom: "1px solid var(--border-main)", paddingBottom: "6px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Fixed Offset:</span>
              <strong style={{ fontSize: "0.75rem", color: "var(--accent-green-text)" }}>95% (Fully Clean)</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Curtailment Level:</span>
              <strong style={{ fontSize: "0.75rem", color: "var(--accent-amber-text)" }}>12% automated</strong>
            </div>
          </div>

          <button 
            className="btn-primary" 
            style={{ marginTop: "8px" }}
            onClick={handleLockContract}
          >
            {contractLocked ? "✓ Contract Settled" : "Settle Solar Hedging Contract"}
          </button>
        </div>

        {/* Right Side: Charts & indicators */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Stats Bar */}
          <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="metric-card">
              <span className="metric-card-title">Predicted Energy Cost</span>
              <div className="metric-card-value-row">
                <span className="metric-card-value">${energyPriceRaw.toFixed(3)}<span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>/kWh</span></span>
              </div>
              <span className="metric-card-desc">Energy Savings vs Baseline: {(overview?.energy_savings_percent ?? 24.16).toFixed(1)}%</span>
            </div>

            <div className="metric-card">
              <span className="metric-card-title">Marginal Emission</span>
              <div className="metric-card-value-row">
                <span className="metric-card-value">{carbonVal} g/kWh</span>
                <span className="priority-badge high" style={{ fontSize: "0.6rem", background: "#fef3c7", color: "#b45309" }}>Moderate Intensity</span>
              </div>
              <span className="metric-card-desc">Instantaneous CO2 grid load factor</span>
            </div>

            <div className="metric-card">
              <span className="metric-card-title">Total Renewable Mix</span>
              <div className="metric-card-value-row">
                <span className="metric-card-value" style={{ color: "var(--accent-green)" }}>{cleanPercentage.toFixed(1)}%</span>
                <span className="status-pill running" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>Clean</span>
              </div>
              <span className="metric-card-desc">Peak solar profile high</span>
            </div>
          </div>

          {/* Arbitrage Window & Availability Prospectus Chart */}
          <div className="white-panel">
            <div className="white-panel-header">
              <h3>Arbitrage Window & Renewable Availability Prospectus</h3>
              <div className="chart-legends">
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: "var(--accent-amber)" }}></span>
                  <span>Price ($/kWh)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: "var(--accent-green)" }}></span>
                  <span>Renewable %</span>
                </div>
              </div>
            </div>

            <div style={{ width: "100%", height: "230px", marginTop: "10px" }}>
              {gridList.length > 0 ? (
                <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                  <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="#f1f5f9" strokeWidth={1} />
                  <line x1={padding} y1={svgHeight/2} x2={svgWidth - padding} y2={svgHeight/2} stroke="#f1f5f9" strokeWidth={1} />
                  <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#f1f5f9" strokeWidth={1} />

                  {gridList.map((point, idx) => {
                    const xInterval = (svgWidth - padding * 2) / gridList.length;
                    const xCenter = padding + idx * xInterval + xInterval / 2;
                    
                    const priceRaw = point.price;
                    const priceHeight = (priceRaw / maxPriceVal) * (svgHeight - padding * 2);
                    const priceY = svgHeight - padding - priceHeight;

                    // compute dynamic renewable %
                    const renPct = Math.min(100, Math.max(0, 100 - (point.carbon_intensity - 300) * 0.2));
                    const renHeight = (renPct / maxRenewableVal) * (svgHeight - padding * 2);
                    const renY = svgHeight - padding - renHeight;

                    return (
                      <g key={idx}>
                        {/* Price Bar */}
                        <rect 
                          x={xCenter - barWidth - gap/2} 
                          y={priceY} 
                          width={barWidth} 
                          height={priceHeight} 
                          fill="var(--accent-amber)" 
                          rx={2}
                        >
                          <title>{`Price: $${priceRaw.toFixed(3)}/kWh`}</title>
                        </rect>
                        {/* Renewable Bar */}
                        <rect 
                          x={xCenter + gap/2} 
                          y={renY} 
                          width={barWidth} 
                          height={renHeight} 
                          fill="var(--accent-green)" 
                          rx={2}
                        >
                          <title>{`Renewables: ${renPct.toFixed(1)}%`}</title>
                        </rect>
                      </g>
                    );
                  })}

                  {/* X Axis Time Labels */}
                  {gridList.map((point, idx) => {
                    const xInterval = (svgWidth - padding * 2) / gridList.length;
                    const xCenter = padding + idx * xInterval + xInterval / 2;
                    const date = new Date(point.timestamp);
                    const timeStr = isNaN(date.getTime()) ? point.timestamp.substring(11, 16) : date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
                    
                    return (
                      <text key={idx} x={xCenter} y={svgHeight - 4} fontSize="8.5" fill="#94a3b8" textAnchor="middle">
                        {timeStr}
                      </text>
                    );
                  })}
                </svg>
              ) : (
                <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  No grid prospectus telemetry available.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </>
  );
}
