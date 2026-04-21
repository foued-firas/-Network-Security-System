import React, { useState } from 'react';
import { 
  User, Shield, Bell, Eye, EyeOff, Globe, 
  Database, Cpu, Clock, LogOut, CheckCircle2,
  Lock, Settings as SettingsIcon, Save
} from 'lucide-react';

const SettingsPage = () => {
  const role = localStorage.getItem('netsec_role') || 'user';
  const token = localStorage.getItem('netsec_token') || '••••••••';
  const [showToken, setShowToken] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);

  // Dynamic Preferences
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem('pref_push') === 'true');
  const [emailEnabled, setEmailEnabled] = useState(() => localStorage.getItem('pref_email') === 'true');
  const [inferenceMode, setInferenceMode] = useState(() => localStorage.getItem('pref_inference') || 'local');

  const handleSave = () => {
    localStorage.setItem('pref_push', pushEnabled);
    localStorage.setItem('pref_email', emailEnabled);
    localStorage.setItem('pref_inference', inferenceMode);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'profile',  label: 'Profile Information', icon: User },
    { id: 'security', label: 'Security & Access',    icon: Shield },
    { id: 'notify',   label: 'Notifications',       icon: Bell },
    { id: 'network',  label: 'Network Config',      icon: Globe },
  ];

  return (
    <div className="page fade-in">
      <header className="page-header">
        <div className="ph-left">
           <div className="page-icon">
              <SettingsIcon size={22} />
           </div>
           <div>
              <h1 className="page-title">Account Settings</h1>
              <p className="page-subtitle">Manage your profile, security preferences, and environment</p>
           </div>
        </div>
        <div className="ph-right">
           <button className="btn btn-primary btn-md" onClick={handleSave}>
              {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {saved ? 'Changes Saved' : 'Save Changes'}
           </button>
        </div>
      </header>

      <div className="settings-layout fade-up" style={{ animationDelay: '0.1s' }}>
        {/* Left: Navigation / Sidebar for settings (mini) */}
        <div className="settings-nav">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              className={`sn-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Content */}
        <div className="settings-content">
          {activeTab === 'profile' && (
            <section className="section-card mb-s animate-fade-in-fast">
              <div className="sc-header">
                <User size={16} className="text-cyan" />
                <h3 className="sc-title">Identity</h3>
              </div>
              <div className="sc-body">
                <div className="settings-group">
                  <label className="settings-label">Access Role</label>
                  <div className="role-display">
                    <span className={`badge ${role === 'technician' ? 'badge-info' : 'badge-muted'}`}>
                      {role.toUpperCase()}
                    </span>
                    <p className="settings-hint">
                      {role === 'technician' 
                        ? 'Full administrative access to training pipelines and model rollbacks.'
                        : 'Restricted access focused on traffic prediction and monitoring.'}
                    </p>
                  </div>
                </div>

                <div className="settings-grid-2">
                  <div className="settings-group">
                    <label className="settings-label">Display Name</label>
                    <input type="text" className="settings-input" defaultValue={role === 'technician' ? 'Lead Security Engineer' : 'Incident Responder'} />
                  </div>
                  <div className="settings-group">
                    <label className="settings-label">Email / ID</label>
                    <input type="text" className="settings-input" defaultValue={`${role}@netsec.ai`} disabled />
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'security' && (
            <section className="section-card mb-s animate-fade-in-fast">
              <div className="sc-header">
                <Lock size={16} className="text-amber" />
                <h3 className="sc-title">Security & Tokens</h3>
              </div>
              <div className="sc-body">
                <div className="settings-group">
                  <label className="settings-label">Authentication PIN</label>
                  <div className="token-input-wrap">
                    <input 
                      type={showToken ? 'text' : 'password'} 
                      className="settings-input" 
                      value={role === 'technician' ? token : '••••••••'} 
                      readOnly 
                    />
                    <button className="token-toggle" onClick={() => setShowToken(!showToken)}>
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="settings-hint">This token is used to authorize sensitive API requests. Keep it confidential.</p>
                </div>

                <div className="settings-group">
                  <label className="settings-label">Session Management</label>
                  <div className="session-card">
                    <Clock size={16} className="text-muted" />
                    <div className="session-info">
                      <span className="session-title">Current Desktop Session</span>
                      <span className="session-meta">Last activity: Just now • IP: 127.0.0.1</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'notify' && (
            <section className="section-card mb-s animate-fade-in-fast">
               <div className="sc-header">
                 <Bell size={16} className="text-indigo" />
                 <h3 className="sc-title">Alert Notifications</h3>
               </div>
               <div className="sc-body">
                  <div className="settings-group">
                    <div className="toggle-row" onClick={() => setPushEnabled(!pushEnabled)} style={{ cursor: 'pointer' }}>
                      <span>Desktop Push Notifications</span>
                      <div className={`toggle-pill ${pushEnabled ? 'active' : ''}`} />
                    </div>
                    <p className="settings-hint">Receive real-time alerts when a high-probability threat is detected.</p>
                  </div>
                  <div className="settings-group">
                    <div className="toggle-row" onClick={() => setEmailEnabled(!emailEnabled)} style={{ cursor: 'pointer' }}>
                      <span>Email Digest (Weekly)</span>
                      <div className={`toggle-pill ${emailEnabled ? 'active' : ''}`} />
                    </div>
                    <p className="settings-hint">Get a weekly summary of network traffic anomalies and model performance.</p>
                  </div>
               </div>
            </section>
          )}

          {activeTab === 'network' && (
            <section className="section-card animate-fade-in-fast">
               <div className="sc-header">
                 <Globe size={16} className="text-cyan" />
                 <h3 className="sc-title">Network Configuration</h3>
               </div>
               <div className="sc-body">
                  <div className="env-stats">
                     <div className="env-item">
                        <span className="env-label">API Base URL</span>
                        <input className="settings-input small" defaultValue="http://localhost:8000" />
                     </div>
                     <div className="env-item">
                        <span className="env-label">Primary Gateway</span>
                        <code className="env-value">192.168.1.1</code>
                     </div>
                     <div className="env-item">
                        <span className="env-label">Inference Mode</span>
                        <select 
                          className="settings-input small" 
                          value={inferenceMode}
                          onChange={(e) => setInferenceMode(e.target.value)}
                        >
                          <option value="local">High Performance (local)</option>
                          <option value="cloud">Cloud Relay (HuggingFace)</option>
                        </select>
                     </div>
                  </div>
               </div>
            </section>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .settings-layout {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 2rem;
        }
        @media (max-width: 900px) {
          .settings-layout { grid-template-columns: 1fr; }
        }

        .settings-nav {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .sn-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 10px;
          color: var(--text-muted);
          font-weight: 500;
          text-align: left;
          transition: var(--transition-fast);
        }
        .sn-btn:hover {
          background: rgba(255,255,255,0.03);
          color: var(--text-main);
        }
        .sn-btn.active {
          background: rgba(0,212,255,0.08);
          border-color: rgba(0,212,255,0.15);
          color: var(--cyan);
        }

        .settings-content {
          display: flex;
          flex-direction: column;
        }

        .settings-group {
          margin-bottom: 1.5rem;
        }
        .settings-group:last-child { margin-bottom: 0; }

        .settings-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-bottom: 8px;
        }
        .settings-input {
          width: 100%;
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 14px;
          color: var(--text-main);
          font-size: 0.9rem;
          transition: var(--transition-fast);
        }
        .settings-input:focus {
          outline: none;
          border-color: var(--cyan);
          background: rgba(0,0,0,0.3);
        }
        .settings-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: rgba(0,0,0,0.1);
        }

        .settings-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }
        @media (max-width: 600px) {
          .settings-grid-2 { grid-template-columns: 1fr; }
        }

        .settings-hint {
          font-size: 0.75rem;
          margin-top: 8px;
          color: var(--text-dim);
          line-height: 1.4;
        }

        .token-input-wrap {
          position: relative;
          display: flex;
        }
        .token-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
        }
        .token-toggle:hover { color: var(--text-main); }

        .session-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        .session-info { display: flex; flex-direction: column; gap: 2px; }
        .session-title { font-size: 0.85rem; font-weight: 600; }
        .session-meta { font-size: 0.72rem; color: var(--text-dim); }

        .env-stats {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .env-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border-card);
        }
        .env-item:last-child { border-bottom: none; padding-bottom: 0; }
        .env-label { font-size: 0.8rem; color: var(--text-muted); }
        .env-value { font-size: 0.8rem; font-weight: 600; font-family: 'JetBrains Mono', monospace; color: var(--text-secondary); }

        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255,255,255,0.02);
          padding: 12px 16px;
          border-radius: 10px;
          border: 1px solid var(--border);
        }
        .toggle-pill {
          width: 36px;
          height: 20px;
          background: var(--text-dim);
          border-radius: 12px;
          position: relative;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .toggle-pill::after {
          content: '';
          position: absolute;
          top: 3px; left: 3px;
          width: 14px; height: 14px;
          background: white;
          border-radius: 50%;
          transition: var(--transition-fast);
        }
        .toggle-pill.active { background: var(--cyan); }
        .toggle-pill.active::after { left: 19px; }

        .settings-input.small {
          width: auto;
          min-width: 200px;
          padding: 6px 12px;
          font-size: 0.8rem;
        }

        .animate-fade-in-fast { animation: fade-in-fast 0.25s ease-out backwards; }
        @keyframes fade-in-fast {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }
      `}} />
    </div>
  );
};

export default SettingsPage;
