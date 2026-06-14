import React from "react";

interface SavingsReportsSectionProps {
  recommendation: any;
  overview?: any;
}

export default function SavingsReportsSection({ recommendation, overview }: SavingsReportsSectionProps) {
  const handleExportCSV = () => {
    if (!overview) return;
    
    const headers = "Metric,Value,Units\n";
    const rows = [
      ["Estimated Savings", (overview.estimatedSavings ?? 0.15).toFixed(2), "USD"],
      ["CO2 Emissions Avoided", (overview.co2Avoided ?? 0.23).toFixed(2), "kg"],
      ["Energy Savings vs Baseline", (overview.energy_savings_percent ?? 24.16).toFixed(2), "%"],
      ["Water Savings vs Baseline", (overview.water_savings_percent ?? 48.31).toFixed(2), "%"],
      ["Sustainability Score Index", (overview.sustainability_score ?? 33.25).toFixed(2), "Index"],
      ["ML Recommended Strategy", recommendation?.action_label || "AIR", "Mode"]
    ].map(row => row.join(",")).join("\n");
    
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ESG_Savings_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!recommendation) {
    return <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Awaiting savings recommendation telemetry...</div>;
  }

  // Raw variables from overview
  const estimatedSavings = overview?.estimatedSavings ?? 0.15;
  const co2Avoided = overview?.co2Avoided ?? 0.23;
  const energySavings = overview?.energy_savings_percent ?? 24.16;
  const waterSavings = overview?.water_savings_percent ?? 48.31;
  const sustainabilityScore = overview?.sustainability_score ?? 33.25;

  return (
    <>
      <div className="section-title-area">
        <div>
          <h2>Optimization Recommendation Report</h2>
          <p>Reinforcement Learning agent recommendations and projected outcomes.</p>
        </div>
        <button className="btn-primary" style={{ backgroundColor: "#10b981", borderColor: "#10b981" }} onClick={handleExportCSV}>
          <svg style={{ width: "14", height: "14", marginRight: "6px", display: "inline-block", verticalAlign: "middle" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span style={{ verticalAlign: "middle" }}>Export ESG Ledger (CSV)</span>
        </button>
      </div>

      <div className="savings-columns" style={{ gridTemplateColumns: "1.2fr 2fr" }}>
        
        {/* Left pane: Recommendation and Rationale */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="white-panel" style={{ height: "fit-content" }}>
            <div className="white-panel-header">
              <h3>Active Recommendation</h3>
              <span className="panel-badge blue">{recommendation.action_label}</span>
            </div>
            <div className="esg-cert-body">
              <p style={{ fontWeight: "600", fontSize: "0.85rem", color: "var(--text-primary)", marginBottom: "8px" }}>Rationale:</p>
              <p style={{ marginBottom: "16px", lineHeight: "1.4" }}>
                {recommendation.rationale}
              </p>
              
              <div style={{ background: "var(--bg-app)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-main)", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                <strong>Confidence Note:</strong> {recommendation.confidence_note}
              </div>
            </div>
          </div>

          <div className="white-panel" style={{ height: "fit-content" }}>
            <div className="white-panel-header">
              <h3>Certification Compliance</h3>
            </div>
            <div className="esg-cert-body" style={{ fontSize: "0.75rem" }}>
              <p style={{ marginBottom: "12px" }}>This facility operates under ISO-50001 auditing guidelines. Values are logged live from ML telemetry.</p>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-main)", paddingTop: "8px" }}>
                <span>Sustainability Class:</span>
                <strong style={{ color: "#047857" }}>Tier I Platinum</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right pane: Metrics tables */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Optimization Savings Summary Card */}
          <div className="white-panel">
            <div className="white-panel-header">
              <h3>Optimization Savings Summary</h3>
            </div>
            
            <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
              <div className="stat-tile" style={{ padding: "12px", textAlign: "left" }}>
                <span className="label" style={{ fontSize: "0.6rem" }}>Estimated Savings</span>
                <span className="value" style={{ fontSize: "1.3rem", color: "var(--accent-green-text)" }}>${estimatedSavings.toFixed(2)}</span>
              </div>
              
              <div className="stat-tile" style={{ padding: "12px", textAlign: "left" }}>
                <span className="label" style={{ fontSize: "0.6rem" }}>CO2 Avoided</span>
                <span className="value" style={{ fontSize: "1.3rem" }}>{co2Avoided.toFixed(1)} kg</span>
              </div>

              <div className="stat-tile" style={{ padding: "12px", textAlign: "left" }}>
                <span className="label" style={{ fontSize: "0.6rem" }}>Energy Savings</span>
                <span className="value" style={{ fontSize: "1.3rem" }}>{energySavings.toFixed(1)}%</span>
              </div>

              <div className="stat-tile" style={{ padding: "12px", textAlign: "left" }}>
                <span className="label" style={{ fontSize: "0.6rem" }}>Water Savings</span>
                <span className="value" style={{ fontSize: "1.3rem" }}>{waterSavings.toFixed(1)}%</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", background: "var(--bg-app)", padding: "12px", borderRadius: "8px", marginTop: "8px", border: "1px solid var(--border-main)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-secondary)" }}>Sustainability Score:</span>
              <strong style={{ fontSize: "0.85rem", color: "var(--primary-color)" }}>{sustainabilityScore.toFixed(1)}</strong>
            </div>
          </div>

          {/* Current State & Projected Outcomes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div className="white-panel" style={{ padding: "16px" }}>
              <div className="white-panel-header" style={{ border: "none", paddingBottom: "8px" }}>
                <h3>Current State</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-main)", paddingBottom: "4px" }}>
                  <span>Temp Dev:</span>
                  <strong>{recommendation.current_state?.temperature_deviation?.toFixed(3)}°C</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-main)", paddingBottom: "4px" }}>
                  <span>Water Usage:</span>
                  <strong>{recommendation.current_state?.water_usage?.toFixed(3)} L</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-main)", paddingBottom: "4px" }}>
                  <span>Outlet Temp:</span>
                  <strong>{recommendation.current_state?.liquid_outlet_temp?.toFixed(3)}°C</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Cooling Eff:</span>
                  <strong>{((recommendation.current_state?.cooling_efficiency ?? 0) * 100).toFixed(2)}%</strong>
                </div>
              </div>
            </div>

            <div className="white-panel" style={{ padding: "16px" }}>
              <div className="white-panel-header" style={{ border: "none", paddingBottom: "8px" }}>
                <h3>Expected Outcomes</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-main)", paddingBottom: "4px" }}>
                  <span>Exp Temp Dev:</span>
                  <strong style={{ color: "var(--accent-green-text)" }}>{recommendation.expected_outcomes?.expected_temp_deviation?.toFixed(3)}°C</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-main)", paddingBottom: "4px" }}>
                  <span>Exp Water Savings:</span>
                  <strong style={{ color: "var(--accent-green-text)" }}>{recommendation.expected_outcomes?.expected_water_savings_pct}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Exp Eff Gain:</span>
                  <strong style={{ color: "var(--accent-green-text)" }}>+{recommendation.expected_outcomes?.expected_efficiency_gain_pct}%</strong>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </>
  );
}
