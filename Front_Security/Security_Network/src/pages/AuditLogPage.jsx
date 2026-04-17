import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardList, RefreshCw, AlertTriangle, CheckCircle2,
  Download, Activity, Clock, Filter,
} from 'lucide-react';
import { getAuditLog } from '../api.js';
import { useToast } from '../Toast.jsx';
import {
  PageHeader, StatCard, SectionCard, EmptyState,
  LoadingPage, ResultPill, ConfidencePill, Badge,
} from '../ui.jsx';

const LIMIT_OPTIONS = [25, 50, 100, 200, 500];

/* ── Download CSV ──────────────────────────────────────────────── */
function downloadCSV(entries) {
  const header = 'timestamp,model_version,result,confidence\n';
  const rows   = entries.map(e =>
    `${e.timestamp},${e.model_version ?? ''},${e.result},${e.confidence ?? ''}`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `audit-log-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Audit Log Page ────────────────────────────────────────────── */
export default function AuditLogPage() {
  const [entries,  setEntries]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [limit,    setLimit]    = useState(50);
  const [filter,   setFilter]   = useState('all');   // all | THREAT | BENIGN
  const [loading,  setLoading]  = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const toast = useToast();

  const fetchLog = useCallback(async (silent = false, l = limit) => {
    if (!silent) setLoading(true);
    try {
      const res = await getAuditLog(l);
      setEntries(res.entries ?? []);
      setTotal(res.total ?? 0);
      setLastSync(new Date());
    } catch {
      toast('Failed to load audit log', 'error');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { fetchLog(); }, []);
  useEffect(() => { fetchLog(true, limit); }, [limit]);

  // Auto-refresh every 10 s
  useEffect(() => {
    const id = setInterval(() => fetchLog(true, limit), 10_000);
    return () => clearInterval(id);
  }, [limit, fetchLog]);

  const threats = entries.filter(e => e.result === 'THREAT').length;
  const benign  = entries.filter(e => e.result === 'BENIGN').length;
  const avgConf = entries.length
    ? (entries.reduce((s, e) => s + (e.confidence ?? 0), 0) / entries.length * 100).toFixed(1)
    : null;

  const filtered = filter === 'all' ? entries : entries.filter(e => e.result === filter);

  if (loading) return <LoadingPage label="Loading audit log…" />;

  return (
    <div className="page fade-up">
      <PageHeader
        icon={ClipboardList}
        title="Audit Log"
        subtitle={`Complete prediction history — auto-refreshes every 10 s · ${total} total entries`}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => fetchLog(true, limit)}>
              <RefreshCw size={13} /> Refresh
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => downloadCSV(filtered)} disabled={!entries.length}>
              <Download size={13} /> Export CSV
            </button>
          </div>
        }
      />

      {/* ── KPIs ── */}
      <div className="grid-4 mb-s">
        <StatCard icon={Activity}      label="Total Logged"      value={total}                    sub="All-time predictions" color="cyan"   delay={0}   />
        <StatCard icon={AlertTriangle} label="Threats Detected"  value={threats}                  sub="In current view"      color="red"    delay={60}  />
        <StatCard icon={CheckCircle2}  label="Benign Traffic"    value={benign}                   sub="In current view"      color="green"  delay={120} />
        <StatCard icon={Clock}         label="Avg Confidence"    value={avgConf ? `${avgConf}%` : '—'} sub="Mean model certainty" color="amber" delay={180} />
      </div>

      {/* ── Filters bar ── */}
      <div className="filters-bar mb-s">
        <div className="filter-group">
          <Filter size={13} />
          <span className="filter-label">Filter:</span>
          {['all', 'THREAT', 'BENIGN'].map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'fb-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f}
              {f === 'THREAT' && ` (${threats})`}
              {f === 'BENIGN' && ` (${benign})`}
              {f === 'all'    && ` (${entries.length})`}
            </button>
          ))}
        </div>
        <div className="limit-group">
          <span className="filter-label">Show:</span>
          {LIMIT_OPTIONS.map(l => (
            <button
              key={l}
              className={`filter-btn ${limit === l ? 'fb-active' : ''}`}
              onClick={() => setLimit(l)}
            >
              {l}
            </button>
          ))}
        </div>
        {lastSync && (
          <span className="sync-label">
            <RefreshCw size={10} /> {lastSync.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* ── Table ── */}
      <SectionCard
        title="Prediction Entries"
        subtitle={`Showing ${filtered.length} of ${entries.length} entries`}
        icon={ClipboardList}
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No entries found"
            desc="Run a prediction via the Predict page to populate this log."
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table audit-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Timestamp</th>
                  <th>Result</th>
                  <th>Confidence</th>
                  <th>Model Version</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={i} className={`data-row ${e.result === 'THREAT' ? 'row-threat' : 'row-benign'}`}>
                    <td className="mono text-xs text-muted">{String(i + 1).padStart(4, '0')}</td>
                    <td className="mono text-xs">{e.timestamp}</td>
                    <td><ResultPill result={e.result} /></td>
                    <td><ConfidencePill value={e.confidence} /></td>
                    <td>
                      {e.model_version
                        ? <span className="mono text-xs text-cyan">{e.model_version}</span>
                        : <span className="text-muted text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
