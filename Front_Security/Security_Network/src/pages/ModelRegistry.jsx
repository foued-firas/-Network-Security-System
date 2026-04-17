import { useState, useEffect, useCallback } from 'react';
import {
  Server, RotateCcw, RefreshCw, GitBranch, Layers,
  Database, Award, AlertTriangle, GitCompare, X,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { getVersions, compareVersions, rollback } from '../api.js';
import { useToast } from '../Toast.jsx';
import {
  PageHeader, StatCard, SectionCard, Badge,
  Modal, EmptyState, LoadingPage, MetricBar, DeltaChip, Btn,
} from '../ui.jsx';

/* ── Compare Modal ─────────────────────────────────────────────── */
function CompareModal({ versions, onClose }) {
  const [v1, setV1]     = useState('');
  const [v2, setV2]     = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const run = async () => {
    if (!v1 || !v2 || v1 === v2) {
      toast('Select two different versions', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await compareVersions(v1, v2);
      if (res.error) throw new Error(res.error);
      setData(res);
    } catch (e) {
      toast(e.message || 'Comparison failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const METRICS = ['f1_score', 'precision', 'recall', 'train_f1_score'];
  const LABELS  = { f1_score: 'F1', precision: 'Precision', recall: 'Recall', train_f1_score: 'Train F1' };

  const radarData = data
    ? METRICS.map(k => ({
        metric: LABELS[k],
        [v1]:   data.diff[k]?.v1 ?? 0,
        [v2]:   data.diff[k]?.v2 ?? 0,
      }))
    : [];

  return (
    <Modal onClose={onClose} width={620}>
      <h2 className="modal-title"><GitCompare size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Compare Versions</h2>
      <p className="modal-body">Select two model versions to diff their performance metrics.</p>

      <div className="compare-selectors">
        <div className="compare-sel-group">
          <label className="sel-label">Version A</label>
          <select className="sel-input" value={v1} onChange={e => setV1(e.target.value)}>
            <option value="">Select…</option>
            {versions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="compare-vs">VS</div>
        <div className="compare-sel-group">
          <label className="sel-label">Version B</label>
          <select className="sel-input" value={v2} onChange={e => setV2(e.target.value)}>
            <option value="">Select…</option>
            {versions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <Btn onClick={run} disabled={loading || !v1 || !v2} className="compare-run-btn">
        {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Comparing…</> : 'Compare'}
      </Btn>

      {data && (
        <>
          <div className="compare-radar">
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#5a7a9a', fontSize: 11 }} />
                <Radar name={v1} dataKey={v1} stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.15} />
                <Radar name={v2} dataKey={v2} stroke="#00ff88" fill="#00ff88" fillOpacity={0.15} />
                <Tooltip formatter={v => `${v}%`} contentStyle={{ background: '#0a142d', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="compare-diff-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="text-cyan">{v1}</th>
                  <th className="text-success">{v2}</th>
                  <th>Delta (A−B)</th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map(k => (
                  <tr key={k}>
                    <td>{LABELS[k]}</td>
                    <td className="mono">{data.diff[k]?.v1 ?? '—'}%</td>
                    <td className="mono">{data.diff[k]?.v2 ?? '—'}%</td>
                    <td><DeltaChip delta={data.diff[k]?.delta ?? 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ── Rollback Confirm Modal ─────────────────────────────────────── */
function RollbackModal({ version, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose}>
      <div className="modal-icon-wrap warn"><AlertTriangle size={28} /></div>
      <h2 className="modal-title">Confirm Rollback</h2>
      <p className="modal-body">
        This will update <code>latest.json</code> on HuggingFace to point to{' '}
        <span className="mono text-cyan">{version}</span>. The model watcher will
        hot-swap within 30 seconds.
      </p>
      <div className="modal-actions">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm}>
          <RotateCcw size={13} /> Confirm Rollback
        </Btn>
      </div>
    </Modal>
  );
}

/* ── Model Registry ─────────────────────────────────────────────── */
export default function ModelRegistry() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [compare, setCompare] = useState(false);
  const toast = useToast();

  const fetchVersions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const v = await getVersions();
      setData(v);
    } catch {
      toast('Failed to load versions', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVersions(); }, []);

  const doRollback = async (v) => {
    setConfirm(null);
    setRolling(v);
    try {
      await rollback(v);
      toast(`Rolled back to ${v} ✓`, 'success');
      await fetchVersions(true);
    } catch (e) {
      toast(e.response?.data || 'Rollback failed', 'error');
    } finally {
      setRolling(null);
    }
  };

  if (loading) return <LoadingPage label="Loading model registry…" />;

  const versions  = data?.available_versions ?? [];
  const cur       = data?.current_version;
  const archived  = Math.max(0, (data?.count ?? 0) - (cur ? 1 : 0));

  return (
    <div className="page fade-up">
      <PageHeader
        icon={Server}
        title="Model Registry"
        subtitle="Manage, compare, and rollback HuggingFace model versions"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" size="sm" onClick={() => setCompare(true)} disabled={versions.length < 2}>
              <GitCompare size={13} /> Compare
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => fetchVersions(true)} disabled={loading}>
              <RefreshCw size={13} /> Refresh
            </Btn>
          </div>
        }
      />

      {/* ── Stats ── */}
      <div className="grid-3 mb-s">
        <StatCard icon={Layers}   label="Total Versions"  value={data?.count ?? 0}   sub="In HF registry"     color="cyan"   />
        <StatCard icon={Award}    label="Active Version"  value={cur || 'None'}       sub="Currently serving"  color="green"  />
        <StatCard icon={Database} label="Archived"        value={archived}            sub="Available to rollback" color="indigo" />
      </div>

      {/* ── Table ── */}
      <SectionCard
        title="Available Versions"
        subtitle={`${data?.count ?? 0} models in registry`}
        icon={GitBranch}
      >
        {versions.length === 0 ? (
          <EmptyState icon={Server} title="No models found" desc="Run a training pipeline to publish your first model." />
        ) : (
          <div className="table-scroll">
            <table className="data-table registry-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Version ID</th>
                  <th>Status</th>
                  <th>Artifacts</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v, i) => {
                  const isCur    = v === cur;
                  const isLatest = i === 0;
                  const isRolling= rolling === v;
                  return (
                    <tr key={v} className={`data-row ${isCur ? 'row-active' : ''}`}>
                      <td className="mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</td>
                      <td>
                        <div className="version-cell">
                          {isCur && (
                            <span className="live-dot ld-green ld-sm"><span className="live-ring" /></span>
                          )}
                          <span className="mono text-cyan version-id">{v}</span>
                        </div>
                      </td>
                      <td>
                        {isCur
                          ? <Badge type="success">Active</Badge>
                          : isLatest
                          ? <Badge type="info">Latest</Badge>
                          : <Badge type="muted">Archived</Badge>}
                      </td>
                      <td>
                        <div className="chip-row">
                          <span className="chip">model_{v}.pkl</span>
                          <span className="chip">preprocessor_{v}.pkl</span>
                          <span className="chip chip-meta">metadata_{v}.json</span>
                        </div>
                      </td>
                      <td>
                        {isCur ? (
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>Current</span>
                        ) : (
                          <button
                            className="rollback-btn"
                            disabled={!!rolling}
                            onClick={() => setConfirm(v)}
                          >
                            {isRolling
                              ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Rolling back…</>
                              : <><RotateCcw size={12} /> Rollback</>}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Modals ── */}
      {confirm && (
        <RollbackModal
          version={confirm}
          onConfirm={() => doRollback(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
      {compare && (
        <CompareModal
          versions={versions}
          onClose={() => setCompare(false)}
        />
      )}
    </div>
  );
}
