import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { X, UserPlus, Pencil, Power, KeyRound } from 'lucide-react';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/Modal';
import { AddManagerModal, DeactivateOrgModal, ReactivateOrgModal, TempPasswordModal } from './PlatformAdmin';
import './PlatformAdmin.css';
import './PlatformOrgDetail.css';

export default function PlatformOrgDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [org, setOrg] = useState(null);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('users');

  // Modals state
  const [showEditName, setShowEditName] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);
  const [resettingUser, setResettingUser] = useState(null);
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orgRes, summaryRes, usersRes, activityRes] = await Promise.all([
        api.getPlatformOrg(id),
        api.getPlatformOrgSummary(id),
        api.getPlatformOrgUsers(id),
        api.getPlatformOrgActivity(id),
      ]);
      setOrg(orgRes.data);
      setSummary(summaryRes.data);
      setUsers(usersRes.data);
      setActivity(activityRes.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load organization details.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  if (loading && !org) {
    return (
      <div className="org-detail-container">
        <p className="empty-state">Loading organization…</p>
      </div>
    );
  }

  if (error && !org) {
    return (
      <div className="org-detail-container">
        <p className="error-text">{error}</p>
        <Link to="/platform-admin" className="btn btn-quiet">
          ← Back to organizations
        </Link>
      </div>
    );
  }

  return (
    <div className="org-detail-container">
      {/* Breadcrumb Navigation */}
      <div className="detail-breadcrumb">
        <Link to="/platform-admin" className="breadcrumb-link">
          ← Organizations
        </Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{org.name}</span>
      </div>

      {/* Page Header */}
      <div className="org-header-card">
        <div className="org-header-main">
          <div className="org-title-line">
            <h1 className="org-title">{org.name}</h1>
            <span className={org.active ? 'user-status-active' : 'user-status-inactive'}>
              {org.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="org-meta-text">
            Tenant ID: <code>#{org.id}</code> • Created: {new Date(org.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="org-header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowEditName(true)}>
            <Pencil size={13} strokeWidth={2} />
            <span>Edit name</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!org.active}
            title={!org.active ? 'Cannot add manager to inactive organization' : 'Add manager'}
            onClick={() => setShowAddManager(true)}
          >
            <UserPlus size={14} strokeWidth={2} />
            <span>Add manager</span>
          </button>
          {org.active ? (
            <button
              type="button"
              className="btn btn-danger-outline"
              onClick={() => setShowDeactivate(true)}
            >
              <Power size={13} strokeWidth={2} />
              <span>Deactivate</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-success-outline"
              onClick={() => setShowReactivate(true)}
            >
              <Power size={13} strokeWidth={2} />
              <span>Reactivate</span>
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {/* Usage Rollup Stat Cards (P1.3) */}
      <div className="stat-cards-grid">
        <div className="stat-card">
          <span className="stat-label">Users</span>
          <span className="stat-value">{summary?.userCount ?? 0}</span>
          <span className="stat-sub">Staff in org</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Accounts</span>
          <span className="stat-value">{summary?.accountCount ?? 0}</span>
          <span className="stat-sub">Customer accounts</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Invoices</span>
          <span className="stat-value">{summary?.invoiceCount ?? 0}</span>
          <span className="stat-sub">Total billed</span>
        </div>

      </div>

      {/* Tabs Navigation */}
      <div className="detail-tabs">
        <button
          type="button"
          className={`detail-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users & Managers ({users.length})
        </button>
        <button
          type="button"
          className={`detail-tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Activity Log ({activity.length})
        </button>
      </div>

      {/* Tab: Users / Managers (P1.2, P1.4, P2.3) */}
      {activeTab === 'users' && (
        <div className="panel detail-panel">
          <div className="panel-title-row">
            <span className="panel-title">Users roster</span>
            <button
              type="button"
              className="tbl-btn tbl-btn-primary"
              disabled={!org.active}
              title={!org.active ? 'Cannot add manager to inactive organization' : 'Add manager'}
              onClick={() => setShowAddManager(true)}
            >
              <UserPlus size={12} strokeWidth={2} />
              <span>Add manager</span>
            </button>
          </div>

          {users.length === 0 ? (
            <div className="empty-state-box">
              <p>No staff users found for this organization.</p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!org.active}
                onClick={() => setShowAddManager(true)}
              >
                <UserPlus size={14} strokeWidth={2} />
                <span>Add first manager</span>
              </button>
            </div>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="user-name-cell">
                      <strong>{u.name || '—'}</strong>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="role-tag">{u.role}</span>
                    </td>
                    <td>
                      {u.active ? (
                        <span className="user-status-active">Active</span>
                      ) : (
                        <span className="user-status-inactive">Inactive</span>
                      )}
                    </td>
                    <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                    <td className="align-right">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="tbl-btn tbl-btn-secondary"
                          title="Issue a temporary password for this user"
                          onClick={() => setResettingUser(u)}
                        >
                          <KeyRound size={12} strokeWidth={2} />
                          <span>Reset password</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Activity / Platform Audit Log (P1.6, P1.7) */}
      {activeTab === 'activity' && (
        <div className="panel detail-panel">
          <div className="panel-title-row">
            <span className="panel-title">Audit log history</span>
          </div>

          {activity.length === 0 ? (
            <p className="empty-state">No activity logged for this organization yet.</p>
          ) : (
            <div className="activity-timeline">
              {activity.map((entry) => (
                <ActivityEntryItem key={entry.id} entry={entry} formatDateTime={formatDateTime} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Name Modal (P1.5) */}
      {showEditName && (
        <EditOrgNameModal
          org={org}
          onClose={() => setShowEditName(false)}
          onUpdated={(updated) => {
            setShowEditName(false);
            setOrg(updated);
            toast.success(`Organization renamed to "${updated.name}".`);
            loadData();
          }}
        />
      )}

      {/* Add Manager Modal (P1.4, P2.4) */}
      {showAddManager && (
        <AddManagerModal
          org={org}
          onClose={() => setShowAddManager(false)}
          onAdded={(data) => {
            setShowAddManager(false);
            setTempPasswordInfo({ orgName: org.name, email: data.email, tempPassword: data.tempPassword });
            toast.success(`Manager added for ${org.name}.`);
            loadData();
          }}
        />
      )}

      {/* Deactivate Org Modal */}
      {showDeactivate && (
        <DeactivateOrgModal
          org={org}
          onClose={() => setShowDeactivate(false)}
          onDeactivated={() => {
            setShowDeactivate(false);
            toast.success(`"${org.name}" deactivated.`);
            loadData();
          }}
        />
      )}

      {/* Reactivate Org Modal */}
      {showReactivate && (
        <ReactivateOrgModal
          org={org}
          onClose={() => setShowReactivate(false)}
          onReactivated={() => {
            setShowReactivate(false);
            toast.success(`"${org.name}" reactivated.`);
            loadData();
          }}
        />
      )}

      {/* Reset User Password Confirm Modal (P2.3) */}
      {resettingUser && (
        <ResetPasswordModal
          orgId={org.id}
          user={resettingUser}
          onClose={() => setResettingUser(null)}
          onReset={(data) => {
            setResettingUser(null);
            setTempPasswordInfo({ orgName: org.name, email: data.email, tempPassword: data.tempPassword });
            toast.success(`Password reset for ${data.email}.`);
            loadData();
          }}
        />
      )}

      {/* Temp Password Display Modal */}
      {tempPasswordInfo && (
        <TempPasswordModal
          info={tempPasswordInfo}
          onClose={() => setTempPasswordInfo(null)}
        />
      )}
    </div>
  );
}

function EditOrgNameModal({ org, onClose, onUpdated }) {
  const [name, setName] = useState(org.name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || name.trim() === org.name) {
      onClose();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.updatePlatformOrg(org.id, { name: name.trim() });
      onUpdated(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update organization name.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit organization name" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="edit-org-name">Organization name</label>
          <input
            id="edit-org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ orgId, user, onClose, onReset }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.resetPlatformUserPassword(orgId, user.id);
      onReset(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reset password.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Reset password — ${user.name || user.email}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="modal-description">
          Are you sure you want to generate a new temporary password for <strong>{user.email}</strong>?
          Their current password will be invalidated immediately.
        </p>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Generating…' : 'Generate new password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ActivityEntryItem({ entry, formatDateTime }) {
  const actionLabels = {
    ORG_CREATED: { label: 'Org Created', class: 'badge-action-create' },
    ORG_EDITED: { label: 'Org Renamed', class: 'badge-action-edit' },
    ORG_DEACTIVATED: { label: 'Org Deactivated', class: 'badge-action-danger' },
    ORG_ACTIVATED: { label: 'Org Reactivated', class: 'badge-action-success' },
    MANAGER_ADDED: { label: 'Manager Added', class: 'badge-action-manager' },
    MANAGER_PASSWORD_RESET: { label: 'Password Reset', class: 'badge-action-reset' },
  };

  const actionMeta = actionLabels[entry.action] || { label: entry.action, class: 'badge-neutral' };

  let details = null;
  let before = null;
  let after = null;
  try {
    before = entry.beforeJson ? JSON.parse(entry.beforeJson) : null;
    after = entry.afterJson ? JSON.parse(entry.afterJson) : null;
  } catch {
    // If parsing fails, skip detail display
  }

  if (entry.action === 'ORG_EDITED' && before && after) {
    details = (
      <span className="diff-text">
        Name changed from <em>"{before.name}"</em> → <strong>"{after.name}"</strong>
      </span>
    );
  } else if (entry.action === 'MANAGER_ADDED' && after) {
    details = (
      <span className="diff-text">
        Added manager <strong>{after.name || after.email}</strong> ({after.email})
      </span>
    );
  } else if (entry.action === 'MANAGER_PASSWORD_RESET' && after) {
    details = (
      <span className="diff-text">
        Reset temporary password for <strong>{after.email}</strong>
      </span>
    );
  }

  return (
    <div className="activity-item">
      <div className="activity-item-left">
        <span className={`activity-action-badge ${actionMeta.class}`}>{actionMeta.label}</span>
        <div className="activity-item-details">
          {details}
          <div className="activity-actor">
            By <strong>{entry.actorName || 'Platform Admin'}</strong> ({entry.actorEmail})
          </div>
        </div>
      </div>
      <div className="activity-item-time">{formatDateTime(entry.createdAt)}</div>
    </div>
  );
}
