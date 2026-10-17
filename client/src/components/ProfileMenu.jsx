import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import SettingsModal from "./SettingsModal";
import "./ProfileMenu.css";

const ROLE_LABEL = {
  manager: "Manager",
  collector: "Collector",
  relationship_owner: "Relationship owner",
  customer: "Customer",
  platform_admin: "Platform admin",
};

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuRef = useRef(null);

  // Compute initials from name or email
  const initials = (user?.name || user?.email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  const firstName = user?.name
    ? user.name.split(" ")[0]
    : user?.email
    ? user.email.split("@")[0]
    : "Profile";

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleLogout() {
    setOpen(false);
    logout();
    navigate("/login");
  }

  function handleSettings() {
    setOpen(false);
    setSettingsOpen(true);
  }

  function handleNavigate(path) {
    setOpen(false);
    navigate(path);
  }

  return (
    <>
      <div className="pm-root" ref={menuRef}>
        <button
          type="button"
          id="profile-menu-trigger"
          className={`pm-trigger ${open ? "is-open" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="User account menu"
          title={`${user?.name || user?.email || "User"} (${ROLE_LABEL[user?.role] || user?.role})`}
        >
          <span className="pm-avatar-wrap">
            <span className="pm-avatar">{initials}</span>
            <span className="pm-status-dot" aria-hidden="true" />
          </span>
          <span className="pm-name-label">{firstName}</span>
          <svg
            className="pm-chevron"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <div className="pm-dropdown" role="menu" aria-label="Profile options">
            {/* Header info */}
            <div className="pm-dropdown-header">
              <div className="pm-user-avatar-large" aria-hidden="true">
                {initials}
              </div>
              <div className="pm-user-info-text">
                <span className="pm-user-fullname" title={user?.name}>
                  {user?.name || "Authenticated User"}
                </span>
                <span className="pm-user-email-text" title={user?.email || user?.orgName}>
                  {user?.email || user?.orgName || "Workspace Member"}
                </span>
                <span className="pm-user-role-badge">
                  {ROLE_LABEL[user?.role] || user?.role || "Staff"}
                </span>
              </div>
            </div>

            <div className="pm-dropdown-divider" />

            {/* Menu options */}
            <div className="pm-dropdown-menu">
              <button
                type="button"
                className="pm-menu-item"
                role="menuitem"
                id="profile-settings-btn"
                onClick={handleSettings}
              >
                <span className="pm-item-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </span>
                <div className="pm-item-content">
                  <span className="pm-item-title">Account Settings</span>
                  <span className="pm-item-desc">Name, password & profile</span>
                </div>
              </button>

              {user?.role === "manager" && (
                <button
                  type="button"
                  className="pm-menu-item"
                  role="menuitem"
                  onClick={() => handleNavigate("/admin")}
                >
                  <span className="pm-item-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <div className="pm-item-content">
                    <span className="pm-item-title">Org Management</span>
                    <span className="pm-item-desc">Users & roles configuration</span>
                  </div>
                </button>
              )}

              {(user?.role === "collector" || user?.role === "relationship_owner") && (
                <button
                  type="button"
                  className="pm-menu-item"
                  role="menuitem"
                  onClick={() => handleNavigate("/my-stats")}
                >
                  <span className="pm-item-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="7" />
                      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                    </svg>
                  </span>
                  <div className="pm-item-content">
                    <span className="pm-item-title">My Performance</span>
                    <span className="pm-item-desc">View stats & PTP kept-rate</span>
                  </div>
                </button>
              )}
            </div>

            <div className="pm-dropdown-divider" />

            <div className="pm-dropdown-footer">
              <button
                type="button"
                className="pm-menu-item pm-menu-item--logout"
                role="menuitem"
                id="profile-logout-btn"
                onClick={handleLogout}
              >
                <span className="pm-item-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <div className="pm-item-content">
                  <span className="pm-item-title">Sign Out</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
