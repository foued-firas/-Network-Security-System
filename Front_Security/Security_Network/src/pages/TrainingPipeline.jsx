import { useState, useEffect, useRef } from 'react';
import {
  Cpu, Play, RefreshCw, Database, Layers,
  TrendingUp, GitBranch, Terminal, Clock, Activity,
  CheckCircle2,
} from 'lucide-react';
import { runTrain } from '../api.js';
import { useToast } from '../Toast.jsx';
import { PageHeader, StatCard, SectionCard, StatusPill, LoadingPage } from '../ui.jsx';

const STAGES = [
  { key: 'ingest',    icon: Database,    label: 'Data Ingestion',      desc: 'Pull records from MongoDB & validate schema' },
  { key: 'validate',  icon: Activity,    label: 'Data Validation',     desc: 'Run schema & anomaly checks on raw data' },
  { key: 'transform', icon: Layers,      label: 'Feature Engineering', desc: 'Impute, encode, scale — build feature matrix' },
  { key: 'train',     icon: Cpu,         label: 'Model Training',      desc: 'GridSearch + cross-validation training run' },
  { key: 'eval',      icon: TrendingUp,  label: 'Evaluation',          desc: 'Score on held-out test set & compute metrics' },
  { key: 'push',      icon: GitBranch,   label: 'HuggingFace Push',    desc: 'Upload artifacts & update latest.json pointer' },
];

const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function TrainingPipeline() {
  const [status,  setStatus]  = useState('idle');   // idle | running | success | error
  const [stage,   setStage]   = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [log,     setLog]     = useState([]);
  const logRef   = useRef(null);
  const timerRef = useRef(null);
  const toast    = useToast();

  /* ── Auto-scroll log ── */
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  /* ── Elapsed timer ── */
  useEffect(() => {
    if (status === 'running') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  const addLog = (msg, type = 'info') => {
    const ts = new Date().toLocaleTimeString('en-GB');
    setLog(l => [...l, { ts, msg, type }]);
  };

  const handleTrain = async () => {
    setStatus('running');
    setLog([]);
    setStage(0);
    setElapsed(0);

    addLog('▶  Pipeline initiated by operator', 'info');
    addLog(`⏱  Start time: ${new Date().toLocaleTimeString()}`, 'info');

    // Animate stages sequentially while waiting for API
    const delays = [0, 3000, 6000, 10000, 16000, 20000];
    STAGES.forEach((s, i) => {
      setTimeout(() => {
        setStage(i);
        addLog(`→  Stage [${i + 1}/${STAGES.length}]: ${s.label}`, 'info');
      }, delays[i]);
    });

    try {
      const res = await runTrain();
      const msg = typeof res === 'string' ? res : 'Training + Upload to HF successful 🚀';
      setStage(STAGES.length);   // all done
      addLog('━━━━━━━━━ Pipeline Output ━━━━━━━━━', 'info');
      addLog(msg, 'success');
      addLog('✓  Model hot-swap will occur within 30 s', 'success');
      addLog(`⏱  Completed at: ${new Date().toLocaleTimeString()}`, 'success');
      setStatus('success');
      toast('Training pipeline complete!', 'success');
    } catch (e) {
      const errMsg = e.response?.data || e.message || 'Unknown error';
      addLog(`✕  ERROR: ${errMsg}`, 'error');
      setStatus('error');
      toast('Pipeline failed — check the log', 'error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setStage(-1);
    setElapsed(0);
    setLog([]);
  };

  const pct = status === 'success'
    ? 100
    : status === 'running' && stage >= 0
    ? Math.round(((stage + 1) / STAGES.length) * 100)
    : 0;

  return (
    <div className="page fade-up">
      <PageHeader
        icon={Cpu}
        title="Training Pipeline"
        subtitle="Launch, monitor, and audit the full ML security training workflow"
        badge={
          status !== 'idle' && (
            <StatusPill color={status === 'running' ? 'amber' : status === 'success' ? 'green' : 'red'}>
              {status === 'running' ? `Running · ${fmt(elapsed)}` : status === 'success' ? 'Completed' : 'Failed'}
            </StatusPill>
          )
        }
      />

      <div className="pipeline-layout">
        {/* ── Left column ── */}
        <div className="pipeline-left">
          <SectionCard title="Pipeline Stages" icon={Layers} subtitle="Automated ML workflow">
            {/* Progress bar */}
            {status !== 'idle' && (
              <div className="pipeline-progress">
                <div className="pp-track">
                  <div
                    className={`pp-fill ${status === 'error' ? 'pp-error' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="pp-pct">{pct}%</span>
              </div>
            )}

            <div className="stages-list">
              {STAGES.map((s, i) => {
                const done    = stage > i || status === 'success';
                const current = stage === i && status === 'running';
                const failed  = status === 'error' && stage === i;
                const idle    = stage < i || status === 'idle';
                const cls     = done ? 'st-done' : current ? 'st-current' : failed ? 'st-failed' : 'st-idle';
                return (
                  <div key={s.key} className={`stage-item ${cls}`}>
                    <div className="stage-indicator">
                      {done    ? <CheckCircle2 size={14} /> :
                       current ? <div className="spinner" style={{ width: 14, height: 14 }} /> :
                       failed  ? <span>✕</span> :
                                 <span className="stage-num">{i + 1}</span>}
                    </div>
                    <div className="stage-body">
                      <div className="stage-name">
                        <s.icon size={13} />
                        {s.label}
                      </div>
                      <p className="stage-desc">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Controls */}
          <div className="pipeline-controls">
            {status === 'idle' && (
              <button className="btn btn-primary btn-lg pipeline-run-btn" onClick={handleTrain}>
                <Play size={17} /> Run Security Pipeline
              </button>
            )}
            {status === 'running' && (
              <button className="btn btn-primary btn-lg pipeline-run-btn" disabled>
                <div className="spinner" /> Pipeline Running…
              </button>
            )}
            {(status === 'success' || status === 'error') && (
              <button className="btn btn-ghost btn-lg" onClick={reset}>
                <RefreshCw size={15} /> Reset
              </button>
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="pipeline-right">
          <SectionCard title="System Log" icon={Terminal} subtitle="Real-time pipeline output">
            <div className="terminal" ref={logRef}>
              <div className="terminal-header">
                <span className="th-dot th-red" /><span className="th-dot th-amber" /><span className="th-dot th-green" />
                <span className="th-label">netsec-pipeline — bash</span>
              </div>
              <div className="terminal-body">
                {log.length === 0 && (
                  <div className="term-empty">
                    <Terminal size={20} />
                    <span>Awaiting pipeline start…</span>
                  </div>
                )}
                {log.map((l, i) => (
                  <div key={i} className={`log-line ll-${l.type}`}>
                    <span className="log-ts">[{l.ts}]</span>
                    <span className="log-msg">{l.msg}</span>
                  </div>
                ))}
                {status === 'running' && (
                  <div className="log-line">
                    <span className="log-cursor">█</span>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Live stats during run */}
          {status !== 'idle' && (
            <div className="grid-2" style={{ marginTop: '1.25rem' }}>
              <StatCard icon={Clock}    label="Elapsed"  value={fmt(elapsed)} sub="hh:mm:ss" color="amber" />
              <StatCard icon={Activity} label="Stage"    value={`${Math.min(stage + 1, STAGES.length)} / ${STAGES.length}`} sub="Progress" color="cyan" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
