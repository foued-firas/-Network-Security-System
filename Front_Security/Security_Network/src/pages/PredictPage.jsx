import { useState, useRef, useCallback } from 'react';
import {
  Upload, Shield, AlertTriangle, CheckCircle2, X,
  FileText, Zap, BarChart2,
} from 'lucide-react';
import { predict } from '../api.js';
import { useToast } from '../Toast.jsx';
import {
  PageHeader, StatCard, SectionCard, EmptyState,
  ResultPill, ConfidencePill,
} from '../ui.jsx';

/* ── Drop Zone ─────────────────────────────────────────────────── */
function DropZone({ onFile, isDragging, setIsDragging }) {
  const inputRef = useRef(null);

  const handleDrag = useCallback(e => {
    e.preventDefault();
    setIsDragging(e.type !== 'dragleave');
  }, []);

  const handleDrop = useCallback(e => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.csv')) onFile(f);
  }, []);

  const handleChange = e => {
    const f = e.target.files[0];
    if (f) onFile(f);
    e.target.value = '';
  };

  return (
    <div
      className={`drop-zone ${isDragging ? 'dz-drag' : ''}`}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".csv" className="hidden-input" onChange={handleChange} />
      <div className="dz-icon"><Upload size={28} /></div>
      <p className="dz-title">Drop CSV file here or <span className="dz-link">browse</span></p>
      <p className="dz-sub">Accepts <code>.csv</code> files formatted to match the model's feature schema</p>
    </div>
  );
}

/* ── Results Table ─────────────────────────────────────────────── */
function ResultsTable({ predictions }) {
  const threats = predictions.filter(p => p.result === 'THREAT').length;
  const benign  = predictions.filter(p => p.result === 'BENIGN').length;

  return (
    <div>
      {/* Summary strip */}
      <div className="predict-summary-strip">
        <div className="pss-item">
          <span className="pss-num">{predictions.length}</span>
          <span className="pss-label">Total Rows</span>
        </div>
        <div className="pss-divider" />
        <div className="pss-item">
          <span className="pss-num text-danger">{threats}</span>
          <span className="pss-label">⚠ Threats</span>
        </div>
        <div className="pss-divider" />
        <div className="pss-item">
          <span className="pss-num text-success">{benign}</span>
          <span className="pss-label">✓ Benign</span>
        </div>
        <div className="pss-threat-bar">
          <div className="ptb-fill" style={{ width: `${(threats / predictions.length) * 100}%` }} />
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table">
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
            {predictions.map((p, i) => (
              <tr key={i} className={p.result === 'THREAT' ? 'row-threat' : 'row-benign'}>
                <td className="mono text-xs text-muted">{String(i + 1).padStart(3, '0')}</td>
                <td className="mono text-xs">{p.timestamp}</td>
                <td><ResultPill result={p.result} /></td>
                <td><ConfidencePill value={p.confidence} /></td>
                <td className="mono text-xs text-muted">{p.model_version ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Predict Page ──────────────────────────────────────────────── */
export default function PredictPage() {
  const [file,       setFile]       = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [results,    setResults]    = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const toast = useToast();

  const handleFile = f => setFile(f);
  const clearFile  = () => { setFile(null); setResults(null); };

  const handlePredict = async () => {
    if (!file) return;
    setPredicting(true);
    setResults(null);
    try {
      const res = await predict(file);
      if (res.error) throw new Error(res.error);
      setResults(res.predictions ?? []);
      toast(`${res.count} prediction(s) complete`, 'success');
    } catch (e) {
      toast(e.message || 'Prediction failed', 'error');
    } finally {
      setPredicting(false);
    }
  };

  const threats = results ? results.filter(p => p.result === 'THREAT').length : 0;
  const benign  = results ? results.filter(p => p.result === 'BENIGN').length : 0;

  return (
    <div className="page fade-up">
      <PageHeader
        icon={Shield}
        title="Threat Prediction"
        subtitle="Upload a CSV of network traffic — the active model scores every row"
      />

      <div className="predict-layout">
        {/* ── Left ── */}
        <div className="predict-left">
          <SectionCard title="Upload Traffic Data" icon={Upload} subtitle="CSV file with network feature columns">
            {!file ? (
              <DropZone onFile={handleFile} isDragging={isDragging} setIsDragging={setIsDragging} />
            ) : (
              <div className="file-selected">
                <div className="fs-info">
                  <div className="fs-icon"><FileText size={20} /></div>
                  <div className="fs-details">
                    <span className="fs-name">{file.name}</span>
                    <span className="fs-size">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                <div className="fs-actions">
                  <button className="btn btn-ghost btn-sm" onClick={clearFile}><X size={13} /> Remove</button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handlePredict}
                    disabled={predicting}
                  >
                    {predicting
                      ? <><div className="spinner" style={{ width: 13, height: 13 }} /> Predicting…</>
                      : <><Zap size={13} /> Run Prediction</>
                    }
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="How It Works" icon={Zap} subtitle="Prediction pipeline">
            <ol className="howto-list">
              <li><span className="howto-num">1</span><span>Upload a <code>.csv</code> file with the network feature columns the model expects.</span></li>
              <li><span className="howto-num">2</span><span>The backend sends each row through the <strong>preprocessor</strong> (impute, scale, encode).</span></li>
              <li><span className="howto-num">3</span><span>The active <strong>ML model</strong> scores each row as <span className="text-success">BENIGN</span> or <span className="text-danger">THREAT</span>.</span></li>
              <li><span className="howto-num">4</span><span>Every prediction is appended to the <strong>audit log</strong> with a timestamp and confidence score.</span></li>
            </ol>
          </SectionCard>
        </div>

        {/* ── Right ── */}
        <div className="predict-right">
          {results === null ? (
            <SectionCard title="Prediction Output" icon={BarChart2} subtitle="Results will appear here">
              <EmptyState
                icon={Shield}
                title="No results yet"
                desc="Select a CSV and click Run Prediction to score your network traffic."
              />
            </SectionCard>
          ) : (
            <>
              <div className="grid-2 mb-s">
                <StatCard icon={AlertTriangle} label="Threats Detected"  value={threats} sub={`${results.length} rows analyzed`} color="red"   />
                <StatCard icon={CheckCircle2}  label="Benign Traffic"    value={benign}  sub={`${results.length} rows analyzed`} color="green" />
              </div>
              <SectionCard title="Prediction Results" subtitle={`${results.length} rows`} icon={BarChart2}>
                <ResultsTable predictions={results} />
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
