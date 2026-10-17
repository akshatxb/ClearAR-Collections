import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, Mail } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/ThemeContext';
import PtpAlertBanner from './PtpAlertBanner';
import NotificationBell from './NotificationBell';
import ProfileMenu from './ProfileMenu';
import EmailDrawer from './EmailDrawer';
import SplashScreen from './SplashScreen';
import './AppLayout.css';

const NAV_BY_ROLE = {
  manager: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/worklist', label: 'Worklist', icon: 'worklist' },
    { to: '/promises', label: 'Promises to pay', icon: 'ptp' },
    { to: '/tasks', label: 'Outreach requests', icon: 'tasks' },
    { to: '/priority-factors', label: 'Priority factors', icon: 'factors' },
    { to: '/analytics', label: 'Analytics', icon: 'analytics' },
    { to: '/my-stats', label: 'My stats', icon: 'stats' },
    { to: '/admin', label: 'Operations', icon: 'admin' },
  ],
  collector: [
    { to: '/worklist', label: 'Worklist', icon: 'worklist' },
    { to: '/promises', label: 'Promises to pay', icon: 'ptp' },
    { to: '/tasks', label: 'Outreach requests', icon: 'tasks' },
    { to: '/my-stats', label: 'My stats', icon: 'stats' },
  ],
  relationship_owner: [
    { to: '/worklist', label: 'Worklist', icon: 'worklist' },
    { to: '/promises', label: 'Promises to pay', icon: 'ptp' },
    { to: '/tasks', label: 'Outreach requests', icon: 'tasks' },
    { to: '/my-stats', label: 'My stats', icon: 'stats' },
  ],
  customer: [{ to: '/portal', label: 'My account', icon: 'portal' }],
  platform_admin: [
    { to: '/platform-admin', label: 'Organizations', icon: 'orgs' },
    { to: '/platform-admin/activity', label: 'Activity log', icon: 'activity' },
    { to: '/platform-admin/team', label: 'Platform team', icon: 'team' },
  ],
};

const ROLE_LABEL = {
  manager: 'Manager',
  collector: 'Collector',
  relationship_owner: 'Relationship owner',
  customer: 'Customer',
  platform_admin: 'Platform admin',
};

