import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Activity, Database, Layers,
  TrendingUp, Zap, RefreshCw, GitBranch, Shield,
  Clock, BarChart2, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getVersions, getMetricsHistory, getAuditLog } from '../api.js';
import { useToast } from '../Toast.jsx';
import {
  PageHeader, StatCard, SectionCard, Badge,
  StatusPill, MetricBar, LoadingPage, EmptyState, LiveDot,
} from '../ui.jsx';

/* ── Custom recharts Tooltip ───────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="chart-tip-row" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span>{p.value}%</span>
        </div>
      ))}
    </div>
  );
};

/* ── Audit mini-table ──────────────────────────────────────────── */
function AuditMini({ entries }) {
  if (!entries?.length)
    return <EmptyState icon={Activity} title="No predictions yet" desc="Upload a CSV via the Predict page to see logs here." />;
  return (
    <div className="audit-mini">
      <table className="data-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Result</th>
            <th>Confidence</th>
            <th>Model</th>
          </tr>
        </thead>
        <tbody>
          {entries.slice(0, 6).map((e, i) => (
            <tr key={i} className={e.result === 'THREAT' ? 'row-threat' : 'row-benign'}>
              <td className="mono text-sm">{e.timestamp}</td>
              <td>
                <span className={`result-pill ${e.result === 'THREAT' ? 'rp-threat' : 'rp-benign'}`}>
                  {e.result === 'THREAT' ? '⚠ THREAT' : '✓ BENIGN'}
                </span>
              </td>
              <td>
                {e.confidence != null
                  ? <span className={`conf-pill cp-${Math.round(e.confidence * 100) >= 80 ? 'green' : Math.round(e.confidence * 100) >= 60 ? 'amber' : 'red'}`}>
                      {Math.round(e.confidence * 100)}%
                    </span>
                  : <span className="text-muted">—</span>}
              </td>
              <td className="mono text-xs text-muted">{e.model_version ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────── */
export default function Dashboard() {
  const [versions, setVersions]   = useState(null);
  const [history,  setHistory]    = useState([]);
  const [audit,    setAudit]      = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [lastSync, setLastSync]   = useState(null);
  const toast = useToast();

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [v, h, a] = await Promise.all([
        getVersions(),
        getMetricsHistory(),
        getAuditLog(50),
      ]);
      setVersions(v);
      setHistory(h.history || []);
      setAudit(a.entries || []);
      setLastSync(new Date());
    } catch {
      toast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  // Auto-refresh every 30 s
  useEffect(() => {
    const id = setInterval(() => fetchAll(true), 30_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  if (loading) return <LoadingPage label="Loading security dashboard…" />;

  const isLive  = !!versions?.current_version;
  const latest  = history[history.length - 1];

  // Threat vs Benign count from recent audit
  const threatCount  = audit.filter(e => e.result === 'THREAT').length;
  const benignCount  = audit.filter(e => e.result === 'BENIGN').length;
  const totalPreds   = audit.length;

  return (
    <div className="page fade-up">
      <PageHeader
        icon={LayoutDashboard}
        title="Security Dashboard"
        subtitle="Real-time network security intelligence — auto-refreshes every 30 s"
        badge={
          <StatusPill color={isLive ? 'green' : 'red'}>
            {isLive ? 'Model Active' : 'No Model Loaded'}
          </StatusPill>
        }
        action={
          <button className="btn btn-ghost btn-sm" onClick={() => fetchAll(true)}>
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      {/* ── KPI Row ── */}
      <div className="grid-4 mb-s">
        <StatCard icon={Database}    label="Active Model"    value={versions?.current_version || 'None'} sub="Deployed version"      color="cyan"   delay={0}   />
        <StatCard icon={Layers}      label="Total Versions"  value={versions?.count ?? 0}                sub="In HF registry"        color="indigo" delay={60}  />
        <StatCard icon={TrendingUp}  label="Best F1 Score"   value={latest?.f1   != null ? `${latest.f1}%`   : '—'} sub="Latest model"   color="green"  delay={120} />
        <StatCard icon={Zap}         label="Watcher Interval" value="30 s"                              sub="Auto-sync cadence"     color="amber"  delay={180} />
      </div>

      {/* ── Metrics chart + Current model metrics ── */}
      <div className="dash-mid mb-s">
        <SectionCard
          title="Metric History"
          subtitle="F1 · Precision · Recall across all versions"
          icon={BarChart2}
          className="chart-card"
        >
          {history.length < 2 ? (
            <EmptyState
              icon={BarChart2}
              title="Awaiting data"
              desc="Train at least 2 models to see the metric evolution chart."
            />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gF1"  x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPr"  x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00ff88" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRe"  x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="version" tick={{ fontSize: 10, fill: '#5a7a9a' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#5a7a9a' }} unit="%" />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} />
                <Area type="monotone" dataKey="f1"        name="F1"        stroke="#00d4ff" fill="url(#gF1)" strokeWidth={2} dot={{ r: 3, fill: '#00d4ff' }} />
                <Area type="monotone" dataKey="precision" name="Precision" stroke="#00ff88" fill="url(#gPr)" strokeWidth={2} dot={{ r: 3, fill: '#00ff88' }} />
                <Area type="monotone" dataKey="recall"    name="Recall"    stroke="#6366f1" fill="url(#gRe)" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Live Model Metrics" subtitle="Currently active version" icon={Shield}>
          {!latest ? (
            <EmptyState icon={Shield} title="No metrics available" desc="Train a model to populate metrics." />
          ) : (
            <div className="metrics-bars">
              <MetricBar label="F1 Score"       value={latest.f1}        color="cyan"   />
              <MetricBar label="Precision"      value={latest.precision} color="green"  />
              <MetricBar label="Recall"         value={latest.recall}    color="indigo" />
              <MetricBar label="Train F1"       value={latest.train_f1}  color="amber"  />
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Prediction summary + Audit stream ── */}
      <div className="dash-bottom mb-s">
        <SectionCard title="Prediction Summary" subtitle="Last 50 predictions" icon={Activity}>
          <div className="pred-summary">
            <div className="pred-sum-row">
              <div className="pred-sum-item">
                <div className="pred-sum-val text-success">{benignCount}</div>
                <div className="pred-sum-label">✓ Benign</div>
              </div>
              <div className="pred-sum-divider" />
              <div className="pred-sum-item">
                <div className="pred-sum-val text-danger">{threatCount}</div>
                <div className="pred-sum-label">⚠ Threats</div>
              </div>
              <div className="pred-sum-divider" />
              <div className="pred-sum-item">
                <div className="pred-sum-val text-cyan">{totalPreds}</div>
                <div className="pred-sum-label">Total</div>
              </div>
            </div>
            {totalPreds > 0 && (
              <div className="threat-bar-wrap">
                <div className="threat-bar">
                  <div className="tb-benign" style={{ width: `${(benignCount / totalPreds) * 100}%` }} />
                  <div className="tb-threat"  style={{ width: `${(threatCount / totalPreds) * 100}%` }} />
                </div>
                <div className="tb-labels">
                  <span className="text-success">{((benignCount / totalPreds) * 100).toFixed(1)}% benign</span>
                  <span className="text-danger">{((threatCount / totalPreds) * 100).toFixed(1)}% threat</span>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Recent Audit Log" subtitle={`${audit.length} entries`} icon={Clock}>
          <AuditMini entries={audit} />
        </SectionCard>
      </div>

      {lastSync && (
        <p className="sync-label">
          <RefreshCw size={11} /> Last synced: {lastSync.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
