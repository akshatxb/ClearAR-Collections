import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sun, Moon, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { apiErrorMessage } from '../../api/client';
import { defaultRouteFor } from '../../lib/routes';
import { forgotPassword as apiForgotPassword } from '../../api/endpoints';
import SplashScreen from '../../components/SplashScreen';
import './AuthPages.css';

const DEMOS = [
  { role: 'Manager', email: 'manager@demo.com' },
  { role: 'Collector', email: 'collector@demo.com' },
  { role: 'Relationship owner', email: 'owner@demo.com' },
  { role: 'Customer', email: 'customer@demo.com' },
  { role: 'Platform Admin', email: 'platform.admin@demo.com' },
];

export default function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [view, setView] = useState('login'); // 'login' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [showSplash, setShowSplash] = useState(true);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(defaultRouteFor(user.role), { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not log in. Check your email and password.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    setForgotBusy(true);
    try {
      const { data } = await apiForgotPassword(forgotEmail);
      setForgotSuccess(
        data?.message || 'If your email is registered, a temporary password has been dispatched to your inbox.'
      );
    } catch (err) {
      setForgotError(apiErrorMessage(err, 'Could not process password reset request.'));
    } finally {
      setForgotBusy(false);
    }
  }

  function handleQuickFill(demoEmail) {
    setEmail(demoEmail);
    setPassword('password123');
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
          <h1 className="auth-form-title">
            {view === 'forgot' ? 'Reset password' : 'Sign in to workspace'}
          </h1>
          <p className="auth-tagline">
            {view === 'forgot'
              ? 'Enter your work email to receive temporary sign-in credentials.'
              : 'Welcome back. Enter your credentials to access your organization.'}
          </p>
        </div>

            {/* Temporary Demo Roles Pill Strip */}
            <div className="auth-demo-pills-bar">
              <span className="auth-demo-pills-label">Sandbox:</span>
              <div className="auth-demo-pills-list">
                {DEMOS.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    className={`auth-demo-pill ${email === d.email ? 'active' : ''}`}
                    onClick={() => handleQuickFill(d.email)}
                    title={`Fill ${d.role} (${d.email})`}
                  >
                    {d.role}
                  </button>
                ))}
              </div>
            </div>

            {view === 'forgot' ? (
              <form onSubmit={handleForgotSubmit} className="auth-form">
                <div className="form-field">
                  <label htmlFor="forgot-email">Registered work email</label>
                  <div className="input-with-icon">
                    <Mail size={17} className="field-icon" />
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@company.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {forgotError && <div className="auth-error-banner">{forgotError}</div>}
                {forgotSuccess && (
                  <div className="auth-success-banner">
                    <CheckCircle2 size={17} className="success-icon" />
                    <span>{forgotSuccess}</span>
                  </div>
                )}

                <button type="submit" className="btn btn-primary auth-submit" disabled={forgotBusy}>
                  {forgotBusy ? 'Sending credentials…' : 'Send temporary password'}
                </button>
                <button
                  type="button"
                  className="auth-secondary-btn"
                  onClick={() => {
                    if (forgotEmail) setEmail(forgotEmail);
                    setView('login');
                  }}
                >
                  ← Back to sign in
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-field">
                  <label htmlFor="email">Work email</label>
                  <div className="input-with-icon">
                    <Mail size={17} className="field-icon" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-field">
                  <div className="field-label-row">
                    <label htmlFor="password">Password</label>
                    <button
                      type="button"
                      className="auth-link-btn"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotError('');
                        setForgotSuccess('');
                        setView('forgot');
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="input-with-icon">
                    <Lock size={17} className="field-icon" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                  {busy ? 'Verifying credentials…' : 'Sign in to workspace'}
                </button>
              </form>
            )}

            <div className="auth-switch-footer">
              Don't have an account? <Link to="/signup">Customer self sign up <ArrowRight size={14} /></Link>
            </div>

            <div className="auth-trust-footer">
              <ShieldCheck size={14} strokeWidth={2} />
              <span>SOC 2 Type II Certified • Multi-Tenant Encrypted</span>
            </div>
          </div>
        </div>
      );
    }