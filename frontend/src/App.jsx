import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import UserPortal from './pages/UserPortal';
import AdminDashboard from './pages/AdminDashboard';
import ResponderPortal from './pages/ResponderPortal';
import './index.css';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '';
axios.defaults.baseURL = API_BASE;

/* ─────────────────────────────────────────────
   Role Guard
───────────────────────────────────────────── */
function AuthShield({ children, role }) {
  return localStorage.getItem('auth_role') === role
    ? children
    : <Navigate to="/" replace />;
}

/* ─────────────────────────────────────────────
   Auth Page
───────────────────────────────────────────── */
const ROLES = [
  { id: 'citizen',   emoji: '📢', label: 'Citizen'   },
  { id: 'responder', emoji: '🚑', label: 'Responder' },
  { id: 'operator',  emoji: '⚙️',  label: 'Operator'  },
];

function CentralAuth() {
  const [mode,     setMode]     = useState('login');
  const [username, setUsername] = useState('');
  const [role,     setRole]     = useState('citizen');
  const [error,    setError]    = useState(null);
  const [isOk,     setIsOk]     = useState(false);
  const [loading,  setLoading]  = useState(false);

  const switchMode = (m) => { setMode(m); setError(null); setIsOk(false); if (m === 'register') setRole('citizen'); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); setIsOk(false); setLoading(true);
    try {
      if (mode === 'register') {
        await axios.post('/register', { username, role: 'citizen' });
        setIsOk(true);
        setError('Account created! You can now sign in.');
        switchMode('login');
      } else {
        const res = await axios.post('/login', { username });
        if (res.data.status === 'success') {
          const userRole = res.data.role;
          localStorage.setItem('auth_role',     userRole);
          localStorage.setItem('auth_username', username);
          window.location.href = `/${userRole}`;
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="central-auth-box">

        {/* Brand */}
        <div className="auth-brand">
          <span className="auth-brand-icon">🛡️</span>
          <h1>DisasterOps</h1>
          <p>AI-Powered Emergency Coordination</p>
        </div>

        {/* Mode Toggle */}
        <div className="auth-toggle">
          <button type="button" className={`auth-toggle-btn ${mode === 'login'    ? 'active' : ''}`} onClick={() => switchMode('login')}>Sign In</button>
          <button type="button" className={`auth-toggle-btn ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')}>Register</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-input-group">
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoCapitalize="none"
            autoComplete="username"
          />

          {/* Role selector (login mode only) */}
          {mode === 'login' && (
            <div className="role-selector">
              {ROLES.map(({ id, emoji, label }) => (
                <div
                  key={id}
                  className={`role-box ${role === id ? 'active' : ''}`}
                  onClick={() => setRole(id)}
                >
                  <span className="role-icon-lg">{emoji}</span>
                  {label}
                </div>
              ))}
            </div>
          )}

          {/* Register notice */}
          {mode === 'register' && (
            <div style={{
              padding: '12px 14px',
              background: 'var(--blue-lt)',
              border: '1px solid #bfdbfe',
              borderRadius: 'var(--r-sm)',
              fontSize: '12px',
              color: 'var(--text-2)',
              lineHeight: '1.6',
            }}>
              <strong>ℹ️ Note:</strong> Public registration is for <strong>Citizens</strong> only.
              Responders and Operators must be provisioned by an Operator via the Admin Dashboard.
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className={isOk ? 'alert-success' : 'error-msg'}>{error}</div>
          )}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading
              ? 'Please wait…'
              : mode === 'login'
                ? 'Authorize Entry'
                : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   App Router
───────────────────────────────────────────── */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<CentralAuth />} />
        <Route path="/citizen"  element={<AuthShield role="citizen">  <UserPortal />     </AuthShield>} />
        <Route path="/responder" element={<AuthShield role="responder"><ResponderPortal /></AuthShield>} />
        <Route path="/operator" element={<AuthShield role="operator"> <AdminDashboard /> </AuthShield>} />
        <Route path="/admin"    element={<Navigate to="/operator" replace />} />
        <Route path="*"         element={<Navigate to="/"          replace />} />
      </Routes>
    </BrowserRouter>
  );
}
