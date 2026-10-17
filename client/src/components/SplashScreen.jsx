import { useState, useEffect } from 'react';
import '../pages/auth/AuthPages.css';

/**
 * Reusable branded splash overlay.
 *
 * Props:
 *   theme   – current theme string ('dark' | '#ea580c') for styling
 *   onDone  – optional callback fired after the overlay has fully faded out
 *
 * The overlay mounts visible, starts fading at 900 ms and is removed at 1300 ms.
 * CSS classes live in AuthPages.css (welcome-splash-*).
 */
export default function SplashScreen({ theme, onDone }) {
  const [isFading, setIsFading] = useState(false);
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Lock document scroll so underlying dashboard content doesn't show a scrollbar
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const fadeTimer = setTimeout(() => setIsFading(true), 900);
    const removeTimer = setTimeout(() => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      setShow(false);
      onDone?.();
    }, 1300);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  // The overlay needs to inherit the auth-shell theme wrapper when used on auth
  // pages, but on dashboard pages it sits at the document root, so we inline the
  // same styles used by the dark/#ea580c themes.
  const isPeach = theme === '#ffb079' || theme === '#ea580c';

  const overlayStyle = isPeach
    ? { background: '#ffb079' }
    : { background: '#090d16' };

  const logoStyle = isPeach
    ? { background: '#ffffff', borderColor: 'rgba(255,255,255,0.4)', color: '#d96f20', boxShadow: '0 8px 24px rgba(180,80,20,0.2)' }
    : { background: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#14b8a6' };

  const titleStyle = isPeach ? { color: '#ffffff' } : { color: '#f8fafc' };

  const spinnerStyle = isPeach
    ? { background: 'rgba(255,255,255,0.35)' }
    : { background: 'rgba(255,255,255,0.08)' };

  const barStyle = isPeach ? { background: '#ffffff' } : { background: '#14b8a6' };

  return (
    <div
      className={`welcome-splash-overlay${isFading ? ' decaying' : ''}`}
      style={overlayStyle}
    >
      <div className="welcome-splash-brand">
        <div className="welcome-splash-logo" aria-hidden="true" style={logoStyle}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="welcome-splash-title" style={titleStyle}>ClearAR</span>
      </div>
      <div className="welcome-splash-spinner" aria-label="Loading" style={spinnerStyle}>
        <div className="welcome-splash-spinner-bar" style={barStyle}></div>
      </div>
    </div>
  );
}
