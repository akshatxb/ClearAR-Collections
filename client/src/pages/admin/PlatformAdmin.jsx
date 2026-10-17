import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Copy, Eye, UserPlus, Power, Plus } from 'lucide-react';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/Modal';
import '../manager/Admin.css';
import './PlatformAdmin.css';

/**
 * Vendor-side org provisioning and overview for the platform_admin role.
 */
export default function PlatformAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [orgs, setOrgs] = useState([]);
  const [platformSummary, setPlatformSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [showCreate, setShowCreate] = useState(false);
  const [addingManagerOrg, setAddingManagerOrg] = useState(null);
  const [deactivatingOrg, setDeactivatingOrg] = useState(null);
  const [reactivatingOrg, setReactivatingOrg] = useState(null);
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null);

  // Search, filter, and sort state (P2.1)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive
  const [sortBy, setSortBy] = useState('newest'); // newest | oldest | name-asc | name-desc

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orgsRes, summaryRes] = await Promise.all([
        api.listPlatformOrgs(),
        api.getPlatformSummary(),
      ]);
      setOrgs(orgsRes.data);
      setPlatformSummary(summaryRes.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load platform data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredOrgs = useMemo(() => {
    return orgs
      .filter((o) => {
        if (searchTerm.trim()) {
          const match = o.name?.toLowerCase().includes(searchTerm.trim().toLowerCase());
          if (!match) return false;
        }
        if (statusFilter === 'active' && !o.active) return false;
        if (statusFilter === 'inactive' && o.active) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        }
        if (sortBy === 'name-asc') {
          return (a.name || '').localeCompare(b.name || '');
        }
        if (sortBy === 'name-desc') {
          return (b.name || '').localeCompare(a.name || '');
        }
        return 0;
      });
  }, [orgs, searchTerm, statusFilter, sortBy]);


  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Organizations</h1>
          <p className="page-subtitle">Provision, manage, and monitor tenant organizations</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {/* Platform-Wide Rollup Stat Cards */}
      <div className="stat-cards-grid">
        <div className="stat-card">
          <span className="stat-label">Active Tenants</span>
          <span className="stat-value">{platformSummary?.activeOrganizations ?? orgs.filter(o => o.active).length}</span>
          <span className="stat-sub">
            {platformSummary?.inactiveOrganizations ?? orgs.filter(o => !o.active).length} inactive
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Staff</span>
          <span className="stat-value">{platformSummary?.totalStaffUsers ?? 0}</span>
          <span className="stat-sub">Across all tenants</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Accounts Managed</span>
          <span className="stat-value">{platformSummary?.totalAccounts ?? 0}</span>
          <span className="stat-sub">{platformSummary?.totalInvoices ?? 0} total invoices</span>
        </div>

      </div>

      <div className="panel">
        <div className="panel-title-row">
          <div className="panel-title-group">
            <span className="panel-title">Tenant Organizations</span>
            <span className="badge badge-neutral">{filteredOrgs.length} of {orgs.length}</span>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} strokeWidth={2.5} />
            <span>New organization</span>
          </button>
        </div>

        {/* Filter / Search Bar */}
        <div className="platform-toolbar">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="platform-search-input"
              placeholder="Search organizations by name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchTerm('')}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={13} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="platform-filter-group">
            <div className="platform-filter-item">
              <label htmlFor="status-filter" className="platform-filter-label">Status:</label>
              <select
                id="status-filter"
                className="platform-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>

            <div className="platform-filter-item">
              <label htmlFor="sort-by" className="platform-filter-label">Sort:</label>
              <select
                id="sort-by"
                className="platform-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name-asc">Name (A–Z)</option>
                <option value="name-desc">Name (Z–A)</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="empty-state">Loading organizations…</p>
        ) : filteredOrgs.length === 0 ? (
          <p className="empty-state">
            {orgs.length === 0 ? 'No organizations yet.' : 'No organizations match your filters.'}
          </p>
        ) : (
          <table className="mini-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Status</th>
                <th>Created</th>
                <th className="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrgs.map((o) => (
                <tr key={o.id}>
                  <td>
                    <button
                      type="button"
                      className="org-name-link"
                      onClick={() => navigate(`/platform-admin/orgs/${o.id}`)}
                    >
                      {o.name}
                    </button>
                  </td>
                  <td>
                    {o.active ? (
                      <span className="user-status-active">Active</span>
                    ) : (
                      <span className="user-status-inactive">Inactive</span>
                    )}
                  </td>
                  <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="align-right">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="tbl-btn tbl-btn-secondary"
                        onClick={() => navigate(`/platform-admin/orgs/${o.id}`)}
                      >
                        <Eye size={12} strokeWidth={2} />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        className="tbl-btn tbl-btn-primary"
                        disabled={!o.active}
                        title={!o.active ? 'Cannot add manager to inactive organization' : 'Add manager'}
                        onClick={() => setAddingManagerOrg(o)}
                      >
                        <UserPlus size={12} strokeWidth={2} />
                        <span>Add manager</span>
                      </button>
                      {o.active ? (
                        <button
                          type="button"
                          className="tbl-btn tbl-btn-danger"
                          onClick={() => setDeactivatingOrg(o)}
                          title="Deactivate organization"
                        >
                          <Power size={12} strokeWidth={2} />
                          <span>Deactivate</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="tbl-btn tbl-btn-success"
                          onClick={() => setReactivatingOrg(o)}
                          title="Reactivate organization"
                        >
                          <Power size={12} strokeWidth={2} />
                          <span>Reactivate</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Org Modal */}
      {showCreate && (
        <CreateOrgModal
          onClose={() => setShowCreate(false)}
          onCreated={(newOrg) => {
            setShowCreate(false);
            toast.success(`Organization "${newOrg.name}" created.`);
            load();
          }}
        />
      )}

      {/* Add Manager Modal */}
      {addingManagerOrg && (
        <AddManagerModal
          org={addingManagerOrg}
          onClose={() => setAddingManagerOrg(null)}
          onAdded={(data) => {
            const orgName = addingManagerOrg.name;
            setAddingManagerOrg(null);
            setTempPasswordInfo({ orgName, email: data.email, tempPassword: data.tempPassword });
            toast.success(`Manager added for ${orgName}.`);
            load();
          }}
        />
      )}

      {/* Deactivate Org Modal */}
      {deactivatingOrg && (
        <DeactivateOrgModal
          org={deactivatingOrg}
          onClose={() => setDeactivatingOrg(null)}
          onDeactivated={() => {
            const name = deactivatingOrg.name;
            setDeactivatingOrg(null);
            toast.success(`"${name}" deactivated. User logins blocked.`);
            load();
          }}
        />
      )}

      {/* Reactivate Org Modal */}
      {reactivatingOrg && (
        <ReactivateOrgModal
          org={reactivatingOrg}
          onClose={() => setReactivatingOrg(null)}
          onReactivated={() => {
            const name = reactivatingOrg.name;
            setReactivatingOrg(null);
            toast.success(`"${name}" reactivated. User logins restored.`);
            load();
          }}
        />
      )}

      {/* One-time Temp Password Display Modal */}
      {tempPasswordInfo && (
        <TempPasswordModal
          info={tempPasswordInfo}
          onClose={() => setTempPasswordInfo(null)}
        />
      )}
    </div>
  );
}

function CreateOrgModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.createPlatformOrg(name.trim());
      onCreated(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create this organization.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New organization" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="org-name">Organization name</label>
          <input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp"
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
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AddManagerModal({ org, onClose, onAdded }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.seedPlatformManager(org.id, { email: email.trim(), name: name.trim() });
      onAdded(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add a manager for this organization.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Add manager — ${org.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="mgr-name">Full name</label>
          <input
            id="mgr-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Doe"
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="mgr-email">Email address</label>
          <input
            id="mgr-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. manager@tenant.com"
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !email.trim()}>
            {busy ? 'Adding…' : 'Add manager'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DeactivateOrgModal({ org, onClose, onDeactivated }) {
  const [typedName, setTypedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canConfirm = typedName.trim() === org.name.trim();

  async function submit(e) {
    e.preventDefault();
    if (!canConfirm) return;
    setBusy(true);
    setError('');
    try {
      await api.deactivatePlatformOrg(org.id);
      onDeactivated();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not deactivate this organization.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Deactivate ${org.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="warning-callout">
          <p className="warning-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Warning: Destructive Action</span>
          </p>
          <p className="warning-desc">
            Deactivating this organization will immediately <strong>block login access</strong> for all staff
            members and customer portal users belonging to this tenant.
          </p>
        </div>

        <div className="field">
          <label htmlFor="confirm-name">
            To confirm, type <strong>{org.name}</strong> below:
          </label>
          <input
            id="confirm-name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={org.name}
            autoFocus
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-danger"
            disabled={!canConfirm || busy}
          >
            {busy ? 'Deactivating…' : 'Deactivate organization'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ReactivateOrgModal({ org, onClose, onReactivated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.reactivatePlatformOrg(org.id);
      onReactivated();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reactivate this organization.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Reactivate ${org.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="modal-description">
          Reactivating <strong>{org.name}</strong> will restore access for all staff and customer accounts in this organization.
        </p>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Reactivating…' : 'Reactivate organization'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function TempPasswordModal({ info, onClose }) {
  const [copied, setCopied] = useState(false);

  function copyPassword() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(info.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <Modal title="Temporary password generated" onClose={onClose}>
      <div className="temp-password-modal-content">
        <p className="modal-description">
          A temporary password has been issued for <strong>{info.email}</strong>
          {info.orgName ? <> in <strong>{info.orgName}</strong></> : null}.
        </p>

        <div className="temp-password-box">
          <span className="temp-password-code">{info.tempPassword}</span>
          <button type="button" className="btn btn-quiet copy-pwd-btn" onClick={copyPassword}>
            {copied ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                <span>Copied</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Copy size={13} strokeWidth={2} aria-hidden="true" />
                <span>Copy</span>
              </span>
            )}
          </button>
        </div>

        <p className="security-notice" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginTop: '2px', flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>
            <strong>One-time display:</strong> This password cannot be recovered once this dialog is closed.
            Share it securely with the user. They can change it at any time from their profile settings.
          </span>
        </p>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
