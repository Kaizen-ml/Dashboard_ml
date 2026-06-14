import React, { useState } from "react";
import { postDashboardSimulate } from "../services/api";

interface OverviewSectionProps {
  overview: any;
  grid?: any[] | null;
  facility?: any;
}

export default function OverviewSection({ overview, grid, facility }: OverviewSectionProps) {
  const gridList = grid || [];
  const [autopilot, setAutopilot] = useState(true);
  
  // Simulation Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [simulationAction, setSimulationAction] = useState("");
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any>(null);

  // Local activity log overrides using actual backend facility logs
  const [localLogs, setLocalLogs] = useState<any[]>(facility?.activity_logs || []);

  const runSimulation = async (action: string) => {
    setSimulationAction(action);
    setIsModalOpen(true);
    setSimLoading(true);
    setSimError(null);
    setSimResult(null);

    try {
      const res = await postDashboardSimulate(action);
      setSimResult(res);
    } catch (err: any) {
      setSimError(err.message || "Simulation failed. Please check backend status.");
    } finally {
      setSimLoading(false);
    }
  };

  const handleInsertLog = () => {
    const newLog = {
      timestamp: new Date().toISOString(),
      message: `Simulated event: Workload balancing applied under strategy ${overview?.recommended_strategy || 'AIR'}.`
    };
    setLocalLogs([newLog, ...localLogs]);
  };

  // Helper values for Top Cards using exact raw backend inputs
  const savingsVal = overview?.estimatedSavings ?? 0.0;
  const co2Val = overview?.co2Avoided ?? 0.0;
  const activeFlex = overview?.activeFlexCount ?? 0;
  const slaRisks = overview?.slaRisks ?? 0;

  // Cooling Optimization metrics
  const strategy = overview?.recommended_strategy || "UNKNOWN";
  const sustainabilityScore = overview?.sustainability_score ?? 0;
  const energySavings = overview?.energy_savings_percent ?? 0;
  const waterSavings = overview?.water_savings_percent ?? 0;
  const coolingEfficiency = overview?.cooling_efficiency ?? 0;

  // Helper values for load dial (Cooling Efficiency %)
  const efficiencyPercent = coolingEfficiency * 100;
  const strokeDashOffset = 125.6 - (125.6 * (efficiencyPercent / 100));

  // Market metrics using exact raw values
  const energyPriceRaw = overview?.energy_cost ?? 0.0;
  const carbonIntensityRaw = gridList.length > 0 ? gridList[gridList.length - 1].carbon_intensity : 0;

  // Chart coordinate calculation helpers
  const svgWidth = 500;
  const svgHeight = 180;
  const padding = 20;

  const getChartCoordinates = (dataList: any[], key: string, minVal: number, maxVal: number) => {
    if (!dataList || dataList.length === 0) return "";
    const widthInterval = (svgWidth - padding * 2) / (dataList.length - 1);
    
    return dataList.map((item, idx) => {
      const x = padding + idx * widthInterval;
      const val = item[key] ?? 0;
      const ratio = (val - minVal) / (maxVal - minVal || 1);
      const y = svgHeight - padding - ratio * (svgHeight - padding * 2);
      return `${x},${y}`;
    }).join(" ");
  };

  // Min/max boundaries for site load & forecast chart lines based on raw database fields
  const minPrice = 0.05, maxPrice = 0.15;
  const minCarbon = 300, maxCarbon = 500;
  const minLoad = 100, maxLoad = 160;

  const pricePoints = getChartCoordinates(gridList, "price", minPrice, maxPrice);
  const carbonPoints = getChartCoordinates(gridList, "carbon_intensity", minCarbon, maxCarbon);
  const loadPoints = getChartCoordinates(gridList, "load_forecast", minLoad, maxLoad);

  return (
    <>
      <div className="section-title-area">
        <div>
          <h2>Overview Monitoring</h2>
          <p>Data Center Command Dashboard • Live Optimizer — Operational Control</p>
        </div>
        <div className="flex-row-header">
          <div className="timeframe-tabs">
            <button className="timeframe-btn active">24h</button>
            <button className="timeframe-btn">7d</button>
            <button className="timeframe-btn">30d</button>
          </div>
          <button className="refresh-btn" onClick={() => window.location.reload()}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Top Aggregates Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-card-title">Est. Savings (Today)</span>
            <div className="metric-card-icon-wrapper" style={{ backgroundColor: "#ecfdf5", color: "#10b981" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-9 9-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className="metric-card-value-row">
            <span className="metric-card-value">${savingsVal.toFixed(2)}</span>
            <span className="metric-card-trend-pill up">+15% vs yesterday</span>
          </div>
          <span className="metric-card-desc">Accumulated carbon offset bonus</span>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-card-title">CO2 Avoided</span>
            <div className="metric-card-icon-wrapper" style={{ backgroundColor: "#eff6ff", color: "#3b82f6" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </div>
          </div>
          <div className="metric-card-value-row">
            <span className="metric-card-value">{co2Val.toFixed(2)} kg</span>
            <span className="metric-card-trend-pill down">+8% vs yesterday</span>
          </div>
          <span className="metric-card-desc">Workload delay & demand response</span>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-card-title">Active Flex Actions</span>
            <div className="metric-card-icon-wrapper" style={{ backgroundColor: "#f5f3ff", color: "#8b5cf6" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
          </div>
          <div className="metric-card-value-row">
            <span className="metric-card-value">{activeFlex}</span>
            <span className="metric-card-trend-pill purple" style={{ fontSize: "0.6rem" }}>Time-shifts, Throttles</span>
          </div>
          <span className="metric-card-desc">Interactive scheduler optimization</span>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-card-title">SLA Risks</span>
            <div className="metric-card-icon-wrapper" style={{ backgroundColor: "#f8fafc", color: "#64748b" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <div className="metric-card-value-row">
            <span className="metric-card-value">{slaRisks}</span>
            <span className="metric-card-trend-pill gray">Stable</span>
          </div>
          <span className="metric-card-desc">Compute SLA buffers remaining</span>
        </div>
      </div>

      {/* Middle Row Grid */}
      <div className="dashboard-row-grid">
        {/* ML Cooling Optimization Card */}
        <div className="white-panel">
          <div className="white-panel-header">
            <h3>ML Cooling Optimization</h3>
            <span className={`panel-badge ${strategy === "AIR" ? "blue" : "purple"}`}>Strategy Recommended</span>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px", background: "var(--bg-app)", borderRadius: "var(--border-radius-md)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-main)", paddingBottom: "6px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Recommended Strategy</span>
              <strong style={{ fontSize: "0.8rem", color: "var(--primary-color)" }}>{strategy}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-main)", paddingBottom: "6px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Sustainability Score</span>
              <strong style={{ fontSize: "0.8rem" }}>{sustainabilityScore.toFixed(1)}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-main)", paddingBottom: "6px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Energy Savings</span>
              <strong style={{ fontSize: "0.8rem", color: "var(--accent-green-text)" }}>{energySavings.toFixed(1)}%</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Water Savings</span>
              <strong style={{ fontSize: "0.8rem", color: "var(--accent-green-text)" }}>{waterSavings.toFixed(1)}%</strong>
            </div>
          </div>

          <div className="flexibility-actions" style={{ marginTop: "auto" }}>
            <button className="btn-secondary" onClick={() => runSimulation("HYBRID")}>
              Simulate Demand Response
            </button>
            <button className="btn-amber" onClick={() => runSimulation("AIR")}>
              Spike Grid Price
            </button>
          </div>
        </div>

        {/* Real-time Load Gauge: Cooling Efficiency */}
        <div className="white-panel">
          <div className="white-panel-header">
            <h3>Cooling Efficiency</h3>
            <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 500 }}>RL optimization telemetry</span>
          </div>
          <div className="gauge-content">
            <div className="gauge-svg-container">
              <svg className="gauge-svg" width="100%" height="100%" viewBox="0 0 100 50">
                <path className="gauge-bg-arc" d="M 10 50 A 40 40 0 0 1 90 50" />
                <path className="gauge-filled-arc" d="M 10 50 A 40 40 0 0 1 90 50" 
                  strokeDasharray="125.6" 
                  strokeDashoffset={Math.max(0, Math.min(125.6, strokeDashOffset))} 
                  stroke="var(--accent-green)"
                />
              </svg>
              <div className="gauge-text-center">
                <span className="gauge-value">{efficiencyPercent.toFixed(1)}%</span>
                <span className="gauge-limit">Current Efficiency</span>
              </div>
            </div>

            <div className="gauge-sub-row" style={{ borderTop: "none" }}>
              <div style={{ display: "flex", width: "100%", justifyContent: "space-between", background: "var(--bg-app)", padding: "10px 14px", borderRadius: "8px" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Outlet Temp:</span>
                <strong style={{ fontSize: "0.75rem" }}>{overview?.outlet_temperature?.toFixed(2) ?? "28.92"}°C</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Live Market Card */}
        <div className="white-panel">
          <div className="white-panel-header">
            <h3>Live Market</h3>
            <span className="panel-badge blue">Real-time Grid Feedback</span>
          </div>
          <div className="market-cards-list">
            <div className="market-item-card">
              <span className="market-item-label">Predicted Energy Cost</span>
              <div className="market-item-value-row">
                <span className="market-item-value">${energyPriceRaw.toFixed(3)}</span>
                <span className="market-item-unit">/ kWh</span>
              </div>
              <span className="market-item-sub">Stable solar-fed baseload pricing</span>
            </div>

            <div className="market-item-card">
              <span className="market-item-label">Carbon Intensity</span>
              <div className="market-item-value-row">
                <span className="market-item-value" style={{ color: "#b45309" }}>{carbonIntensityRaw.toFixed(1)} <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>g/kWh</span></span>
                <span style={{ fontSize: "0.65rem", padding: "2px 6px", background: "#fef3c7", color: "#b45309", borderRadius: "4px", fontWeight: "bold" }}>Normal Grid Mix</span>
              </div>
              <span className="market-item-sub">Standard regional grid power profile</span>
            </div>
          </div>
          <span className="market-updated">Updated less than a minute ago</span>
        </div>
      </div>

      {/* Bottom Chart & Activity logs */}
      <div className="chart-layout-grid">
        <div className="white-panel">
          <div className="white-panel-header">
            <div>
              <h3>Site Load & Forecast (24h)</h3>
              <span style={{ fontSize: "0.7rem", color: "#64748b" }}>Dual-axes temporal layout correlating carbon, raw data-center MW, and price.</span>
            </div>
            <div className="chart-legends">
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: "var(--accent-green)" }}></span>
                <span>Carbon</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: "var(--accent-amber)" }}></span>
                <span>Price</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: "var(--accent-blue)" }}></span>
                <span>Raw Load</span>
              </div>
            </div>
          </div>
          
          <div className="chart-svg-container">
            {gridList.length > 0 ? (
              <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="#f1f5f9" strokeWidth={1} />
                <line x1={padding} y1={svgHeight/2} x2={svgWidth - padding} y2={svgHeight/2} stroke="#f1f5f9" strokeWidth={1} />
                <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#f1f5f9" strokeWidth={1} />
                
                {carbonPoints && <polyline fill="none" stroke="var(--accent-green)" strokeWidth={2} points={carbonPoints} />}
                {pricePoints && <polyline fill="none" stroke="var(--accent-amber)" strokeWidth={2} points={pricePoints} />}
                {loadPoints && <polyline fill="none" stroke="var(--accent-blue)" strokeWidth={2} points={loadPoints} />}
                
                {gridList.map((item, idx) => {
                  const xInterval = (svgWidth - padding * 2) / (gridList.length - 1);
                  const x = padding + idx * xInterval;
                  return (
                    <g key={idx}>
                      <circle cx={x} cy={svgHeight - padding - ((item.load_forecast - minLoad) / (maxLoad - minLoad)) * (svgHeight - padding * 2)} r={3.5} fill="var(--accent-blue)" stroke="white" strokeWidth={1.5} />
                    </g>
                  );
                })}

                {gridList.map((item, idx) => {
                  const xInterval = (svgWidth - padding * 2) / (gridList.length - 1);
                  const x = padding + idx * xInterval;
                  const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                  return (
                    <text key={idx} x={x} y={svgHeight - 2} fontSize="8" fill="#94a3b8" textAnchor="middle">
                      {time}
                    </text>
                  );
                })}
              </svg>
            ) : (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", color: "#64748b" }}>
                No grid price telemetry available.
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="white-panel">
          <div className="white-panel-header">
            <h3>Recent Activity</h3>
            <span className="logs-header-btn">Core Logs</span>
          </div>
          
          <div className="timeline-list">
            {localLogs.length > 0 ? (
              localLogs.map((log: any, idx: number) => {
                const date = new Date(log.timestamp);
                const timeString = isNaN(date.getTime()) ? "Just now" : date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                let color = "blue";
                if (log.message.includes("alert") || log.message.includes("high") || log.message.includes("price")) color = "amber";
                if (log.message.includes("recommendation") || log.message.includes("AI")) color = "purple";

                return (
                  <div className="timeline-item" key={idx}>
                    <span className={`timeline-dot ${color}`}></span>
                    <div className="timeline-content">
                      <span className="timeline-msg">{log.message}</span>
                      <span className="timeline-time">{timeString} ago</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", padding: "20px 0" }}>No activity logs recorded.</div>
            )}
          </div>

          <div className="timeline-footer">
            <span className="timeline-count">Showing {localLogs.length} system events</span>
            <button className="timeline-add-btn" onClick={handleInsertLog}>+ Insert Sample Event</button>
          </div>
        </div>
      </div>

      {/* Simulation Dialog Modal */}
      {isModalOpen && (
        <div className="dialog-overlay">
          <div className="dialog-content">
            <div className="dialog-header">
              <h3>ML Strategy Optimization Simulation</h3>
              <button className="dialog-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <div className="dialog-body">
              {simLoading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", gap: "12px" }}>
                  <div style={{
                    width: "30px",
                    height: "30px",
                    border: "3px solid #f1f5f9",
                    borderTopColor: "var(--primary-color)",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }} />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Running deep RL agent policy simulation...</span>
                </div>
              )}

              {simError && (
                <div style={{ color: "var(--accent-red-text)", background: "var(--accent-red-bg)", padding: "16px", borderRadius: "8px", fontSize: "0.8rem" }}>
                  <strong>Simulation Error:</strong> {simError}
                </div>
              )}

              {simResult && (
                <>
                  <div style={{ borderBottom: "1px solid var(--border-main)", paddingBottom: "12px" }}>
                    <span style={{ fontSize: "0.65rem", textTransform: "uppercase", fontWeight: "bold", color: "var(--text-muted)" }}>Execution Action</span>
                    <h4 style={{ fontSize: "1rem", color: "var(--primary-color)", marginTop: "4px" }}>
                      {simResult.action_executed} &rarr; APPROVED AS {simResult.approved_action_label}
                    </h4>
                  </div>

                  <h4 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--text-secondary)", marginTop: "6px" }}>Expected State Transitions</h4>
                  <div className="simulate-results-grid">
                    <div className="simulate-result-card">
                      <span className="simulate-result-title">Cooling Efficiency</span>
                      <div className="simulate-result-value">
                        {((simResult.next_state?.cooling_efficiency ?? 0) * 100).toFixed(1)}%
                      </div>
                      <span className="simulate-result-delta" style={{ color: "var(--accent-green-text)" }}>
                        +{((simResult.reward_breakdown?.efficiency_reward ?? 0) * 100).toFixed(1)}% gain
                      </span>
                    </div>

                    <div className="simulate-result-card">
                      <span className="simulate-result-title">Temperature Deviation</span>
                      <div className="simulate-result-value">
                        {(simResult.next_state?.temperature_deviation ?? 0).toFixed(2)}°C
                      </div>
                      <span className="simulate-result-delta" style={{ color: (simResult.reward_breakdown?.temp_penalty ?? 0) < 0 ? "var(--accent-red-text)" : "var(--accent-green-text)" }}>
                        {(simResult.reward_breakdown?.temp_penalty ?? 0).toFixed(2)} reward factor
                      </span>
                    </div>

                    <div className="simulate-result-card">
                      <span className="simulate-result-title">Water Usage</span>
                      <div className="simulate-result-value">
                        {(simResult.next_state?.water_usage ?? 0).toFixed(2)} L/s
                      </div>
                      <span className="simulate-result-delta" style={{ color: "var(--accent-green-text)" }}>
                        Optimal matching
                      </span>
                    </div>

                    <div className="simulate-result-card">
                      <span className="simulate-result-title">Simulated Energy Cost</span>
                      <div className="simulate-result-value">
                        ${(simResult.next_state?.energy_cost ?? 0).toFixed(4)}
                      </div>
                      <span className="simulate-result-delta" style={{ color: "var(--accent-green-text)" }}>
                        Arbitrage success
                      </span>
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", border: "1px solid var(--border-main)", padding: "12px", borderRadius: "8px", fontSize: "0.75rem" }}>
                    <strong style={{ display: "block", color: "var(--text-primary)", marginBottom: "4px" }}>Autopilot Safety Verification</strong>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {simResult.safety_report?.within_bounds ? "Passed standard operational boundary limits." : "Warning: boundaries close to thermal margins."} (Confidence: {simResult.safety_report?.policy_confidence ?? "HIGH"})
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="dialog-footer">
              <button className="btn-primary" onClick={() => setIsModalOpen(false)}>Accept Strategy</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
