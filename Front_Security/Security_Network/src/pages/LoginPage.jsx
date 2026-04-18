import { useState } from 'react';
import { ShieldCheck, Cpu, User, Lock, Eye, EyeOff, ArrowRight, Wifi } from 'lucide-react';

// In a real system this would be an API call.
// For this frontend-only app, technician access requires a PIN.
const TECH_PIN = '1234';

export default function LoginPage({ onLogin }) {
  const [step,       setStep]       = useState('role');   // 'role' | 'pin'
  const [pendingRole,setPending]    = useState(null);
  const [pin,        setPin]        = useState('');
  const [showPin,    setShowPin]    = useState(false);
  const [pinError,   setPinError]   = useState(false);
  const [shake,      setShake]      = useState(false);

  const selectRole = (role) => {
    if (role === 'technician') {
      setPending('technician');
      setStep('pin');
      setPin('');
      setPinError(false);
    } else {
      onLogin('user');
    }
  };

  const submitPin = (e) => {
    e.preventDefault();
    if (pin === TECH_PIN) {
      onLogin('technician', pin);
    } else {
      setPinError(true);
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div className="login-page">
      {/* Animated background grid */}
      <div className="login-grid" aria-hidden />

      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-shield">
            <ShieldCheck size={28} />
            <span className="login-shield-ring" />
          </div>
          <div>
            <h1 className="login-title">NetSec <span className="login-ai">AI</span></h1>
            <p className="login-tagline">Network Security Intelligence Platform</p>
          </div>
        </div>

        <div className="login-divider" />

        {step === 'role' && (
          <div className="login-body">
            <h2 className="login-heading">Select your role</h2>
            <p className="login-sub">Choose how you would like to access the platform</p>

            <div className="role-cards">
              {/* Technician */}
              <button className="role-card role-tech" onClick={() => selectRole('technician')}>
                <div className="role-icon-wrap ri-tech">
                  <Cpu size={22} />
                </div>
                <div className="role-info">
                  <span className="role-name">Technician</span>
                  <span className="role-desc">Full access — models, training &amp; analytics</span>
                </div>
                <div className="role-arrow"><ArrowRight size={16} /></div>
                <div className="role-badge rb-restricted">PIN required</div>
              </button>

              {/* Simple user */}
              <button className="role-card role-user" onClick={() => selectRole('user')}>
                <div className="role-icon-wrap ri-user">
                  <User size={22} />
                </div>
                <div className="role-info">
                  <span className="role-name">User</span>
                  <span className="role-desc">Scan network traffic &amp; view your results</span>
                </div>
                <div className="role-arrow"><ArrowRight size={16} /></div>
                <div className="role-badge rb-open">Open access</div>
              </button>
            </div>
          </div>
        )}

        {step === 'pin' && (
          <div className="login-body">
            <button className="back-btn" onClick={() => setStep('role')}>
              ← Back
            </button>
            <div className="pin-icon-wrap">
              <Lock size={24} />
            </div>
            <h2 className="login-heading">Technician Access</h2>
            <p className="login-sub">Enter your 4-digit PIN to continue</p>

            <form onSubmit={submitPin} className={`pin-form ${shake ? 'shake' : ''}`}>
              <div className="pin-input-wrap">
                <input
                  id="tech-pin"
                  type={showPin ? 'text' : 'password'}
                  className={`pin-input ${pinError ? 'pin-error' : ''}`}
                  value={pin}
                  onChange={e => { setPin(e.target.value.slice(0, 4)); setPinError(false); }}
                  placeholder="• • • •"
                  maxLength={4}
                  autoFocus
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="pin-eye"
                  onClick={() => setShowPin(s => !s)}
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {pinError && <p className="pin-err-msg">Incorrect PIN. Try again.</p>}
              <button
                type="submit"
                className="btn btn-primary btn-md pin-submit"
                disabled={pin.length < 4}
              >
                Access Platform <ArrowRight size={15} />
              </button>
            </form>
          </div>
        )}

        <div className="login-footer">
          <Wifi size={11} />
          <span>Connected to API at localhost:8000</span>
        </div>
      </div>
    </div>
  );
}