function NavIcon({ type }) {
  switch (type) {
    case 'ptp':
      return (
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
          <path d="m9 16 2 2 4-4"></path>
        </svg>
      );
    case 'worklist':
      return (
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
      );
    case 'dashboard':
      return (
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      );
    case 'factors':
      return (
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="4" y1="21" x2="4" y2="14"></line>
          <line x1="4" y1="10" x2="4" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12" y2="3"></line>
          <line x1="20" y1="21" x2="20" y2="16"></line>
          <line x1="20" y1="12" x2="20" y2="3"></line>
          <line x1="1" y1="14" x2="7" y2="14"></line>
          <line x1="9" y1="8" x2="15" y2="8"></line>
          <line x1="17" y1="16" x2="23" y2="16"></line>
        </svg>
      );
    case 'analytics':
      return (
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
      );
    case 'stats':
      return (
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="7"></circle>
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
        </svg>
      );
    case 'admin':
      return (
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      );
    case 'tasks':
      return (
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          <path d="m9 14 2 2 4-4"></path>
        </svg>
      );
    case 'portal':
      return (
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
          <line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
      );
    case 'orgs':
      return (
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path>
          <path d="M6 12H4a2 2 0 0 0-2 2v8h4"></path>
          <path d="M18 9h2a2 2 0 0 1 2 2v11h-4"></path>
          <path d="M10 6h4"></path>
          <path d="M10 10h4"></path>
          <path d="M10 14h4"></path>
          <path d="M10 18h4"></path>
        </svg>
      );
    case 'activity':
      return (
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      );
    case 'team':
      return (
        <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      );
    default:
      return null;
  }
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV_BY_ROLE[user?.role] || [];

  const [showSplash, setShowSplash] = useState(() => {
    const seen = sessionStorage.getItem('clearar_splash_shown');
    if (!seen) {
      sessionStorage.setItem('clearar_splash_shown', '1');
      return true;
    }
    return false;
  });

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials = (user?.name || user?.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');

  let currentTitle = 'Collections';
  if (location.pathname.startsWith('/platform-admin/orgs/')) {
    currentTitle = 'Organization details';
  } else if (location.pathname.startsWith('/accounts/')) {
    currentTitle = 'Account details';
  } else {
    const match = [...items]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => location.pathname === item.to || location.pathname.startsWith(item.to + '/'));
    if (match) {
      currentTitle = match.label;
    }
  }

  const [emailDrawerOpen, setEmailDrawerOpen] = useState(false);

  return (
    <div className="shell">
      {showSplash && (
        <SplashScreen theme={theme} onDone={() => setShowSplash(false)} />
      )}

      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-badge" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke={theme === 'orange-light' ? '#f97316' : '#14b8a6'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17L12 22L22 17" stroke={theme === 'orange-light' ? '#ea580c' : '#0d9488'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" stroke={theme === 'orange-light' ? '#c2410c' : '#0f766e'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="brand-text-wrap">
            <span className="sidebar-brand-mark">ClearAR</span>
            <span className="brand-tagline">Collections OS</span>
          </div>
        </div>

        {user?.role !== 'platform_admin' && (
          <div className="sidebar-org-badge">
            <span className="sidebar-org-type">
              {user?.role === 'customer' ? 'Customer Account' : 'Creditor Workspace'}
            </span>
            <span
              className="sidebar-org-name"
              title={user?.role === 'customer' ? (user?.accountName || 'My Account') : (user?.orgName || 'Demo Collections Org')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.85 }}>
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <path d="M9 22v-4h6v4" />
                <path d="M8 6h.01" />
                <path d="M16 6h.01" />
                <path d="M8 10h.01" />
                <path d="M16 10h.01" />
                <path d="M8 14h.01" />
                <path d="M16 14h.01" />
              </svg>
              <span>{user?.role === 'customer' ? (user?.accountName || 'My Account') : (user?.orgName || 'Demo Collections Org')}</span>
            </span>
          </div>
        )}

        <nav className="sidebar-nav">
          {items.map((item) => {
            const isSelected =
              location.pathname === item.to ||
              (item.to === '/platform-admin'
                ? location.pathname.startsWith('/platform-admin/orgs')
                : location.pathname.startsWith(item.to + '/'));

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={() => 'sidebar-link' + (isSelected ? ' is-active' : '')}
              >
                <NavIcon type={item.icon} />
                <span className="sidebar-link-text">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="user-avatar" title={user?.name || user?.email}>
              {initials}
            </div>
            <div className="sidebar-user">
              <span className="sidebar-user-name" title={user?.name || user?.email}>
                {user?.name || 'Signed in'}
              </span>
              <span className="sidebar-user-role">
                {ROLE_LABEL[user?.role] || user?.role}
                {user?.role !== 'customer' && user?.role !== 'platform_admin' && (
                  <span style={{ opacity: 0.8 }}> • {user?.orgName || 'Demo Collections Org'}</span>
                )}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
            title="Log out of ClearAR"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="content-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle navigation menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div className="topbar-breadcrumb">
              {user?.role === 'platform_admin' ? (
                <>
                  <span className="breadcrumb-org">Platform Admin</span>
                  <span className="breadcrumb-sep">/</span>
                  <span className="breadcrumb-current">{currentTitle}</span>
                </>
              ) : user?.role === 'customer' ? (
                <>
                  <span className="breadcrumb-org">{user?.accountName || 'Customer Portal'}</span>
                  <span className="breadcrumb-sep">/</span>
                  <span className="breadcrumb-current">{currentTitle}</span>
                  {user?.orgName && (
                    <span className="badge badge-neutral" style={{ marginLeft: '6px' }}>
                      Billed by {user.orgName}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="breadcrumb-org">{user?.orgName || 'Demo Collections Org'}</span>
                  <span className="badge badge-accent" style={{ marginLeft: '4px', marginRight: '4px' }}>
                    Creditor
                  </span>
                  <span className="breadcrumb-sep">/</span>
                  <span className="breadcrumb-current">{currentTitle}</span>
                </>
              )}
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="topbar-theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Orange Light Theme' : 'Switch to Dark Teal Theme'}
              aria-label={theme === 'dark' ? 'Switch to Orange Light Theme' : 'Switch to Dark Teal Theme'}
            >
              {theme === 'dark' ? (
                <Sun size={17} strokeWidth={2} className="topbar-theme-icon" aria-hidden="true" />
              ) : (
                <Moon size={17} strokeWidth={2} className="topbar-theme-icon" aria-hidden="true" />
              )}
            </button>
            {user?.role !== 'customer' && (
              <button
                type="button"
                className="topbar-email-btn"
                onClick={() => setEmailDrawerOpen(true)}
                title="Open Email Center"
                aria-label="Open Email Center"
              >
                <Mail size={16} strokeWidth={2} className="topbar-email-icon" aria-hidden="true" />
                <span className="topbar-email-label">Emails</span>
              </button>
            )}
            <NotificationBell />
            <div className="topbar-divider" aria-hidden="true" />
            <ProfileMenu />
          </div>
        </header>

        <div className="content-inner">
          {user?.orgId && <PtpAlertBanner orgId={user.orgId} />}
          <Outlet />
        </div>
      </main>

      {emailDrawerOpen && <EmailDrawer onClose={() => setEmailDrawerOpen(false)} />}
    </div>
  );
}