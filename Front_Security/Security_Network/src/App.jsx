import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck, LayoutDashboard, Server, Cpu,
  Shield, ClipboardList, ChevronRight, ChevronLeft,
  Menu, LogOut, User as UserIcon, Settings,
} from 'lucide-react';
import { ToastProvider }    from './Toast.jsx';
import Dashboard            from './pages/Dashboard.jsx';
import ModelRegistry        from './pages/ModelRegistry.jsx';
import TrainingPipeline     from './pages/TrainingPipeline.jsx';
import PredictPage          from './pages/PredictPage.jsx';
import AuditLogPage         from './pages/AuditLogPage.jsx';
import LoginPage            from './pages/LoginPage.jsx';
import './App.css';

/* ── Nav config ──────────────────────────────────────────────────── */
const TECH_NAV = [
  {
    section: 'Overview',
    items: [
      { to: '/',        icon: LayoutDashboard, label: 'Dashboard',       desc: 'KPIs, charts & status' },
    ],
  },
  {
    section: 'Models',
    items: [
      { to: '/models',   icon: Server,          label: 'Model Registry',  desc: 'Versions & rollback' },
      { to: '/pipeline', icon: Cpu,             label: 'Training',         desc: 'Run ML pipeline' },
    ],
  },
  {
    section: 'Security',
    items: [
      { to: '/predict',  icon: Shield,          label: 'Predict',          desc: 'Score network traffic' },
      { to: '/audit',    icon: ClipboardList,   label: 'Audit Log',        desc: 'Prediction history' },
    ],
  },
];

const USER_NAV = [
  {
    section: 'Security',
    items: [
      { to: '/predict',  icon: Shield,          label: 'Predict',          desc: 'Score network traffic' },
      { to: '/audit',    icon: ClipboardList,   label: 'Audit Log',        desc: 'Prediction history' },
    ],
  },
];

/* ── Sidebar ──────────────────────────────────────────────────────── */
function Sidebar({ open, toggle, role, onLogout }) {
  const navItems = role === 'technician' ? TECH_NAV : USER_NAV;

  return (
    <aside className={`sidebar${open ? '' : ' collapsed'}`}>
      {/* Brand */}
      <div className="brand">
        <div className="brand-icon">
          <ShieldCheck size={20} />
          <span className="brand-pulse" />
        </div>
        {open && (
          <div className="brand-text">
            <span className="brand-name">NetSec <em>AI</em></span>
            <span className="brand-tagline">Security Intelligence</span>
          </div>
        )}
        <button className="collapse-btn" onClick={toggle} aria-label="Toggle sidebar">
          {open ? <ChevronLeft size={14} /> : <Menu size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map(({ section, items }) => (
          <div key={section} className="nav-section">
            {open && <span className="nav-section-label">{section}</span>}
            {items.map(({ to, icon: Icon, label, desc }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon"><Icon size={16} /></span>
                {open && (
                  <span className="nav-text">
                    <span className="nav-label">{label}</span>
                    <span className="nav-desc">{desc}</span>
                  </span>
                )}
                {open && <ChevronRight size={12} className="nav-arrow" />}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Profile / Logout */}
      <div className="sidebar-user-section">
          <div className="si-profile">
             <div className="si-avatar">
                {role === 'technician' ? <Settings size={14} /> : <UserIcon size={14} />}
             </div>
             {open && (
               <div className="si-meta">
                  <span className="si-name">{role === 'technician' ? 'Technician' : 'Simple User'}</span>
                  <span className="si-role">Active Session</span>
               </div>
             )}
          </div>
          <button className="logout-btn" onClick={onLogout} title="Sign Out">
             <LogOut size={16} />
             {open && <span>Logout</span>}
          </button>
      </div>

      {/* Footer */}
      {open && (
        <div className="sidebar-footer">
          <div className="sf-row">
            <span className="sf-dot" />
            <span className="sf-label">System Online</span>
          </div>
          <span className="sf-api">api: localhost:8000</span>
        </div>
      )}
    </aside>
  );
}

/* ── App Shell ────────────────────────────────────────────────────── */
function AppShell({ role, onLogout }) {
  const [open, setOpen] = useState(true);
  const location = useLocation();

  // Redirect users if they try to access tech-only routes
  if (role === 'user' && ['/', '/models', '/pipeline'].includes(location.pathname)) {
    return <Navigate to="/predict" replace />;
  }

  // Redirect technician to dashboard if at root
  if (role === 'technician' && location.pathname === '/user') {
     return <Navigate to="/" replace />;
  }

  return (
    <div className={`shell${open ? '' : ' shell-collapsed'}`}>
      <div className="scanline" aria-hidden />
      <Sidebar open={open} toggle={() => setOpen(o => !o)} role={role} onLogout={onLogout} />
      <main className="page-wrapper">
        <Routes>
          {role === 'technician' && (
            <>
              <Route path="/"         element={<Dashboard />}       />
              <Route path="/models"   element={<ModelRegistry />}   />
              <Route path="/pipeline" element={<TrainingPipeline />}/>
            </>
          )}
          <Route path="/predict"  element={<PredictPage />}     />
          <Route path="/audit"    element={<AuditLogPage />}    />
          
          {/* Default fallbacks */}
          <Route path="*" element={<Navigate to={role === 'technician' ? "/" : "/predict"} replace />} />
        </Routes>
      </main>
    </div>
  );
}

/* ── Root ─────────────────────────────────────────────────────────── */
export default function App() {
  const [user, setUser] = useState(null); // 'technician' | 'user' | null

  // Persistent login (optional, but good for UX)
  useEffect(() => {
    const saved = localStorage.getItem('netsec_role');
    if (saved) setUser(saved);
  }, []);

  const handleLogin = (role) => {
    setUser(role);
    localStorage.setItem('netsec_role', role);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('netsec_role');
  };

  if (!user) {
    return (
      <ToastProvider>
        <LoginPage onLogin={handleLogin} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <AppShell role={user} onLogout={handleLogout} />
      </Router>
    </ToastProvider>
  );
}
