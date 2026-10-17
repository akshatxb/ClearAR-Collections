import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Search,
  X,
  RotateCcw,
  UserX,
  UserCheck,
  Pencil,
  Trash2,
  Play,
  UploadCloud,
  Download,
  Copy,
  Check,
  CheckCircle2,
  RotateCw,
  Clock,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useToast } from '../../context/ToastContext';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import Modal from '../../components/Modal';
import AgingBadge from '../../components/AgingBadge';
import './Admin.css';

const ROLES = ['manager', 'collector', 'relationship_owner'];

const STANDARD_TEMPLATES = [
  {
    category: 'dispute',
    code: 'dispute_invoice_terms',
    label: 'Disputed invoice terms or pricing',
  },
  {
    category: 'dispute',
    code: 'dispute_goods_damaged',
    label: 'Goods damaged or delivery issue',
  },
  {
    category: 'customer',
    code: 'customer_cashflow_pause',
    label: 'Customer temporary cash-flow delay',
  },
  {
    category: 'customer',
    code: 'customer_awaiting_approval',
    label: 'Customer internal executive approval pending',
  },
  {
    category: 'internal',
    code: 'internal_credit_memo',
    label: 'Pending credit memo / billing reconciliation',
  },
];

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [codes, setCodes] = useState([]);
  const [slaRules, setSlaRules] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [loadingSla, setLoadingSla] = useState(true);
  const [error, setError] = useState('');

  const orgId = user?.orgId;

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data } = await api.listUsers();
      setUsers(data || []);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load users.'));
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadCodes = useCallback(async () => {
    setLoadingCodes(true);
    try {
      const { data } = await api.getReasonCodes();
      setCodes(data || []);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load reason codes.'));
    } finally {
      setLoadingCodes(false);
    }
  }, []);

  const loadSlaRules = useCallback(async () => {
    if (!orgId) return;
    setLoadingSla(true);
    try {
      const { data } = await api.getEscalationRules(orgId);
      setSlaRules(data || []);
    } catch (err) {
      console.error('Could not load SLA rules:', err);
    } finally {
      setLoadingSla(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadUsers();
    loadCodes();
    loadSlaRules();
  }, [loadUsers, loadCodes, loadSlaRules]);

  // Derived metrics
  const activeCount = useMemo(() => users.filter((u) => u.active).length, [users]);
  const collectorCount = useMemo(() => users.filter((u) => u.role === 'collector').length, [users]);
  const relOwnerCount = useMemo(
    () => users.filter((u) => u.role === 'relationship_owner').length,
    [users]
  );

  return (
    <div className="admin-page-container">
      {/* Clean B2B Header */}
      <div className="page-header" style={{ alignItems: 'center' }}>
        <h1 className="page-title">Operations</h1>
      </div>

      {/* Compact Workspace Profile Strip */}
      <div className="workspace-profile-strip">
        <div className="profile-strip-main">
          <div className="profile-org-identity">
            <span className="profile-org-name">{user?.orgName || 'Primary Creditor Workspace'}</span>
            <span className="profile-org-id num">Org ID #{orgId || 1}</span>
          </div>
          <div className="profile-meta-pills">
            <div className="profile-pill">
              <span className="profile-pill-label">Manager</span>
              <span className="profile-pill-val">{user?.name || user?.email}</span>
            </div>
            <div className="profile-pill">
              <span className="profile-pill-label">Base currency</span>
              <span className="profile-pill-val">USD ($)</span>
            </div>
            <div className="profile-pill">
              <span className="profile-pill-label">Status</span>
              <span className="profile-pill-val" style={{ color: 'var(--success-strong)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span className="status-dot-pulse" />
                Active Creditor Workspace
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="admin-metrics-grid">
        <div className="admin-stat-card">
          <span className="admin-stat-label">Total staff</span>
          <div className="admin-stat-val-group">
            <span className="admin-stat-value num">{users.length}</span>
            <span className="admin-stat-tag tag-good">{activeCount} active</span>
          </div>
          <span className="admin-stat-sub">Across all configured roles</span>
        </div>

        <div className="admin-stat-card">
          <span className="admin-stat-label">Collectors</span>
          <div className="admin-stat-val-group">
            <span className="admin-stat-value num">{collectorCount}</span>
            <span className="admin-stat-tag tag-neutral">Worklist owners</span>
          </div>
          <span className="admin-stat-sub">Direct debtor outreach</span>
        </div>

        <div className="admin-stat-card">
          <span className="admin-stat-label">Relationship owners</span>
          <div className="admin-stat-val-group">
            <span className="admin-stat-value num">{relOwnerCount}</span>
            <span className="admin-stat-tag tag-accent">Co-actors</span>
          </div>
          <span className="admin-stat-sub">Account managers & sales leads</span>
        </div>

        <div className="admin-stat-card">
          <span className="admin-stat-label">Reason codes</span>
          <div className="admin-stat-val-group">
            <span className="admin-stat-value num">{codes.length}</span>
            <span className="admin-stat-tag tag-neutral">Configured</span>
          </div>
          <span className="admin-stat-sub">Dispute & outcome taxonomy</span>
        </div>
      </div>

      {/* Tab Navigation with 4 Capabilities */}
      <div className="tab-row" style={{ marginTop: '16px' }}>
        <button
          type="button"
          className={`tab-btn${tab === 'users' ? ' is-active' : ''}`}
          onClick={() => setTab('users')}
        >
          <span>Team members</span>
        </button>
        <button
          type="button"
          className={`tab-btn${tab === 'reason-codes' ? ' is-active' : ''}`}
          onClick={() => setTab('reason-codes')}
        >
          <span>Reason codes</span>
        </button>
        <button
          type="button"
          className={`tab-btn${tab === 'sla-rules' ? ' is-active' : ''}`}
          onClick={() => setTab('sla-rules')}
        >
          <span>SLA escalation rules</span>
        </button>
        <button
          type="button"
          className={`tab-btn${tab === 'data-ops' ? ' is-active' : ''}`}
          onClick={() => setTab('data-ops')}
        >
          <span>Data management</span>
        </button>
      </div>

      {error && <p className="error-text" style={{ marginTop: '12px' }}>{error}</p>}

      {tab === 'users' && (
        <UsersPanel
          users={users}
          loading={loadingUsers}
          onRefresh={loadUsers}
          setUsers={setUsers}
          currentUser={user}
        />
      )}

      {tab === 'reason-codes' && (
        <ReasonCodesPanel
          codes={codes}
          loading={loadingCodes}
          onRefresh={loadCodes}
          setCodes={setCodes}
        />
      )}

      {tab === 'sla-rules' && (
        <SlaRulesPanel
          rules={slaRules}
          loading={loadingSla}
          orgId={orgId}
          onRefresh={loadSlaRules}
        />
      )}

      {tab === 'data-ops' && (
        <DataOperationsPanel
          orgId={orgId}
          onAccountsImported={() => {
            loadUsers();
          }}
        />
      )}
    </div>
  );
}

/* =====================================================================
 * TAB 1: User Management Panel (Clean role dropdown, consistent filters)
 * ===================================================================== */
function UsersPanel({ users, loading, onRefresh, setUsers, currentUser }) {
  const { toast } = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [busyId, setBusyId] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const term = searchQuery.toLowerCase().trim();
      const matchSearch =
        !term ||
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term));

      const matchRole = roleFilter === 'all' || u.role === roleFilter;

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && u.active) ||
        (statusFilter === 'deactivated' && !u.active);

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  async function handleRoleChange(u, role) {
    setBusyId(u.id);
    try {
      const { data } = await api.updateUserRole(u.id, role);
      setUsers((list) => list.map((x) => (x.id === u.id ? data : x)));
      toast.success(`${u.name || u.email} role updated to ${role.replace('_', ' ')}.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not update role.'));
    } finally {
      setBusyId('');
    }
  }

  async function handleToggleActive(u) {
    setBusyId(u.id);
    try {
      const { data } = await api.setUserActive(u.id, !u.active);
      setUsers((list) => list.map((x) => (x.id === u.id ? data : x)));
      toast.success(`${u.name || u.email} ${!u.active ? 'reactivated' : 'deactivated'}.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not update user.'));
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="panel">
      <div className="panel-title-row">
        <span className="panel-title">Team members roster</span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowInvite(true)}
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>Invite user</span>
        </button>
      </div>

      {/* Consistent Roster Filter Bar */}
      <div className="admin-filter-bar">
        <div className="admin-search-wrap">
          <Search size={14} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search team member by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={13} strokeWidth={2} />
            </button>
          )}
        </div>

        <label className="admin-filter-label">
          Role
          <select
            className="admin-filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All roles</option>
            <option value="manager">Manager</option>
            <option value="collector">Collector</option>
            <option value="relationship_owner">Relationship owner</option>
          </select>
        </label>

        <label className="admin-filter-label">
          Status
          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </label>

        {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
          <button
            type="button"
            className="btn-quiet"
            style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => {
              setSearchQuery('');
              setRoleFilter('all');
              setStatusFilter('all');
            }}
          >
            <RotateCcw size={12} strokeWidth={2} />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      {loading ? (
        <p className="empty-state">Loading users…</p>
      ) : filteredUsers.length === 0 ? (
        <div className="admin-empty-filter">
          <p className="empty-state">
            {users.length === 0
              ? 'No users in this organization yet.'
              : 'No team members match your current filter criteria.'}
          </p>
        </div>
      ) : (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Email address</th>
              <th>System role</th>
              <th>Account status</th>
              <th>Joined date</th>
              <th className="align-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => {
              const initials = (u.name || u.email || '?')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              const isSelf = currentUser?.userId === u.id || currentUser?.id === u.id;

              return (
                <tr key={u.id}>
                  <td>
                    <div className="admin-user-cell">
                      <div className="admin-avatar">{initials}</div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="admin-user-name">{u.name || 'Unnamed member'}</span>
                          {isSelf && <span className="status-pill tone-accent" style={{ fontSize: '10px' }}>You</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="admin-email-text">{u.email}</span>
                  </td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      disabled={busyId === u.id || isSelf}
                      title={isSelf ? 'You cannot change your own role' : 'Change member role'}
                      className="admin-role-select"
                      aria-label={`Change role for ${u.name || u.email}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`status-pill tone-${u.active ? 'good' : 'neutral'}`}>
                      {u.active ? 'active' : 'deactivated'}
                    </span>
                  </td>
                  <td className="num">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="align-right">
                    <div className="row-actions">
                      {u.active ? (
                        <button
                          type="button"
                          className="tbl-btn tbl-btn-danger"
                          onClick={() => handleToggleActive(u)}
                          disabled={busyId === u.id || isSelf}
                          title={isSelf ? 'You cannot deactivate your own account' : 'Deactivate member'}
                        >
                          <UserX size={12} strokeWidth={2} />
                          <span>{busyId === u.id ? 'Saving…' : 'Deactivate'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="tbl-btn tbl-btn-success"
                          onClick={() => handleToggleActive(u)}
                          disabled={busyId === u.id || isSelf}
                          title="Reactivate member"
                        >
                          <UserCheck size={12} strokeWidth={2} />
                          <span>{busyId === u.id ? 'Saving…' : 'Reactivate'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function InviteUserModal({ onClose, onInvited }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('collector');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resultCredentials, setResultCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.inviteUser({ email, name, role });
      setResultCredentials({
        name: name || email,
        email,
        role,
        tempPassword: data.tempPassword,
      });
      onInvited();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not invite this user.'));
    } finally {
      setBusy(false);
    }
  }

  function handleCopy() {
    if (!resultCredentials) return;
    const text = `Workspace Login Credentials:\nEmail: ${resultCredentials.email}\nTemporary Password: ${resultCredentials.tempPassword}\nRole: ${resultCredentials.role}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal title={resultCredentials ? 'Invitation created' : 'Invite team member'} onClose={onClose}>
      {resultCredentials ? (
        <div className="invite-success-card">
          <div className="invite-success-header">
            <CheckCircle2 size={20} color="var(--success-strong)" />
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Account provisioned successfully</span>
          </div>
          <p className="invite-success-sub">
            Share these temporary credentials with <strong>{resultCredentials.name}</strong> to let them sign in and reset their password.
          </p>

          <div className="credentials-box">
            <div className="credential-row">
              <span className="cred-label">Login email:</span>
              <span className="cred-val num">{resultCredentials.email}</span>
            </div>
            <div className="credential-row">
              <span className="cred-label">Temporary password:</span>
              <span className="cred-val num cred-password">{resultCredentials.tempPassword}</span>
            </div>
            <div className="credential-row">
              <span className="cred-label">Assigned role:</span>
              <span className="cred-val" style={{ textTransform: 'capitalize' }}>
                {resultCredentials.role.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button type="button" className="btn btn-primary" onClick={handleCopy}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Copied credentials!' : 'Copy credentials'}</span>
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="invite-name">Full name</label>
            <input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Connor"
            />
          </div>
          <div className="field">
            <label htmlFor="invite-email">Email address</label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@company.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="invite-role">Assign role</label>
            <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Inviting…' : 'Generate invitation'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* =====================================================================
 * TAB 2: Reason Code Catalog with Filter Chips & Centered Buttons
 * ===================================================================== */
function ReasonCodesPanel({ codes, loading, onRefresh, setCodes }) {
  const { toast } = useToast();
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = useMemo(() => {
    const set = new Set(codes.map((c) => (c.category || 'other').toLowerCase()).filter(Boolean));
    return Array.from(set).sort();
  }, [codes]);

  const filteredCodes = useMemo(() => {
    return codes.filter((rc) => {
      const term = searchQuery.toLowerCase().trim();
      const matchSearch =
        !term ||
        (rc.label && rc.label.toLowerCase().includes(term)) ||
        (rc.code && rc.code.toLowerCase().includes(term));

      const matchCat =
        activeCategory === 'all' || (rc.category || '').toLowerCase() === activeCategory.toLowerCase();

      return matchSearch && matchCat;
    });
  }, [codes, searchQuery, activeCategory]);

  async function handleDelete(rc) {
    if (!window.confirm(`Delete reason code "${rc.label}"? This cannot be undone.`)) return;
    setDeletingId(rc.id);
    setError('');
    try {
      await api.deleteReasonCode(rc.id);
      setCodes((list) => list.filter((c) => c.id !== rc.id));
      toast.success(`Deleted reason code "${rc.label}".`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete this reason code — it may be tied to historical account logs.'));
      toast.error('Could not delete reason code.');
    } finally {
      setDeletingId('');
    }
  }

  function getCategoryClass(cat) {
    const c = (cat || '').toLowerCase();
    if (c.includes('dispute')) return 'rc-cat-dispute';
    if (c.includes('customer')) return 'rc-cat-customer';
    if (c.includes('internal')) return 'rc-cat-internal';
    if (c.includes('promise') || c.includes('ptp')) return 'rc-cat-promise';
    return 'rc-cat-default';
  }

  return (
    <div className="panel">
      <div className="panel-title-row">
        <span className="panel-title">Reason code catalog</span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>New reason code</span>
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {/* 1-Click Category Filter Chips Bar */}
      <div className="category-filter-chips">
        <button
          type="button"
          className={`cat-chip ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          <span>All categories</span>
          <span className="cat-chip-count">{codes.length}</span>
        </button>
        {categories.map((cat) => {
          const count = codes.filter((c) => (c.category || '').toLowerCase() === cat).length;
          return (
            <button
              key={cat}
              type="button"
              className={`cat-chip ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              <span style={{ textTransform: 'capitalize' }}>{cat}</span>
              <span className="cat-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Consistent Search Bar */}
      <div className="admin-filter-bar">
        <div className="admin-search-wrap">
          <Search size={14} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search code identifier or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={13} strokeWidth={2} />
            </button>
          )}
        </div>

        {searchQuery && (
          <button
            type="button"
            className="btn-quiet"
            style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setSearchQuery('')}
          >
            <RotateCcw size={12} strokeWidth={2} />
            <span>Clear search</span>
          </button>
        )}
      </div>

      {loading ? (
        <p className="empty-state">Loading reason codes…</p>
      ) : filteredCodes.length === 0 ? (
        <p className="empty-state">
          {codes.length === 0
            ? 'No reason codes configured yet.'
            : 'No reason codes match your filter criteria.'}
        </p>
      ) : (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Internal code identifier</th>
              <th>Display label</th>
              <th className="align-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredCodes.map((rc) => (
              <tr key={rc.id}>
                <td>
                  <span className={`rc-cat-badge ${getCategoryClass(rc.category)}`}>
                    {rc.category}
                  </span>
                </td>
                <td className="num">
                  <code className="code-tag">{rc.code}</code>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{rc.label}</td>
                <td className="align-right">
                  <div className="row-actions">
                    <button
                      type="button"
                      className="tbl-btn tbl-btn-secondary"
                      onClick={() => {
                        setEditing(rc);
                        setShowForm(true);
                      }}
                    >
                      <Pencil size={12} strokeWidth={2} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="tbl-btn tbl-btn-danger"
                      onClick={() => handleDelete(rc)}
                      disabled={deletingId === rc.id}
                    >
                      <Trash2 size={12} strokeWidth={2} />
                      <span>{deletingId === rc.id ? 'Deleting…' : 'Delete'}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <ReasonCodeFormModal
          reasonCode={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function ReasonCodeFormModal({ reasonCode, onClose, onSaved }) {
  const { toast } = useToast();
  const [category, setCategory] = useState(reasonCode?.category || '');
  const [code, setCode] = useState(reasonCode?.code || '');
  const [label, setLabel] = useState(reasonCode?.label || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function applyTemplate(tpl) {
    setCategory(tpl.category);
    setCode(tpl.code);
    setLabel(tpl.label);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (reasonCode) {
        await api.updateReasonCode(reasonCode.id, { category, code, label });
        toast.success(`Updated reason code "${label}".`);
      } else {
        await api.createReasonCode({ category, code, label });
        toast.success(`Created reason code "${label}".`);
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save this reason code.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={reasonCode ? 'Edit reason code' : 'New reason code'} onClose={onClose}>
      {!reasonCode && (
        <div className="template-shortcuts-wrap">
          <span className="template-shortcuts-title">
            <Sparkles size={12} />
            <span>Standard industry templates:</span>
          </span>
          <div className="template-shortcuts-list">
            {STANDARD_TEMPLATES.map((tpl) => (
              <button
                key={tpl.code}
                type="button"
                className="template-btn"
                onClick={() => applyTemplate(tpl)}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="rc-category">Category</label>
          <input
            id="rc-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. dispute, customer, internal"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="rc-code">Code identifier (unique key)</label>
          <input
            id="rc-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. customer_cashflow_issue"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="rc-label">Human-readable display label</label>
          <input
            id="rc-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Customer cash-flow issue"
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save code'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* =====================================================================
 * TAB 3: SLA Escalation Rules Management
 * ===================================================================== */
function SlaRulesPanel({ rules, loading, orgId, onRefresh }) {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [checkingSla, setCheckingSla] = useState(false);
  const [busyId, setBusyId] = useState('');

  async function handleToggleActive(r) {
    setBusyId(r.id);
    try {
      await api.updateEscalationRule(orgId, r.id, {
        agingBucket: r.agingBucket,
        escalateToRole: r.escalateToRole,
        active: !r.active,
      });
      toast.success(`Escalation rule for ${r.agingBucket} ${!r.active ? 'activated' : 'paused'}.`);
      onRefresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not update rule.'));
    } finally {
      setBusyId('');
    }
  }

  async function handleDelete(r) {
    if (!window.confirm(`Delete SLA escalation rule for aging stage ${r.agingBucket}?`)) return;
    setBusyId(r.id);
    try {
      await api.deleteEscalationRule(orgId, r.id);
      toast.success('Escalation rule deleted.');
      onRefresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not delete rule.'));
    } finally {
      setBusyId('');
    }
  }

  async function handleRunEscalationCheck() {
    setCheckingSla(true);
    try {
      const { data } = await api.runEscalationCheck();
      const count = data?.length || 0;
      toast.success(`SLA breach evaluation complete: ${count} account${count === 1 ? '' : 's'} reviewed / escalated.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not run SLA check.'));
    } finally {
      setCheckingSla(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-title-row">
        <span className="panel-title">SLA escalation rules</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRunEscalationCheck}
            disabled={checkingSla}
            title="Scan all delinquent accounts against escalation rules right now"
          >
            <Play size={12} strokeWidth={2} className={checkingSla ? 'spin-anim' : ''} />
            <span>{checkingSla ? 'Evaluating SLA…' : 'Run SLA check now'}</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingRule(null);
              setShowModal(true);
            }}
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Add SLA rule</span>
          </button>
        </div>
      </div>

      {loading ? (
        <p className="empty-state">Loading SLA rules…</p>
      ) : rules.length === 0 ? (
        <div className="admin-empty-filter">
          <p className="empty-state">No SLA escalation rules configured yet.</p>
        </div>
      ) : (
        <table className="mini-table" style={{ marginTop: '12px' }}>
          <thead>
            <tr>
              <th>Trigger aging stage</th>
              <th>Escalation destination role</th>
              <th>Rule status</th>
              <th className="align-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <AgingBadge bucket={r.agingBucket} />
                    <span style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>
                      Invoices reaching <strong>{r.agingBucket}</strong>
                    </span>
                  </div>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize' }}>
                    {(r.escalateToRole || '').replace('_', ' ')}
                  </span>
                </td>
                <td>
                  <span className={`status-pill tone-${r.active ? 'good' : 'neutral'}`}>
                    {r.active ? 'active' : 'paused'}
                  </span>
                </td>
                <td className="align-right">
                  <div className="row-actions">
                    <button
                      type="button"
                      className={`tbl-btn ${r.active ? 'tbl-btn-secondary' : 'tbl-btn-success'}`}
                      onClick={() => handleToggleActive(r)}
                      disabled={busyId === r.id}
                    >
                      <span>{busyId === r.id ? 'Updating…' : r.active ? 'Pause' : 'Activate'}</span>
                    </button>
                    <button
                      type="button"
                      className="tbl-btn tbl-btn-danger"
                      onClick={() => handleDelete(r)}
                      disabled={busyId === r.id}
                      title="Delete rule"
                    >
                      <Trash2 size={12} strokeWidth={2} />
                      <span>Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <SlaRuleModal
          rule={editingRule}
          orgId={orgId}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function SlaRuleModal({ rule, orgId, onClose, onSaved }) {
  const { toast } = useToast();
  const [agingBucket, setAgingBucket] = useState(rule?.agingBucket || '90+');
  const [escalateToRole, setEscalateToRole] = useState(rule?.escalateToRole || 'manager');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (rule) {
        await api.updateEscalationRule(orgId, rule.id, { agingBucket, escalateToRole });
        toast.success('Escalation rule updated.');
      } else {
        await api.createEscalationRule(orgId, { agingBucket, escalateToRole });
        toast.success('New SLA escalation rule created.');
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save escalation rule.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={rule ? 'Edit SLA escalation rule' : 'New SLA escalation rule'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="rule-aging">Trigger aging stage</label>
          <select id="rule-aging" value={agingBucket} onChange={(e) => setAgingBucket(e.target.value)}>
            <option value="90+">90+ days overdue (Critical delinquency)</option>
            <option value="61-90">61-90 days overdue (High risk)</option>
            <option value="31-60">31-60 days overdue (Moderate risk)</option>
            <option value="0-30">0-30 days overdue (Early follow-up)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="rule-role">Escalate to role</label>
          <select id="rule-role" value={escalateToRole} onChange={(e) => setEscalateToRole(e.target.value)}>
            <option value="manager">Manager (Executive notification & queue re-prioritization)</option>
            <option value="relationship_owner">Relationship Owner (Commercial outreach & co-actor task)</option>
            <option value="collector">Collector (Direct worklist priority assignment)</option>
          </select>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save rule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* =====================================================================
 * TAB 4: Data & Operations (CSV Import + Manual System Sweeps)
 * ===================================================================== */
function DataOperationsPanel({ orgId, onAccountsImported }) {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Sweep states
  const [runningPtp, setRunningPtp] = useState(false);
  const [ptpSweepResult, setPtpSweepResult] = useState(null);
  const [runningSla, setRunningSla] = useState(false);
  const [slaSweepResult, setSlaSweepResult] = useState(null);

  function handleDownloadTemplate() {
    const headers = 'accountName,contactEmail,contactPhone,creditTerms,ownershipMode,relationshipOwnerId,invoiceAmount,invoiceDueDate,invoiceIssuedDate\n';
    const sample1 = 'Acme Corp,ap@acme.com,+1-555-0100,NET_30,direct,,12500.00,2026-10-15,2026-09-15\n';
    const sample2 = 'Global Logistics,billing@globallogistics.com,+1-555-0199,NET_60,indirect,,8450.00,2026-10-01,2026-08-01\n';
    const blob = new Blob([headers + sample1 + sample2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accounts_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded CSV import template.');
  }

  async function handleFileSelect(e) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setImportResult(null);
    }
  }

  async function handleImportSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await api.importAccountsCsv(file);
      setImportResult(data);
      toast.success(
        `Imported ${data.accountsCreated || 0} accounts and ${data.invoicesCreated || 0} invoices!`
      );
      setFile(null);
      if (onAccountsImported) onAccountsImported();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to import CSV accounts.'));
    } finally {
      setImporting(false);
    }
  }

  async function handleRunPtpSweep() {
    setRunningPtp(true);
    setPtpSweepResult(null);
    try {
      const { data } = await api.runPtpSweep();
      const count = data?.length || 0;
      setPtpSweepResult({
        timestamp: new Date().toLocaleTimeString(),
        count,
      });
      toast.success(`PTP Sweep complete: evaluated ${count} commitments.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not run PTP sweep.'));
    } finally {
      setRunningPtp(false);
    }
  }

  async function handleRunSlaCheck() {
    setRunningSla(true);
    setSlaSweepResult(null);
    try {
      const { data } = await api.runEscalationCheck();
      const count = data?.length || 0;
      setSlaSweepResult({
        timestamp: new Date().toLocaleTimeString(),
        count,
      });
      toast.success(`SLA Check complete: evaluated ${count} accounts.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not run SLA check.'));
    } finally {
      setRunningSla(false);
    }
  }

  return (
    <div className="data-operations-container">
      {/* 1. Account Roster CSV Importer */}
      <div className="panel" style={{ margin: 0 }}>
        <div className="panel-title-row">
          <span className="panel-title">Batch account import</span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDownloadTemplate}
            title="Download formatted CSV template"
          >
            <Download size={13} strokeWidth={2} />
            <span>Download CSV template</span>
          </button>
        </div>

        <div className="csv-import-box">
          <form onSubmit={handleImportSubmit}>
            <div className="csv-dropzone">
              <UploadCloud size={30} strokeWidth={1.8} color="var(--accent)" />
              <div className="csv-dropzone-text">
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                  {file ? file.name : 'Select or drop CSV file'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB ready for import`
                    : 'Upload account portfolio and invoice lines (.csv)'}
                </span>
              </div>
              <label className="btn btn-secondary csv-browse-label">
                <span>Browse file</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!file || importing}
              >
                {importing ? <RotateCw size={13} className="spin-anim" /> : <UploadCloud size={13} />}
                <span>{importing ? 'Importing…' : 'Import accounts'}</span>
              </button>
            </div>
          </form>

          {importResult && (
            <div className="import-result-card">
              <div className="import-result-header">
                <CheckCircle2 size={18} color="var(--success-strong)" />
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Import summary</span>
              </div>
              <div className="import-stats-row">
                <div className="import-stat-item">
                  <span className="import-stat-val num">{importResult.accountsCreated || 0}</span>
                  <span className="import-stat-lbl">New accounts created</span>
                </div>
                <div className="import-stat-item">
                  <span className="import-stat-val num">{importResult.invoicesCreated || 0}</span>
                  <span className="import-stat-lbl">Invoices imported</span>
                </div>
                <div className="import-stat-item">
                  <span className="import-stat-val num">{importResult.accountsReused || 0}</span>
                  <span className="import-stat-lbl">Existing accounts linked</span>
                </div>
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="import-errors-box">
                  <span style={{ fontWeight: 600, color: 'var(--danger-strong)', fontSize: '12px' }}>
                    {importResult.errors.length} skipped row(s):
                  </span>
                  <ul className="import-error-list">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Automated System Sweeps */}
      <div className="panel" style={{ margin: 0 }}>
        <div className="panel-title-row">
          <span className="panel-title">System sweeps</span>
        </div>

        <div className="system-sweeps-grid">
          {/* Sweep 1: PTP Sweep */}
          <div className="sweep-card">
            <div className="sweep-card-head">
              <div className="sweep-icon-wrap" style={{ background: 'var(--accent-tint)' }}>
                <Clock size={18} color="var(--accent)" />
              </div>
              <div>
                <span className="sweep-title">PTP commitment sweep</span>
                <span className="sweep-desc">
                  Reconciles open promises against recorded payments to update statuses.
                </span>
              </div>
            </div>
            <div className="sweep-footer">
              <span className="sweep-last-run">
                {ptpSweepResult
                  ? `Last run: ${ptpSweepResult.timestamp} (${ptpSweepResult.count} updated)`
                  : 'Not run recently'}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRunPtpSweep}
                disabled={runningPtp}
              >
                <Play size={12} strokeWidth={2} className={runningPtp ? 'spin-anim' : ''} />
                <span>{runningPtp ? 'Running…' : 'Run sweep'}</span>
              </button>
            </div>
          </div>

          {/* Sweep 2: SLA Escalation Sweep */}
          <div className="sweep-card">
            <div className="sweep-card-head">
              <div className="sweep-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
                <AlertTriangle size={18} color="#dc2626" />
              </div>
              <div>
                <span className="sweep-title">SLA escalation check</span>
                <span className="sweep-desc">
                  Checks overdue accounts against active SLA rules to dispatch tasks or alerts.
                </span>
              </div>
            </div>
            <div className="sweep-footer">
              <span className="sweep-last-run">
                {slaSweepResult
                  ? `Last run: ${slaSweepResult.timestamp} (${slaSweepResult.count} evaluated)`
                  : 'Not run recently'}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRunSlaCheck}
                disabled={runningSla}
              >
                <Play size={12} strokeWidth={2} className={runningSla ? 'spin-anim' : ''} />
                <span>{runningSla ? 'Checking…' : 'Run check'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
