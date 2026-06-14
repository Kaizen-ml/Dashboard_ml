import React, { useState } from "react";

interface ActivityLog {
  timestamp: string;
  message: string;
}

interface PUERecord {
  timestamp: string;
  pue: number;
}

interface FacilityResponse {
  facility_name: string;
  pue: number;
  activity_logs: ActivityLog[];
  pue_trend: PUERecord[];
  rack_temperatures: number[];
  fan_speeds: number[];
}

interface FacilitySectionProps {
  facility: FacilityResponse | null;
  overview?: any;
}

export default function FacilitySection({ facility, overview }: FacilitySectionProps) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedCabinet, setSelectedCabinet] = useState<number | null>(null);

  // CRAC speed states (interactive simulation)
  const [crac1Load, setCrac1Load] = useState(60);
  const [crac2Load, setCrac2Load] = useState(55);

  if (!facility) {
    return <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Awaiting facility telemetry...</div>;
  }

  // Raw coordinates & metrics from backend
  const temps = facility.rack_temperatures || [];
  const fanSpeeds = facility.fan_speeds || [];
  const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 0;

  // Topological heatmap grid nodes mapping actual temps
  const heatmapNodes = temps.map((t, idx) => ({
    id: idx + 1,
    temp: t.toFixed(1),
    color: t > 29.5 ? "#ef4444" : (t > 28.5 ? "#f59e0b" : "#10b981")
  }));

  // Calculate SVG PUE Trend points dynamically
  const pWidth = 420;
  const pHeight = 130;
  const padding = 15;
  const trendPoints = facility.pue_trend.map((point, idx) => {
    const x = padding + (idx * (pWidth - padding * 2)) / (facility.pue_trend.length - 1);
    // scale PUE between 1.0 and 1.6
    const minP = 1.0;
    const maxP = 1.6;
    const ratio = (point.pue - minP) / (maxP - minP);
    const y = pHeight - padding - ratio * (pHeight - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <>
      <div className="section-title-area">
        <div>
          <h2>Facility Infrastructure Health</h2>
          <p>{facility.facility_name} — Facility Monitoring, Airflow Vectors, & Thermals</p>
        </div>
      </div>

      <div className="facility-layout-grid">
        
        {/* Left Side Panel: Racks Summary */}
        <div className="white-panel" style={{ gap: "16px" }}>
          <div>
            <span style={{ fontSize: "0.65rem", textTransform: "uppercase", fontWeight: "bold", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Facility Racks List</span>
            <div className="zone-list">
              {temps.map((temp, idx) => (
                <div key={idx} className={`zone-item ${selectedCabinet === idx + 1 ? "active" : ""}`} onClick={() => setSelectedCabinet(idx + 1)}>
                  <div>
                    <span className="zone-item-title">Rack Bay-0{idx + 1}</span>
                    <span className="zone-item-desc">Temp: {temp.toFixed(1)}°C • Fan: {fanSpeeds[idx] ?? 3000} RPM</span>
                  </div>
                  <span className={`zone-indicator-dot ${temp > 29.0 ? "red" : "green"}`}></span>
                </div>
              ))}
            </div>
          </div>

          <div className="control-tips">
            <p className="title">💡 Interactive Diagram:</p>
            <p>Click on any rack bay list item or isometric server block to view fan controls and telemetry readings.</p>
          </div>
        </div>

        {/* Right Side Panel: Main stats and graphs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Top metrics grid */}
          <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="metric-card" style={{ padding: "14px 18px", flexDirection: "row", alignItems: "center", gap: "16px" }}>
              <div style={{ flexGrow: 1 }}>
                <span className="metric-card-title" style={{ fontSize: "0.65rem" }}>Avg Temperature</span>
                <div className="metric-card-value-row">
                  <span className="metric-card-value" style={{ fontSize: "1.5rem" }}>{avgTemp.toFixed(1)}°C</span>
                  <svg style={{ width: "12", height: "12", color: "var(--accent-green)", marginLeft: "4px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
                  </svg>
                </div>
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Target: 20-30°C</span>
              </div>
              <div className="sparkline-container">
                <svg width="100%" height="100%" viewBox="0 0 50 20">
                  <polyline fill="none" stroke="var(--accent-green)" strokeWidth={2} points="0,15 10,12 20,16 30,10 40,8 50,5" />
                </svg>
              </div>
            </div>

            <div className="metric-card" style={{ padding: "14px 18px" }}>
              <span className="metric-card-title" style={{ fontSize: "0.65rem" }}>PUE</span>
              <div className="metric-card-value-row">
                <span className="metric-card-value" style={{ fontSize: "1.5rem" }}>{facility.pue.toFixed(2)}</span>
                <span className="metric-card-trend-pill up" style={{ fontSize: "0.6rem", padding: "1px 6px" }}>Efficient</span>
              </div>
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Target: &lt;1.45</span>
            </div>

            <div className="metric-card" style={{ padding: "14px 18px" }}>
              <span className="metric-card-title" style={{ fontSize: "0.65rem" }}>UPS Status</span>
              <div className="metric-card-value-row">
                <span className="metric-card-value" style={{ fontSize: "1.5rem", color: "var(--accent-green)" }}>Online</span>
                <span style={{ fontSize: "0.65rem", fontWeight: "bold", color: "var(--text-secondary)" }}>(98% Battery)</span>
              </div>
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Stable Runtime</span>
            </div>
          </div>

          {/* Interactive isometric server racks */}
          <div className="white-panel">
            <div className="white-panel-header">
              <h3>Facility Infrastructure Layout</h3>
              <div className="isometric-zoom-controls">
                <button className="isometric-zoom-btn" onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}>-</button>
                <span className="isometric-zoom-val">{zoomLevel}%</span>
                <button className="isometric-zoom-btn" onClick={() => setZoomLevel(Math.min(150, zoomLevel + 10))}>+</button>
              </div>
            </div>

            <div className="isometric-view-box">
              <svg width="100%" height="100%" viewBox="0 0 600 320" style={{ transform: `scale(${zoomLevel/100})`, transition: "transform 0.2s ease" }}>
                <path d="M 100 200 L 300 100 L 500 200 L 300 300 Z" fill="#eef2f6" stroke="#cbd5e1" strokeWidth={1} />
                
                {temps.map((temp, index) => {
                  const x = 190 + index * 40;
                  const y = 150 + index * 20;
                  const isHot = temp > 29.0;
                  const leftColor = isHot ? "#f87171" : "#60a5fa";
                  const rightColor = isHot ? "#ef4444" : "#3b82f6";
                  const topColor = isHot ? "#fca5a5" : "#93c5fd";

                  return (
                    <g 
                      key={index} 
                      onClick={() => setSelectedCabinet(index + 1)}
                      style={{ cursor: "pointer" }}
                    >
                      <path d={`M ${x} ${y} L ${x + 20} ${y + 10} L ${x + 20} ${y - 40} L ${x} ${y - 50} Z`} fill={leftColor} stroke="#1e293b" strokeWidth={1.5} />
                      <path d={`M ${x + 20} ${y + 10} L ${x + 40} ${y} L ${x + 40} ${y - 50} L ${x + 20} ${y - 40} Z`} fill={rightColor} stroke="#1e293b" strokeWidth={1.5} />
                      <path d={`M ${x} ${y - 50} L ${x + 20} ${y - 40} L ${x + 40} ${y - 50} L ${x + 20} ${y - 60} Z`} fill={topColor} stroke="#1e293b" strokeWidth={1.5} />
                      <circle cx={x + 20} cy={y - 52} r={3} fill={isHot ? "#ef4444" : "#10b981"} />
                      <text x={x + 20} y={y + 28} fill="var(--text-secondary)" fontSize="7.5" fontWeight="bold" textAnchor="middle">Bay 0{index + 1}</text>
                    </g>
                  );
                })}
              </svg>

              {selectedCabinet && (
                <div style={{
                  position: "absolute",
                  bottom: "16px",
                  left: "16px",
                  background: "rgba(15, 23, 42, 0.95)",
                  color: "white",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.75rem",
                  boxShadow: "var(--shadow-md)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px"
                }}>
                  <strong style={{ color: "var(--accent-blue)" }}>Server Rack Bay-0{selectedCabinet}</strong>
                  <span>Rack Temp: {temps[selectedCabinet - 1]?.toFixed(1)}°C</span>
                  <span>Fan Speed: {fanSpeeds[selectedCabinet - 1] ?? 3000} RPM</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedCabinet(null); }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent-red)",
                      fontWeight: "bold",
                      fontSize: "0.65rem",
                      textAlign: "left",
                      marginTop: "4px",
                      padding: 0
                    }}
                  >
                    Close Overlay
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom telemetry and controls */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "20px" }}>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Heatmap Sensor Cell Map */}
              <div className="white-panel" style={{ padding: "16px" }}>
                <div className="white-panel-header" style={{ border: "none", paddingBottom: "10px" }}>
                  <h3>Rack Sensor Heatmap Grid</h3>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${temps.length}, 1fr)`, gap: "10px", padding: "10px", background: "var(--bg-app)", borderRadius: "6px" }}>
                  {heatmapNodes.map((cell) => (
                    <div 
                      key={cell.id} 
                      style={{
                        backgroundColor: cell.color,
                        padding: "12px",
                        color: "white",
                        borderRadius: "6px",
                        textAlign: "center",
                        fontWeight: "bold",
                        fontSize: "0.85rem"
                      }}
                      title={`Rack ${cell.id}`}
                    >
                      {cell.temp}°C
                    </div>
                  ))}
                </div>

                <div className="heatmap-legend" style={{ marginTop: "12px" }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Heat corridors topological values</span>
                  <div className="heatmap-legend-scale">
                    <span>Cool</span>
                    <div className="heatmap-legend-bar" />
                    <span>Warm</span>
                  </div>
                </div>
              </div>

              {/* PUE Trend curve */}
              <div className="white-panel" style={{ padding: "16px" }}>
                <div className="white-panel-header" style={{ border: "none", paddingBottom: "8px" }}>
                  <h3>PUE Trend</h3>
                  <span style={{ fontSize: "0.7rem", fontWeight: "600" }}>{facility.pue.toFixed(2)} PUE</span>
                </div>
                <div style={{ width: "100%", height: "130px" }}>
                  {facility.pue_trend.length > 0 ? (
                    <svg width="100%" height="100%" viewBox={`0 0 ${pWidth} ${pHeight}`} preserveAspectRatio="none">
                      <line x1={padding} y1={padding} x2={pWidth - padding} y2={padding} stroke="#f1f5f9" strokeWidth={1} />
                      <line x1={padding} y1={pHeight/2} x2={pWidth - padding} y2={pHeight/2} stroke="#f1f5f9" strokeWidth={1} />
                      <line x1={padding} y1={pHeight - padding} x2={pWidth - padding} y2={pHeight - padding} stroke="#f1f5f9" strokeWidth={1} />
                      
                      {trendPoints && <polyline fill="none" stroke="var(--primary-color)" strokeWidth={2.5} points={trendPoints} />}
                      
                      {facility.pue_trend.map((point, idx) => {
                        const x = padding + (idx * (pWidth - padding * 2)) / (facility.pue_trend.length - 1);
                        const minP = 1.0;
                        const maxP = 1.6;
                        const ratio = (point.pue - minP) / (maxP - minP);
                        const y = pHeight - padding - ratio * (pHeight - padding * 2);
                        return (
                          <circle key={idx} cx={x} cy={y} r={3.5} fill="var(--primary-color)" stroke="white" strokeWidth={1.5} />
                        );
                      })}

                      {facility.pue_trend.map((point, idx) => {
                        const x = padding + (idx * (pWidth - padding * 2)) / (facility.pue_trend.length - 1);
                        const date = new Date(point.timestamp);
                        const timeStr = isNaN(date.getTime()) ? point.timestamp.substring(11, 16) : date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
                        return (
                          <text key={idx} x={x} y={pHeight - 2} fontSize="7.5" fill="#94a3b8" textAnchor="middle">
                            {timeStr}
                          </text>
                        );
                      })}
                    </svg>
                  ) : (
                    <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Trend data missing.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cooling Metrics & System status */}
            <div className="white-panel" style={{ gap: "14px" }}>
              <div className="white-panel-header" style={{ paddingBottom: "6px" }}>
                <h3>Cooling Metrics</h3>
              </div>
              
              {overview && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "var(--bg-app)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-main)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-main)", paddingBottom: "4px" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Outlet Temperature:</span>
                    <strong style={{ fontSize: "0.75rem" }}>{overview.outlet_temperature?.toFixed(2)}°C</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-main)", paddingBottom: "4px" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Temperature Deviation:</span>
                    <strong style={{ fontSize: "0.75rem" }}>{overview.temperature_deviation?.toFixed(2)}°C</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Water Usage Meter:</span>
                    <strong style={{ fontSize: "0.75rem" }}>{overview.water_usage?.toFixed(3)} L</strong>
                  </div>
                </div>
              )}

              <div className="white-panel-header" style={{ border: "none", paddingBottom: "4px", marginTop: "4px" }}>
                <h3>Variable Fan Control</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div className="cooling-unit-row">
                  <div>
                    <span className="cooling-unit-name">CRAC-1</span>
                    <p className="cooling-unit-meta">Load: {crac1Load}%</p>
                  </div>
                  <div className="cooling-unit-adjusters">
                    <button className="cooling-unit-btn" onClick={() => setCrac1Load(Math.max(10, crac1Load - 5))}>-</button>
                    <button className="cooling-unit-btn" onClick={() => setCrac1Load(Math.min(100, crac1Load + 5))}>+</button>
                  </div>
                </div>

                <div className="cooling-unit-row">
                  <div>
                    <span className="cooling-unit-name">CRAC-2</span>
                    <p className="cooling-unit-meta">Load: {crac2Load}%</p>
                  </div>
                  <div className="cooling-unit-adjusters">
                    <button className="cooling-unit-btn" onClick={() => setCrac2Load(Math.max(10, crac2Load - 5))}>-</button>
                    <button className="cooling-unit-btn" onClick={() => setCrac2Load(Math.min(100, crac2Load + 5))}>+</button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
