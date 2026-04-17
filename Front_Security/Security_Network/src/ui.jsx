import { ChevronRight, X } from 'lucide-react';

/* ── Page Header ─────────────────────────────────────────────── */
export function PageHeader({ icon: Icon, title, subtitle, badge, action }) {
  return (
    <header className="page-header fade-up">
      <div className="ph-left">
        <div className="page-icon"><Icon size={20} /></div>
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
      </div>
      {(badge || action) && (
        <div className="ph-right">
          {badge}
          {action}
        </div>
      )}
    </header>
  );
}

/* ── Stat Card ───────────────────────────────────────────────── */
export function StatCard({ icon: Icon, label, value, sub, color = 'cyan', delay = 0, onClick }) {
  return (
    <div
      className={`stat-card color-${color} ${onClick ? 'clickable' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <div className={`stat-icon-wrap ic-${color}`}><Icon size={15} /></div>
      </div>
      <div className="stat-value">{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      <div className="stat-glow" />
    </div>
  );
}

/* ── Section Card ────────────────────────────────────────────── */
export function SectionCard({ title, subtitle, icon: Icon, children, className = '', action }) {
  return (
    <div className={`section-card ${className}`}>
      {(title || Icon) && (
        <div className="sc-header">
          {Icon && <div className="sc-icon"><Icon size={15} /></div>}
          <div className="sc-titles">
            {title    && <h3 className="sc-title">{title}</h3>}
            {subtitle && <p  className="sc-sub">{subtitle}</p>}
          </div>
          {action && <div className="sc-action">{action}</div>}
        </div>
      )}
      <div className="sc-body">{children}</div>
    </div>
  );
}

/* ── Badge ───────────────────────────────────────────────────── */
export function Badge({ children, type = 'default', size = 'md' }) {
  return <span className={`badge badge-${type} badge-${size}`}>{children}</span>;
}

/* ── Live Dot ────────────────────────────────────────────────── */
export function LiveDot({ color = 'green', size = 'sm' }) {
  return (
    <span className={`live-dot ld-${color} ld-${size}`}>
      <span className="live-ring" />
    </span>
  );
}

/* ── Status Pill ─────────────────────────────────────────────── */
export function StatusPill({ color, children }) {
  return (
    <div className={`status-pill sp-${color}`}>
      <LiveDot color={color} />
      {children}
    </div>
  );
}

/* ── Metric Bar ──────────────────────────────────────────────── */
export function MetricBar({ label, value, color = 'cyan', max = 100 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="metric-bar-wrap">
      <div className="metric-bar-top">
        <span className="metric-bar-label">{label}</span>
        <span className={`metric-bar-val text-${color}`}>{value != null ? `${value}%` : '—'}</span>
      </div>
      <div className="metric-bar-track">
        <div
          className={`metric-bar-fill fill-${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Divider ───────────────────────────────────────────────────*/
export function Divider() {
  return <hr className="divider" />;
}

/* ── Empty State ─────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={32} /></div>
      {title && <h4 className="empty-title">{title}</h4>}
      {desc  && <p  className="empty-desc">{desc}</p>}
    </div>
  );
}

/* ── Loading Page ────────────────────────────────────────────── */
export function LoadingPage({ label = 'Loading…' }) {
  return (
    <div className="loading-page">
      <div className="loading-shield">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
      <span className="loading-label">{label}</span>
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────────────── */
export function Modal({ children, onClose, width = 440 }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box fade-up"
        style={{ maxWidth: width }}
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

/* ── Button ──────────────────────────────────────────────────── */
export function Btn({ children, variant = 'primary', size = 'md', disabled, onClick, type = 'button', className = '' }) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* ── Confidence display ──────────────────────────────────────── */
export function ConfidencePill({ value }) {
  if (value == null) return <span className="text-muted">—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'green' : pct >= 60 ? 'amber' : 'red';
  return <span className={`conf-pill cp-${color}`}>{pct}%</span>;
}

/* ── Result Pill (THREAT / BENIGN) ───────────────────────────── */
export function ResultPill({ result }) {
  const isThreat = result === 'THREAT';
  return (
    <span className={`result-pill ${isThreat ? 'rp-threat' : 'rp-benign'}`}>
      {isThreat ? '⚠ THREAT' : '✓ BENIGN'}
    </span>
  );
}

/* ── Delta chip ──────────────────────────────────────────────── */
export function DeltaChip({ delta }) {
  const up = delta > 0;
  const zero = delta === 0;
  return (
    <span className={`delta-chip ${zero ? 'dc-zero' : up ? 'dc-up' : 'dc-down'}`}>
      {zero ? '=' : up ? `▲ +${delta}` : `▼ ${delta}`}
    </span>
  );
}
