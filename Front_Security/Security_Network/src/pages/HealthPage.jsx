import React, { useState, useEffect } from 'react';
import { checkHealth } from '../api';
import { Activity, ShieldCheck, Clock, Server, AlertTriangle, RefreshCw } from 'lucide-react';

const HealthPage = () => {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await checkHealth();
      setHealthData(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Health check failed:', err);
      setError('Backend service unreachable');
      setHealthData(null);
    } finally {
      setTimeout(() => setLoading(false), 500); // 500ms delay for smoother UX
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (error) return 'var(--red)';
    if (healthData?.status === 'ok') return 'var(--emerald)';
    return 'var(--amber)';
  };

  const getStatusText = () => {
    if (error) return 'SERVICE OFFLINE';
    if (healthData?.status === 'ok') return 'SYSTEM HEALTHY';
    return 'SYSTEM DEGRADED';
  };

  return (
    <div className="page fade-in">
      <header className="page-header">
        <div className="ph-left">
           <div className="page-icon">
              <Activity size={22} />
           </div>
           <div>
              <h1 className="page-title">System Health</h1>
              <p className="page-subtitle">Real-time telemetry and infrastructure status</p>
           </div>
        </div>
        <div className="ph-right">
          <button className="btn btn-ghost btn-sm" onClick={fetchHealth} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
            {loading ? 'Polling...' : 'Sync Now'}
          </button>
        </div>
      </header>

      <div className="health-content fade-up" style={{ animationDelay: '0.1s' }}>
        {/* Main Status Hero */}
        <div className="status-hero" style={{ '--accent': getStatusColor() }}>
          <div className="hero-glow" />
          <div className="status-header">
            <span className="hero-dot" style={{ background: getStatusColor(), boxShadow: `0 0 20px ${getStatusColor()}` }} />
            <h2 className="hero-title">{getStatusText()}</h2>
          </div>
          <div className="hero-meta">
            <Clock size={12} />
            <span>Last sweep completed at {lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Vital Cards */}
        <div className="grid-4 mb-s">
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Communication</span>
              <div className={`stat-icon-wrap ${error ? 'ic-red' : 'ic-green'}`}>
                <Server size={16} />
              </div>
            </div>
            <div className={`stat-value ${error ? 'text-danger' : 'text-success'}`}>
              {error ? 'ERR_CONN' : 'STABLE'}
            </div>
            <div className="stat-sub">API Endpoint Alive</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">ML Core</span>
              <div className={`stat-icon-wrap ${healthData?.model_loaded ? 'ic-cyan' : 'ic-amber'}`}>
                <ShieldCheck size={16} />
              </div>
            </div>
            <div className={`stat-value ${healthData?.model_loaded ? 'text-cyan' : 'text-warning'}`}>
              {healthData?.model_loaded ? 'ACTIVE' : 'IDLE'}
            </div>
            <div className="stat-sub">Memory Weights Loaded</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">Schema Version</span>
              <div className="stat-icon-wrap ic-indigo">
                <Activity size={16} />
              </div>
            </div>
            <div className="stat-value text-indigo">
              {healthData?.current_version || 'NONE'}
            </div>
            <div className="stat-sub">Live Production Model</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-label">System Uptime</span>
              <div className="stat-icon-wrap ic-cyan">
                <Clock size={16} />
              </div>
            </div>
            <div className="stat-value">
              {healthData?.uptime_seconds ? `${Math.floor(healthData.uptime_seconds / 60)} min` : '0 min'}
            </div>
            <div className="stat-sub">Server Process Delta</div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="health-alert">
            <AlertTriangle size={20} className="text-danger" />
            <div className="alert-content">
              <h4>Remote Service Unreachable</h4>
              <p>The frontend is unable to handshake with <code>localhost:8000/health</code>. Verify the FastAPI backend is running.</p>
            </div>
          </div>
        )}

        {/* Technical Data */}
        <div className="section-card">
          <div className="sc-header">
            <div className="sc-icon"><Server size={16} /></div>
            <div className="sc-titles">
              <h3 className="sc-title">Raw Telemetry</h3>
              <p className="sc-sub">Backend JSON Response Metadata</p>
            </div>
          </div>
          <div className="sc-body">
             <div className="telemetry-box">
                <code>{JSON.stringify(healthData || { status: 'requesting...', error: error }, null, 2)}</code>
             </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .health-content { display: flex; flex-direction: column; gap: 1.25rem; }
        
        .status-hero {
          position: relative;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          overflow: hidden;
          text-align: center;
        }
        .hero-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, var(--accent), transparent 70%);
          opacity: 0.05;
        }
        .status-header { display: flex; align-items: center; gap: 1.25rem; z-index: 1; }
        .hero-title {
          font-size: 2.25rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin: 0;
          background: linear-gradient(to bottom, #fff, var(--text-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-dot {
          width: 14px; height: 14px; border-radius: 50%;
          animation: glow-pulse 2s infinite;
        }
        .hero-meta {
          display: flex; align-items: center; gap: 8px;
          font-size: 0.75rem; color: var(--text-muted);
          font-family: 'JetBrains Mono', monospace;
          z-index: 1;
        }

        .telemetry-box {
          background: rgba(0,0,0,0.2);
          border-radius: var(--radius-sm);
          padding: 1.25rem;
          border: 1px solid var(--border);
          overflow-x: auto;
        }
        .telemetry-box code {
          background: none;
          color: var(--cyan);
          white-space: pre-wrap;
          font-size: 0.8rem;
          padding: 0;
        }

        .health-alert {
          display: flex; gap: 1rem;
          padding: 1.25rem;
          background: rgba(255, 71, 87, 0.05);
          border: 1px solid rgba(255, 71, 87, 0.15);
          border-radius: var(--radius-md);
          animation: fadeUp 0.4s ease;
        }
        .alert-content h4 { margin: 0 0 4px; color: var(--red); font-size: 0.95rem; }
        .alert-content p { margin: 0; font-size: 0.82rem; }

        .spin-anim { animation: spin 1s linear infinite; }
      `}} />
    </div>
  );
};

export default HealthPage;
