import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Building2, ShieldCheck } from 'lucide-react';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import './PlatformAdmin.css';

export default function PlatformActivity() {
  const navigate = useNavigate();
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [actionFilter, setActionFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.getPlatformGlobalActivity();
      setActivity(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load activity logs.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredActivity = useMemo(() => {
    return activity.filter((entry) => {
      if (actionFilter !== 'all') {
        if (actionFilter === 'org_mutations') {
          if (!entry.action.startsWith('ORG_')) return false;
        } else if (actionFilter === 'manager_events') {
          if (!entry.action.startsWith('MANAGER_')) return false;
        } else if (actionFilter === 'admin_events') {
          if (!entry.action.startsWith('PLATFORM_ADMIN_')) return false;
        } else if (entry.action !== actionFilter) {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const orgName = (entry.targetOrgName || '').toLowerCase();
        const actor = (entry.actorName || '' + entry.actorEmail || '').toLowerCase();
        const action = (entry.action || '').toLowerCase();
        if (!orgName.includes(term) && !actor.includes(term) && !action.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [activity, actionFilter, searchTerm]);

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Log</h1>
          <p className="page-subtitle">Unified cross-tenant audit trail of all platform actions and status updates</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title-row">
          <div className="panel-title-group">
            <span className="panel-title">Audit History</span>
            <span className="badge badge-neutral">{filteredActivity.length} events</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="platform-toolbar">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="platform-search-input"
              placeholder="Search by tenant, actor, or action…"
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
              <label htmlFor="action-filter" className="platform-filter-label">Filter action:</label>
              <select
                id="action-filter"
                className="platform-select"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="all">All actions</option>
                <option value="org_mutations">All Organization changes</option>
                <option value="ORG_CREATED">Org Created</option>
                <option value="ORG_EDITED">Org Renamed</option>
                <option value="ORG_DEACTIVATED">Org Deactivated</option>
                <option value="ORG_ACTIVATED">Org Reactivated</option>
                <option value="manager_events">Manager events</option>
                <option value="admin_events">Platform Admin events</option>
              </select>
            </div>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        {loading ? (
          <p className="empty-state">Loading activity log…</p>
        ) : filteredActivity.length === 0 ? (
          <p className="empty-state">
            {activity.length === 0 ? 'No activity logged yet.' : 'No audit entries match your filters.'}
          </p>
        ) : (
          <div className="activity-timeline">
            {filteredActivity.map((entry) => (
              <ActivityTimelineItem
                key={entry.id}
                entry={entry}
                formatDateTime={formatDateTime}
                onNavigateOrg={(orgId) => navigate(`/platform-admin/orgs/${orgId}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityTimelineItem({ entry, formatDateTime, onNavigateOrg }) {
  const actionLabels = {
    ORG_CREATED: { label: 'Org Created', class: 'badge-action-create' },
    ORG_EDITED: { label: 'Org Renamed', class: 'badge-action-edit' },
    ORG_DEACTIVATED: { label: 'Org Deactivated', class: 'badge-action-danger' },
    ORG_ACTIVATED: { label: 'Org Reactivated', class: 'badge-action-success' },
    MANAGER_ADDED: { label: 'Manager Added', class: 'badge-action-manager' },
    MANAGER_PASSWORD_RESET: { label: 'Password Reset', class: 'badge-action-reset' },
    PLATFORM_ADMIN_ADDED: { label: 'Admin Added', class: 'badge-action-admin' },
    PLATFORM_ADMIN_STATUS_CHANGED: { label: 'Admin Status', class: 'badge-action-edit' },
    PLATFORM_ADMIN_PASSWORD_RESET: { label: 'Admin Reset', class: 'badge-action-reset' },
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
        Renamed from <em>"{before.name}"</em> → <strong>"{after.name}"</strong>
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
        Issued temporary password for <strong>{after.email}</strong>
      </span>
    );
  } else if (entry.action === 'PLATFORM_ADMIN_ADDED' && after) {
    details = (
      <span className="diff-text">
        Added platform admin <strong>{after.name || after.email}</strong> ({after.email})
      </span>
    );
  } else if (entry.action === 'PLATFORM_ADMIN_STATUS_CHANGED' && after != null) {
    details = (
      <span className="diff-text">
        Set platform admin status to <strong>{after.active ? 'Active' : 'Inactive'}</strong>
      </span>
    );
  } else if (entry.action === 'PLATFORM_ADMIN_PASSWORD_RESET' && after) {
    details = (
      <span className="diff-text">
        Reset temporary password for platform admin <strong>{after.email}</strong>
      </span>
    );
  }

  return (
    <div className="activity-item">
      <div className="activity-item-left">
        <span className={`activity-action-badge ${actionMeta.class}`}>{actionMeta.label}</span>
        {entry.targetOrgId > 0 ? (
          <button
            type="button"
            className="target-org-badge"
            onClick={() => onNavigateOrg(entry.targetOrgId)}
            title="View organization details"
          >
            <Building2 size={13} strokeWidth={2} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '5px' }} aria-hidden="true" />
            <span>{entry.targetOrgName || `Org #${entry.targetOrgId}`}</span>
          </button>
        ) : (
          <span className="system-platform-badge">
            <ShieldCheck size={13} strokeWidth={2} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} aria-hidden="true" />
            <span>Platform</span>
          </span>
        )}
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
