import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/useAuth";
import * as endpoints from "../api/endpoints";
import "./SettingsModal.css";

const ROLE_LABEL = {
  manager: "Manager",
  collector: "Collector",
  relationship_owner: "Relationship owner",
  customer: "Customer",
  platform_admin: "Platform admin",
};

export default function SettingsModal({ onClose }) {
  const { user, updateUserName } = useAuth();
  const [activeTab, setActiveTab] = useState("profile"); // 'profile' | 'security'

  // Profile section state
  const [name, setName] = useState(user?.name || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password section state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState("");
  const [passError, setPassError] = useState("");

  // User initials
  const initials = (user?.name || user?.email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  // Keyboard Escape listener
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    if (!name.trim()) {
      setProfileError("Display name cannot be empty.");
      return;
    }
    setProfileLoading(true);
    try {
      await endpoints.updateMyProfile({ name: name.trim() });
      updateUserName(name.trim());
      setProfileSuccess("Profile name updated successfully.");
    } catch (err) {
      setProfileError(err?.response?.data?.message || "Failed to update profile name.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");
    if (!currentPassword) {
      setPassError("Please provide your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPassError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError("New password and confirmation do not match.");
      return;
    }
    setPassLoading(true);
    try {
      await endpoints.changeMyPassword({ currentPassword, newPassword });
      setPassSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPassError(err?.response?.data?.message || "Failed to update password.");
    } finally {
      setPassLoading(false);
    }
  }

  return createPortal(
    <div className="settings-backdrop" onMouseDown={onClose}>
      <div
        className="settings-modal-card"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Account Settings"
      >
        {/* Header */}
        <div className="settings-head">
          <div className="settings-title-wrap">
            <div className="settings-badge-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <h3 className="settings-heading">Account Settings</h3>
              <p className="settings-subheading">Manage personal identity and security credentials</p>
            </div>
          </div>
          <button
            type="button"
            className="settings-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab switcher */}
        <div className="settings-tab-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "profile"}
            className={`settings-tab-item ${activeTab === "profile" ? "is-active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Profile Identity</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "security"}
            className={`settings-tab-item ${activeTab === "security" ? "is-active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Password & Security</span>
          </button>
        </div>

        {/* Body content */}
        <div className="settings-body">
          {activeTab === "profile" && (
            <form onSubmit={handleProfileSave} className="settings-form">
              <div className="settings-body-scroll">
                {/* Profile Card Preview */}
                <div className="settings-profile-card">
                  <div className="settings-avatar-preview" aria-hidden="true">
                    {initials}
                  </div>
                  <div className="settings-profile-meta">
                    <div className="settings-meta-row">
                      <span className="settings-preview-name">{user?.name || "No name set"}</span>
                      <span className="settings-preview-role">
                        {ROLE_LABEL[user?.role] || user?.role || "Staff"}
                      </span>
                    </div>
                    <span className="settings-preview-email">{user?.email || "—"}</span>
                  </div>
                </div>

                {profileSuccess && (
                  <div className="settings-alert settings-alert--success">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{profileSuccess}</span>
                  </div>
                )}

                {profileError && (
                  <div className="settings-alert settings-alert--error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{profileError}</span>
                  </div>
                )}

                <div className="settings-field">
                  <label htmlFor="settings-name-input">Full Name</label>
                  <input
                    id="settings-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alexandra Davis"
                    autoComplete="name"
                    required
                  />
                  <span className="settings-hint">This name is displayed across the worklist, audit trail, and activity logs.</span>
                </div>

                <div className="settings-field">
                  <label htmlFor="settings-email-input">
                    Email Address
                    <span className="settings-readonly-badge">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      Locked
                    </span>
                  </label>
                  <input
                    id="settings-email-input"
                    type="email"
                    value={user?.email || ""}
                    readOnly
                    disabled
                    className="is-disabled"
                  />
                  <span className="settings-hint">Email is tied to your organization account and cannot be modified self-service.</span>
                </div>
              </div>

              <div className="settings-actions">
                <button type="button" className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={profileLoading}
                >
                  {profileLoading ? "Saving Changes…" : "Save Profile"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "security" && (
            <form onSubmit={handlePasswordSave} className="settings-form">
              <div className="settings-body-scroll">
                <div className="settings-security-notice">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <p>
                    Ensure your account is protected with a secure password consisting of at least 8 characters.
                  </p>
                </div>

                {passSuccess && (
                  <div className="settings-alert settings-alert--success">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{passSuccess}</span>
                  </div>
                )}

                {passError && (
                  <div className="settings-alert settings-alert--error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{passError}</span>
                  </div>
                )}

                <div className="settings-field">
                  <label htmlFor="settings-current-pw">Current Password</label>
                  <input
                    id="settings-current-pw"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor="settings-new-pw">New Password</label>
                  <input
                    id="settings-new-pw"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor="settings-confirm-pw">Confirm New Password</label>
                  <input
                    id="settings-confirm-pw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <div className="settings-actions">
                <button type="button" className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={passLoading}
                >
                  {passLoading ? "Updating Password…" : "Update Password"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
