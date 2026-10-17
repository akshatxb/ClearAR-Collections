import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sun, Moon, User, Mail, Lock, Building2, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { apiErrorMessage } from '../../api/client';
import { defaultRouteFor } from '../../lib/routes';
import SplashScreen from '../../components/SplashScreen';
import './AuthPages.css';

export default function Signup() {
  const { signup } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    accountId: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        accountId: Number(form.accountId),
      };
      const user = await signup(payload);
      navigate(defaultRouteFor(user.role), { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create your account.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell" data-theme={theme}>
      {/* Theme Toggle Button */}
      <button 
        type="button" 
        className="theme-toggle-btn"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to Peach Theme' : 'Switch to Dark Teal Theme'}
        title={theme === 'dark' ? 'Switch to Peach Theme' : 'Switch to Dark Teal Theme'}
      >
        {theme === 'dark' ? (
          <Sun size={18} strokeWidth={2} aria-hidden="true" />
        ) : (
          <Moon size={18} strokeWidth={2} aria-hidden="true" />
        )}
      </button>

      {showSplash && (
        <SplashScreen theme={theme} onDone={() => setShowSplash(false)} />
      )}

      {/* Ambient background elements wrapped to prevent phantom scrollbars */}
      <div className="auth-bg-ambient" aria-hidden="true">
        <div className="auth-bg-orb auth-bg-orb-1" />
        <div className="auth-bg-orb auth-bg-orb-2" />
        <div className="auth-grain" />
      </div>

      {/* Focused Auth Card */}
      <div className="auth-card-container">
        {/* Brand Header */}
        <div className="auth-brand-header">
          <div className="auth-brand-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="auth-brand-name">ClearAR</span>
        </div>

        <div className="auth-header-block">
          <h1 className="auth-form-title">Create customer account</h1>
          <p className="auth-tagline">Enter your details to access your company ledger.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row-2col">
            <div className="form-field">
              <label htmlFor="name">Full name</label>
              <div className="input-with-icon">
                <User size={16} className="field-icon" />
                <input 
                  id="name" 
                  value={form.name} 
                  placeholder="Alex Morgan"
                  onChange={(e) => update('name', e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="accountId">Account ID</label>
              <div className="input-with-icon">
                <Building2 size={16} className="field-icon" />
                <input
                  id="accountId"
                  type="number"
                  value={form.accountId}
                  onChange={(e) => update('accountId', e.target.value)}
                  placeholder="e.g. 1"
                  title="From invoice or vendor invite"
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="email">Work email</label>
            <div className="input-with-icon">
              <Mail size={16} className="field-icon" />
              <input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <div className="input-with-icon">
              <Lock size={16} className="field-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
              />
              <button
                type="button"
                className="field-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className="auth-error-banner">{error}</div>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Create customer account'}
          </button>
        </form>

        <div className="auth-switch-footer">
          Already have an account? <Link to="/login">Sign in <ArrowRight size={14} /></Link>
        </div>

        <div className="auth-trust-footer">
          <ShieldCheck size={14} strokeWidth={2} />
          <span>SOC 2 Type II Certified • Multi-Tenant Encrypted</span>
        </div>
      </div>
    </div>
  );
}
