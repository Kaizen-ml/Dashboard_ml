import React, { useState, useEffect } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import FacilitySection from "@/components/FacilitySection";
import GridPricesSection from "@/components/GridPricesSection";
import OverviewSection from "@/components/OverviewSection";
import SavingsReportsSection from "@/components/SavingsReportsSection";
import WorkloadsSection from "@/components/WorkloadsSection";

export default function App() {
  const { data, loading, error } = useDashboardData();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [localTime, setLocalTime] = useState<string>("2026-06-14 GMT");

  useEffect(() => {
    // Keep local GMT time formatted nicely
    const updateTime = () => {
      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(now.getUTCDate()).padStart(2, "0");
      const hh = String(now.getUTCHours()).padStart(2, "0");
      const min = String(now.getUTCMinutes()).padStart(2, "0");
      setLocalTime(`${yyyy}-${mm}-${dd} ${hh}:${min} GMT`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "16px",
        backgroundColor: "#f8fafd",
        fontFamily: "var(--font-sans)"
      }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: "4px solid #eef2f6",
          borderTopColor: "#2563eb",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}} />
        <span style={{ fontSize: "0.9rem", color: "#475569", fontWeight: 500 }}>Initializing Live Optimization Telemetry...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: "flex",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "12px",
        backgroundColor: "#fef2f2",
        color: "#b91c1c",
        padding: "24px",
        fontFamily: "var(--font-sans)",
        textAlign: "center"
      }}>
        <svg style={{ width: "48px", height: "48px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Connection Offline</h2>
        <p style={{ fontSize: "0.85rem", color: "#7f1d1d", maxWidth: "400px" }}>{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          style={{
            marginTop: "12px",
            backgroundColor: "#ef4444",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "0.8rem"
          }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const renderActiveSection = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewSection overview={data.overview} grid={data.grid} facility={data.facility} />;
      case "workloads":
        return <WorkloadsSection workloads={data.workloads} overview={data.overview} />;
      case "facility":
        return <FacilitySection facility={data.facility} overview={data.overview} />;
      case "grid":
        return <GridPricesSection grid={data.grid} overview={data.overview} />;
      case "savings":
        return <SavingsReportsSection recommendation={data.recommendation} overview={data.overview} />;
      default:
        return <OverviewSection overview={data.overview} />;
    }
  };

  const getPageHeaderTitle = () => {
    switch (activeTab) {
      case "overview": return "Overview Monitoring";
      case "workloads": return "Workloads Monitoring";
      case "facility": return "Facility Monitoring";
      case "grid": return "Grid & Prices Monitoring";
      case "savings": return "Savings & Reports Monitoring";
      default: return "Dashboard";
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-icon">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="brand-text">
              <h2>Data Center Ops</h2>
              <span>Cockpit Console</span>
            </div>
          </div>

          <nav>
            <ul className="menu-list">
              <li>
                <button 
                  className={`menu-item ${activeTab === "overview" ? "active" : ""}`}
                  onClick={() => setActiveTab("overview")}
                >
                  <svg className="menu-item-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9-7h2a2 2 0 012 2v5a2 2 0 01-2 2h-2a2 2 0 01-2-2v-5a2 2 0 012-2z" />
                  </svg>
                  <div className="menu-item-text">
                    <strong>Overview</strong>
                    <span className="desc">SLA risk & aggregates</span>
                  </div>
                </button>
              </li>
              <li>
                <button 
                  className={`menu-item ${activeTab === "workloads" ? "active" : ""}`}
                  onClick={() => setActiveTab("workloads")}
                >
                  <svg className="menu-item-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <div className="menu-item-text">
                    <strong>Workloads</strong>
                    <span className="desc">Batch & core schedules</span>
                  </div>
                </button>
              </li>
              <li>
                <button 
                  className={`menu-item ${activeTab === "facility" ? "active" : ""}`}
                  onClick={() => setActiveTab("facility")}
                >
                  <svg className="menu-item-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  <div className="menu-item-text">
                    <strong>Facility</strong>
                    <span className="desc">Isometric grid temperatures</span>
                  </div>
                </button>
              </li>
              <li>
                <button 
                  className={`menu-item ${activeTab === "grid" ? "active" : ""}`}
                  onClick={() => setActiveTab("grid")}
                >
                  <svg className="menu-item-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div className="menu-item-text">
                    <strong>Grid & Prices</strong>
                    <span className="desc">Dynamic pricing markets</span>
                  </div>
                </button>
              </li>
              <li>
                <button 
                  className={`menu-item ${activeTab === "savings" ? "active" : ""}`}
                  onClick={() => setActiveTab("savings")}
                >
                  <svg className="menu-item-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <div className="menu-item-text">
                    <strong>Savings & Reports</strong>
                    <span className="desc">Download compliance ledgers</span>
                  </div>
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="esg-badge">
            <svg className="esg-badge-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span>Platinum ESG Rating</span>
          </div>
          <div className="status-footer">
            <span className="sandbox">Sandbox Mode Active</span>
            <span>Local Time: {localTime}</span>
          </div>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        <header className="page-header">
          <div className="page-header-title">
            <h1>{getPageHeaderTitle()}</h1>
          </div>
          <div className="page-header-actions">
            <div className="cluster-pill">
              <span className="cluster-indicator"></span>
              <span>Active Core Cluster: 1,245 Jobs online</span>
            </div>
            <button className="notifications-btn">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="notification-badge"></span>
            </button>
            <div className="user-profile">
              <div className="avatar">PB</div>
              <div className="user-info">
                <span className="user-name">Parth B.</span>
                <span className="user-role">System Operator</span>
              </div>
            </div>
          </div>
        </header>

        <div className="section-content">
          {renderActiveSection()}
        </div>
      </main>
    </div>
  );
}
