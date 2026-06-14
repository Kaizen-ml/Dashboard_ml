import React, { useState } from "react";

interface WorkloadJob {
  job_id: string;
  workload: number;
  status: string;
  expected_energy_cost: number;
  expected_water_usage: number;
  power: number;
  CPU: number;
}

interface WorkloadsSectionProps {
  workloads: WorkloadJob[] | null;
  overview?: any;
}

export default function WorkloadsSection({ workloads, overview }: WorkloadsSectionProps) {
  const [localWorkloads, setLocalWorkloads] = useState<any[]>(workloads || []);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  const handleToggleStatus = (jobId: string) => {
    setLocalWorkloads(localWorkloads.map(job => {
      if (job.job_id === jobId) {
        const nextStatus = job.status === "RUNNING" ? "THROTTLED" : (job.status === "THROTTLED" ? "QUEUED" : "RUNNING");
        const nextPower = nextStatus === "RUNNING" ? (job.CPU > 0 ? job.CPU * 0.25 : 15.0) : (nextStatus === "THROTTLED" ? 1.5 : 0.0);
        return { ...job, status: nextStatus, power: nextPower };
      }
      return job;
    }));
  };

  const handleDeleteJob = (jobId: string) => {
    setLocalWorkloads(localWorkloads.filter(job => job.job_id !== jobId));
  };

  const handleShedLowPriority = () => {
    setLocalWorkloads(localWorkloads.map(job => {
      if (job.workload < 50 && job.status === "RUNNING") {
        return { ...job, status: "THROTTLED", power: 1.5 };
      }
      return job;
    }));
  };

  const handleDispatchQueued = () => {
    setLocalWorkloads(localWorkloads.map(job => {
      if (job.status === "QUEUED") {
        return { ...job, status: "RUNNING", power: 18.0 };
      }
      return job;
    }));
  };

  const handleAddJob = () => {
    const newId = `JOB-00${localWorkloads.length + 1}`;
    const newJob = {
      job_id: newId,
      workload: Math.round(Math.random() * 50 + 40),
      status: "QUEUED",
      expected_energy_cost: 0.07,
      expected_water_usage: 0.18,
      power: 0.0,
      CPU: Math.round(Math.random() * 40 + 50)
    };
    setLocalWorkloads([...localWorkloads, newJob]);
  };

  // Status counts based on actual data list
  const runningCount = localWorkloads.filter(j => j.status === "RUNNING").length;
  const queuedCount = localWorkloads.filter(j => j.status === "QUEUED").length;
  const throttledCount = localWorkloads.filter(j => j.status === "THROTTLED").length;

  const totalPower = localWorkloads.reduce((sum, j) => sum + (j.power || 0), 0);

  // Filter workloads based on search and selected tab
  const filteredWorkloads = localWorkloads.filter(job => {
    const searchMatch = job.job_id.toLowerCase().includes(searchTerm.toLowerCase());
    const filterMatch = activeFilter === "ALL" || job.status === activeFilter;
    return searchMatch && filterMatch;
  });

  return (
    <>
      <div className="section-title-area">
        <div>
          <h2>Workload Management</h2>
          <p>Data Center Grid Coordination • Live job throttling controls for Demand Response (DR)</p>
        </div>
        <button className="btn-primary" onClick={handleAddJob}>
          + Provision Workload
        </button>
      </div>

      {/* Aggregate metrics */}
      <div className="metrics-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-card-title">Total Active Jobs</span>
            <div className="metric-card-icon-wrapper" style={{ backgroundColor: "#ecfdf5", color: "#10b981" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div className="metric-card-value-row">
            <span className="metric-card-value">{localWorkloads.length}</span>
            <span className="metric-card-trend-pill up" style={{ fontSize: "0.65rem" }}>Scheduler running</span>
          </div>
          <span className="metric-card-desc">
            {runningCount} Running • {queuedCount} Queued • {throttledCount} Throttled
          </span>
        </div>

        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-card-title">Total Workloads Power</span>
            <div className="metric-card-icon-wrapper" style={{ backgroundColor: "#f5f3ff", color: "#8b5cf6" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div className="metric-card-value-row">
            <span className="metric-card-value" style={{ color: "var(--accent-purple)" }}>
              {totalPower.toFixed(1)} kW
            </span>
            <span className="metric-card-desc" style={{ marginLeft: "8px" }}>
              active workloads compute draw
            </span>
          </div>
          <span className="metric-card-desc">Sum of power from active telemetry</span>
        </div>
      </div>

      {/* Table grid */}
      <div className="table-panel">
        <div className="table-controls">
          <div className="search-input-wrapper">
            <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              className="search-input" 
              type="text" 
              placeholder="Search by job ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="table-filter-tabs">
            <button className={`table-filter-btn ${activeFilter === "ALL" ? "active" : ""}`} onClick={() => setActiveFilter("ALL")}>All</button>
            <button className={`table-filter-btn ${activeFilter === "RUNNING" ? "active" : ""}`} onClick={() => setActiveFilter("RUNNING")}>Running</button>
            <button className={`table-filter-btn ${activeFilter === "QUEUED" ? "active" : ""}`} onClick={() => setActiveFilter("QUEUED")}>Queued</button>
            <button className={`table-filter-btn ${activeFilter === "THROTTLED" ? "active" : ""}`} onClick={() => setActiveFilter("THROTTLED")}>Throttled</button>
          </div>

          <div className="table-action-row">
            <button className="btn-purple-outline" onClick={handleShedLowPriority}>Shed Low Priority</button>
            <button className="btn-green-outline" onClick={handleDispatchQueued}>Dispatch Queued</button>
          </div>
        </div>

        <table className="jobs-table-element">
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Workload</th>
              <th>Status</th>
              <th>CPU Capacity</th>
              <th>Power consumption</th>
              <th>Expected Energy Cost</th>
              <th>Expected Water Usage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkloads.length > 0 ? (
              filteredWorkloads.map((job) => {
                return (
                  <tr key={job.job_id}>
                    <td>
                      <strong className="job-title">{job.job_id}</strong>
                    </td>
                    <td>
                      {job.workload.toFixed(1)}%
                    </td>
                    <td>
                      <button 
                        style={{ border: "none", background: "none", padding: 0 }}
                        onClick={() => handleToggleStatus(job.job_id)}
                      >
                        <span className={`status-pill ${job.status.toLowerCase()}`}>
                          <span className="status-indicator-dot"></span>
                          {job.status}
                        </span>
                      </button>
                    </td>
                    <td>
                      {job.CPU.toFixed(1)}%
                    </td>
                    <td style={{ fontWeight: "600" }}>
                      {job.power.toFixed(1)} kW
                    </td>
                    <td>
                      ${job.expected_energy_cost.toFixed(3)}
                    </td>
                    <td>
                      {job.expected_water_usage.toFixed(3)} L
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button className="action-icon-btn" title="Toggle state" onClick={() => handleToggleStatus(job.job_id)}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                          </svg>
                        </button>
                        <button className="action-icon-btn" title="Delete job" onClick={() => handleDeleteJob(job.job_id)}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                  No workloads match the active filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        <div className="table-footer">
          <span className="table-info">Showing {filteredWorkloads.length} of {localWorkloads.length} workloads</span>
          <div className="pagination">
            <button className="page-btn active">1</button>
          </div>
        </div>
      </div>

      {/* Rationale confidence grid */}
      {overview && (
        <div className="white-panel" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
          <div>
            <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-main)", paddingBottom: "10px", marginBottom: "14px" }}>RL Agent Strategy</h3>
            <div style={{
              background: "var(--bg-app)",
              padding: "16px",
              borderRadius: "8px",
              borderLeft: `4px solid ${overview.recommended_strategy === 'HYBRID' ? 'var(--accent-amber)' : (overview.recommended_strategy === 'LIQUID' ? 'var(--accent-green)' : 'var(--text-muted)')}`
            }}>
              <span style={{ fontSize: "0.75rem", display: "block", color: "var(--text-muted)", marginBottom: "4px" }}>Active Recommendation</span>
              <span className={`status-pill ${overview.recommended_strategy === 'AIR' ? 'throttled' : (overview.recommended_strategy === 'LIQUID' ? 'running' : 'queued')}`}>
                {overview.recommended_strategy}
              </span>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "10px", lineHeight: "1.4" }}>
                Reinforcement Learning model recommends using <strong>{overview.recommended_strategy} cooling</strong> based on thermal profiles and current loads.
              </p>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-main)", paddingBottom: "10px", marginBottom: "14px" }}>Model Confidence Levels</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "10px" }}>
              {overview.confidence && Object.entries(overview.confidence).map(([key, value]: [string, any]) => (
                <div 
                  key={key} 
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--bg-app)",
                    border: "1px solid var(--border-main)",
                    borderRadius: "6px"
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "capitalize" }}>
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className={`priority-badge ${value === "HIGH" ? "high" : "low"}`} style={{ 
                    fontSize: "0.6rem", 
                    backgroundColor: value === "HIGH" ? "var(--accent-green-bg)" : "var(--accent-amber-bg)",
                    color: value === "HIGH" ? "var(--accent-green-text)" : "var(--accent-amber-text)"
                  }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
