import { useCallback, useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail,
  Phone,
  Clock,
  AlertCircle,
  MessageSquare,
  Search,
  X,
  ChevronDown,
  Check,
  CheckCircle2,
  Building2,
  UserCheck,
  Eye,
  RotateCw,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useToast } from '../../context/ToastContext';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import StatusPill from '../../components/StatusPill';
import Modal from '../../components/Modal';
import './CoActorTasks.css';

const dt = (v) => (v ? new Date(v).toLocaleString() : '—');

function formatRelativeTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getRequestTypeConfig(type = '') {
  const t = (type || '').toLowerCase();
  if (t.includes('call') || t.includes('phone')) {
    return { label: type.replace(/_/g, ' '), icon: Phone, colorClass: 'badge-type-call' };
  }
  if (t.includes('email') || t.includes('mail')) {
    return { label: type.replace(/_/g, ' '), icon: Mail, colorClass: 'badge-type-email' };
  }
  if (t.includes('dispute')) {
    return { label: type.replace(/_/g, ' '), icon: AlertCircle, colorClass: 'badge-type-dispute' };
  }
  if (t.includes('ptp') || t.includes('payment') || t.includes('promise')) {
    return { label: type.replace(/_/g, ' '), icon: Clock, colorClass: 'badge-type-payment' };
  }
  return { label: type.replace(/_/g, ' '), icon: MessageSquare, colorClass: 'badge-type-general' };
}

const QUICK_OUTCOME_CHIPS = [
  'Spoke with AP — payment scheduled',
  'Left voicemail with billing manager',
  'Customer requested invoice copies',
  'Customer disputed charges — escalated',
  'Promise-to-pay arranged',
  'Account contact verified and updated',
];

export default function CoActorTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManager = user?.role === 'manager';
  const isCollector = user?.role === 'collector';

  const [scope, setScope] = useState(() => (user?.role === 'manager' || user?.role === 'collector' ? 'all' : 'me')); // 'me' | 'all'
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reassigningTask, setReassigningTask] = useState(null);

  useEffect(() => {
    if (user?.role === 'manager' || user?.role === 'collector') {
      setScope('all');
    }
  }, [user?.role]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusTab, setStatusTab] = useState('pending'); // 'pending' | 'done' | 'all'

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.getCoActorTasks(scope);
      setTasks(data || []);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load tasks.'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isManager) {
      api
        .listUsers()
        .then(({ data }) => setUsers((data || []).filter((u) => u.active)))
        .catch(() => {});
    }
  }, [isManager]);

  const requestTypes = useMemo(() => {
    const set = new Set();
    tasks.forEach((t) => {
      if (t.requestType) set.add(t.requestType);
    });
    return Array.from(set).sort();
  }, [tasks]);

  const totalPending = useMemo(() => tasks.filter((t) => t.status !== 'done').length, [tasks]);
  const totalDone = useMemo(() => tasks.filter((t) => t.status === 'done').length, [tasks]);
  const totalAll = tasks.length;

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusTab === 'pending' && t.status === 'done') return false;
      if (statusTab === 'done' && t.status !== 'done') return false;

      if (typeFilter && t.requestType !== typeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const acc = (t.accountName || '').toLowerCase();
        const notes = (t.notes || '').toLowerCase();
        const outcome = (t.outcomeNotes || '').toLowerCase();
        const assignee = (t.assignedToName || '').toLowerCase();
        const requester = (t.requestedByName || '').toLowerCase();
        const typeStr = (t.requestType || '').toLowerCase();
        const accId = String(t.accountId || '');
        if (
          !acc.includes(q) &&
          !notes.includes(q) &&
          !outcome.includes(q) &&
          !assignee.includes(q) &&
          !requester.includes(q) &&
          !typeStr.includes(q) &&
          !accId.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, statusTab, typeFilter, searchQuery]);

  return (
    <div>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <h1 className="page-title">Outreach requests</h1>
        {(isManager || isCollector) && (
          <div className="task-scope-toggle" role="tablist" aria-label="Task scope filter">
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'me'}
              className={`btn-toggle${scope === 'me' ? ' is-active' : ''}`}
              onClick={() => setScope('me')}
            >
              My tasks
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'all'}
              className={`btn-toggle${scope === 'all' ? ' is-active' : ''}`}
              onClick={() => setScope('all')}
            >
              Team tasks
            </button>
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {/* Search & Filter Controls Bar */}
      <div className="tasks-filter-bar">
        <div className="tasks-status-tabs" role="tablist" aria-label="Filter tasks by status">
          <button
            type="button"
            role="tab"
            aria-selected={statusTab === 'pending'}
            className={`tasks-status-tab${statusTab === 'pending' ? ' active' : ''}`}
            onClick={() => setStatusTab('pending')}
          >
            <span>Open</span>
            <span className="tab-pill">{totalPending}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusTab === 'done'}
            className={`tasks-status-tab${statusTab === 'done' ? ' active' : ''}`}
            onClick={() => setStatusTab('done')}
          >
            <span>Completed</span>
            <span className="tab-pill">{totalDone}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusTab === 'all'}
            className={`tasks-status-tab${statusTab === 'all' ? ' active' : ''}`}
            onClick={() => setStatusTab('all')}
          >
            <span>All</span>
            <span className="tab-pill">{totalAll}</span>
          </button>
        </div>

        <div className="tasks-search-row">
          <div className="tasks-search-wrap">
            <Search size={14} className="search-icon" aria-hidden="true" />
            <input
              type="text"
              className="tasks-search-input"
              placeholder="Search account, notes, assignee, or requester…"
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

          {requestTypes.length > 0 && (
            <label className="tasks-filter-label">
              Type
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="tasks-filter-select"
              >
                <option value="">All types</option>
                {requestTypes.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(searchQuery || typeFilter) && (
            <button
              type="button"
              className="btn-quiet"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('');
              }}
              style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <X size={12} strokeWidth={2} />
              <span>Clear</span>
            </button>
          )}

          <button
            type="button"
            className="btn-quiet"
            onClick={load}
            title="Refresh tasks"
            aria-label="Refresh tasks"
            style={{ padding: '6px 8px' }}
          >
            <RotateCw size={14} strokeWidth={2} className={loading ? 'spin-anim' : ''} />
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: '20px 22px' }}>
        <div className="panel-title-row" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="panel-title" style={{ margin: 0 }}>
              {statusTab === 'pending'
                ? 'Open outreach requests'
                : statusTab === 'done'
                ? 'Completed outreach requests'
                : 'All outreach requests'}
            </span>
            <span className="badge badge-neutral">{filteredTasks.length} shown</span>
          </div>
        </div>

        {loading ? (
          <p className="empty-state">Loading outreach tasks…</p>
        ) : filteredTasks.length === 0 ? (
          <div className="tasks-empty-state">
            <div className="empty-icon-wrap">
              {searchQuery || typeFilter ? (
                <Search size={24} strokeWidth={1.8} />
              ) : statusTab === 'pending' ? (
                <CheckCircle2 size={24} strokeWidth={1.8} />
              ) : (
                <Clock size={24} strokeWidth={1.8} />
              )}
            </div>
            <h4>
              {searchQuery || typeFilter
                ? 'No matching requests'
                : statusTab === 'pending'
                ? "You're all caught up!"
                : 'No completed tasks yet'}
            </h4>
            <p>
              {searchQuery || typeFilter
                ? 'Try adjusting your search query or filter selection.'
                : statusTab === 'pending'
                ? 'No pending outreach requests in this view.'
                : 'Tasks marked as completed will appear here.'}
            </p>
            {(searchQuery || typeFilter) && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('');
                }}
                style={{ marginTop: 10 }}
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="task-list">
            {filteredTasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onUpdated={load}
                isManager={isManager}
                currentUser={user}
                onReassignClick={() => setReassigningTask(t)}
              />
            ))}
          </div>
        )}
      </div>

      {reassigningTask && (
        <ReassignModal
          task={reassigningTask}
          users={users}
          onClose={() => setReassigningTask(null)}
          onSuccess={() => {
            setReassigningTask(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function TaskRow({ task, onUpdated, isManager, onReassignClick, currentUser }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [outcomeNotes, setOutcomeNotes] = useState(task.outcomeNotes || '');
  const [recordPtp, setRecordPtp] = useState(false);
  const [ptpAmount, setPtpAmount] = useState('');
  const [ptpDate, setPtpDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const typeConfig = getRequestTypeConfig(task.requestType);
  const TypeIcon = typeConfig.icon;
  const isDone = task.status === 'done';

  const currentUserId = currentUser?.userId ?? currentUser?.id;
  const isCollector = currentUser?.role === 'collector';
  const isAssignedOwner = currentUser?.role === 'relationship_owner' && Number(task.assignedTo) === Number(currentUserId);
  const canResolve = !isDone && (isManager || isAssignedOwner);

  async function markDone(e) {
    if (e) e.preventDefault();
    if (!outcomeNotes.trim()) {
      setError('Please provide outcome notes to complete the outreach task.');
      return;
    }
    if (recordPtp) {
      if (!ptpAmount || Number(ptpAmount) <= 0) {
        setError('Please enter a valid promised payment amount.');
        return;
      }
      if (!ptpDate) {
        setError('Please enter a promised payment date.');
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      if (recordPtp) {
        await api.createPtp(task.accountId, {
          promisedAmount: Number(ptpAmount),
          promisedDate: ptpDate,
        });
      }
      await api.updateCoActorTask(task.id, { status: 'done', outcomeNotes });
      toast.success(
        recordPtp
          ? `Task completed and PTP of $${Number(ptpAmount).toLocaleString()} recorded for "${task.accountName || 'Account #' + task.accountId}".`
          : `Task for "${task.accountName || 'Account #' + task.accountId}" marked as completed.`
      );
      onUpdated();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update this task.'));
      toast.error(apiErrorMessage(err, 'Could not update this task.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`task-row${isDone ? ' is-done' : ''}${expanded ? ' is-expanded' : ''}`}>
      <div
        className="task-row-top"
        onClick={() => !isDone && setExpanded((v) => !v)}
        title={!isDone ? (expanded ? 'Click to collapse details' : 'Click to record outcome or view details') : undefined}
      >
        <div className="task-row-main-info">
          <div className="task-row-header-line">
            <Link
              to={`/accounts/${task.accountId}`}
              className="task-account-link"
              onClick={(e) => e.stopPropagation()}
              title="View account profile"
            >
              <Building2 size={14} className="task-account-icon" aria-hidden="true" />
              <span>{task.accountName || `Account #${task.accountId}`}</span>
            </Link>

            <span className={`task-request-type-badge ${typeConfig.colorClass}`}>
              <TypeIcon size={12} strokeWidth={2.2} aria-hidden="true" />
              <span>{typeConfig.label}</span>
            </span>

            {task.creditHold && (
              <span className="hold-flag" style={{ fontSize: '10.5px' }}>credit hold</span>
            )}
          </div>

          <div className="task-row-badges-line">
            {task.assignedToName && (
              <span className="task-person-badge" title={`Assigned to ${task.assignedToName}`}>
                <UserCheck size={12} strokeWidth={2} aria-hidden="true" />
                <span>Assigned: <strong>{task.assignedToName}</strong> {task.assignedToRole ? `(${task.assignedToRole.replace('_', ' ')})` : ''}</span>
              </span>
            )}
            {task.requestedByName && (
              <span className="task-person-badge" title={`Outreach requested by ${task.requestedByName}`}>
                <Mail size={12} strokeWidth={2} aria-hidden="true" />
                <span>Requested by: <strong>{task.requestedByName}</strong> {task.requestedByRole ? `(${task.requestedByRole.replace('_', ' ')})` : ''}</span>
              </span>
            )}
            {(task.contactPhone || task.contactEmail) && (
              <span className="task-contact-meta">
                {task.contactPhone && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={12} strokeWidth={2} aria-hidden="true" />
                    <span>{task.contactPhone}</span>
                  </span>
                )}
                {task.contactPhone && task.contactEmail && <span>·</span>}
                {task.contactEmail && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Mail size={12} strokeWidth={2} aria-hidden="true" />
                    <span>{task.contactEmail}</span>
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="task-row-meta" onClick={(e) => e.stopPropagation()}>
          <span className="task-created-time" title={`Created: ${dt(task.createdAt)}`}>
            <Clock size={12} strokeWidth={2} aria-hidden="true" />
            <span>{formatRelativeTime(task.createdAt)}</span>
          </span>

          <StatusPill value={task.status} />

          <div className="row-actions">
            {isManager && !isDone && (
              <button
                type="button"
                className="tbl-btn tbl-btn-secondary"
                onClick={onReassignClick}
                title="Reassign to another team member"
              >
                <UserCheck size={12} strokeWidth={2} />
                <span>Reassign</span>
              </button>
            )}

            <Link
              to={`/accounts/${task.accountId}`}
              className="tbl-btn tbl-btn-secondary"
              title="Open full account profile"
            >
              <Eye size={12} strokeWidth={2} />
              <span>Account</span>
            </Link>

            {!isDone && canResolve && (
              <button
                type="button"
                className={`tbl-btn ${expanded ? 'tbl-btn-primary' : 'tbl-btn-secondary'}`}
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? 'Collapse resolution notes' : 'Record outcome and complete'}
              >
                <Check size={12} strokeWidth={2.5} />
                <span>{expanded ? 'Resolving…' : 'Resolve'}</span>
                <ChevronDown
                  size={12}
                  strokeWidth={2.5}
                  className={`expand-chevron ${expanded ? 'rotate-180' : ''}`}
                />
              </button>
            )}

            {!isDone && !canResolve && (
              <>
                {isCollector && (
                  <span className="task-collector-pending-badge" title="This request is pending action from the assigned relationship owner">
                    Awaiting owner
                  </span>
                )}
                <button
                  type="button"
                  className="tbl-btn tbl-btn-secondary"
                  onClick={() => setExpanded((v) => !v)}
                  title={expanded ? 'Hide details' : 'View details'}
                >
                  <span>{expanded ? 'Hide' : 'Details'}</span>
                  <ChevronDown
                    size={12}
                    strokeWidth={2.5}
                    className={`expand-chevron ${expanded ? 'rotate-180' : ''}`}
                  />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {task.notes && (
        <div className="task-notes-block">
          <span className="task-notes-label">Request notes</span>
          <p className="task-notes-content">{task.notes}</p>
        </div>
      )}

      {/* Outcome resolution form (Restricted strictly to assigned relationship owner and managers) */}
      {expanded && !isDone && canResolve && (
        <form onSubmit={markDone} className="task-outcome-form">
          <div className="outcome-quick-strip">
            <span className="outcome-strip-title">1-Click Outcome Dispositions:</span>
            <div className="outcome-chips">
              {QUICK_OUTCOME_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="outcome-chip-btn"
                  onClick={() => {
                    setOutcomeNotes((prev) =>
                      prev ? `${prev.trim().replace(/\.?$/, '.')}\n${chip}` : chip
                    );
                    if (chip.toLowerCase().includes('promise-to-pay') || chip.toLowerCase().includes('payment scheduled')) {
                      setRecordPtp(true);
                    }
                  }}
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor={`outcome-${task.id}`}>Outcome resolution notes</label>
            <textarea
              id={`outcome-${task.id}`}
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              placeholder="What happened during your outreach? Type notes or choose 1-click outcome chips above…"
              rows={3}
              required
            />
          </div>

          <div
            className="ptp-record-block"
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              background: 'var(--surface-sunken)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '13px',
              }}
            >
              <input
                type="checkbox"
                checked={recordPtp}
                onChange={(e) => setRecordPtp(e.target.checked)}
              />
              <span>Record Promise-to-Pay (PTP) commitment from this outreach</span>
            </label>

            {recordPtp && (
              <div style={{ display: 'flex', gap: '12px', marginTop: 10 }}>
                <div className="field" style={{ flex: 1, margin: 0 }}>
                  <label htmlFor={`ptp-amount-${task.id}`} style={{ fontSize: '12px' }}>
                    Promised Amount ($)
                  </label>
                  <input
                    id={`ptp-amount-${task.id}`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="e.g. 500.00"
                    value={ptpAmount}
                    onChange={(e) => setPtpAmount(e.target.value)}
                    required={recordPtp}
                  />
                </div>
                <div className="field" style={{ flex: 1, margin: 0 }}>
                  <label htmlFor={`ptp-date-${task.id}`} style={{ fontSize: '12px' }}>
                    Promised Date
                  </label>
                  <input
                    id={`ptp-date-${task.id}`}
                    type="date"
                    value={ptpDate}
                    onChange={(e) => setPtpDate(e.target.value)}
                    required={recordPtp}
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="modal-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setExpanded(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !outcomeNotes.trim()}
            >
              <Check size={13} strokeWidth={2.5} />
              <span>{busy ? 'Saving…' : 'Complete outreach task'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Read-only view for collectors and non-assigned staff */}
      {expanded && !isDone && !canResolve && (
        <div className="task-collector-readonly-card">
          <div className="task-readonly-info-row">
            <span className="task-readonly-label">Assigned Relationship Owner:</span>
            <strong>{task.assignedToName || 'Relationship owner'} {task.assignedToRole ? `(${task.assignedToRole.replace('_', ' ')})` : ''}</strong>
          </div>
          {task.requestedByName && (
            <div className="task-readonly-info-row">
              <span className="task-readonly-label">Requested by:</span>
              <span>{task.requestedByName} {task.requestedByRole ? `(${task.requestedByRole.replace('_', ' ')})` : ''}</span>
            </div>
          )}
          <div className="task-readonly-info-row">
            <span className="task-readonly-label">Status:</span>
            <span style={{ color: 'var(--ink-soft)' }}>
              Awaiting relationship owner outreach. Only the assigned owner (or manager) can record diplomatic contact and resolve this task.
            </span>
          </div>
        </div>
      )}

      {/* Completed outcome view */}
      {isDone && task.outcomeNotes && (
        <div className="task-outcome-done-box">
          <div className="outcome-done-head">
            <CheckCircle2 size={13} strokeWidth={2.5} />
            <span>Resolution Outcome</span>
          </div>
          <p className="task-outcome-readonly">{task.outcomeNotes}</p>
        </div>
      )}
    </div>
  );
}

function ReassignModal({ task, users = [], onClose, onSuccess }) {
  const { toast } = useToast();
  const eligibleAssignees = useMemo(
    () => users.filter((u) => u.role === 'relationship_owner'),
    [users]
  );
  const [targetUserId, setTargetUserId] = useState(
    task.assignedTo || (eligibleAssignees[0]?.id ?? '')
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!targetUserId) {
      setError('Please select an eligible relationship owner');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.reassignCoActorTask(task.id, targetUserId);
      const targetUser = users.find((u) => String(u.id) === String(targetUserId));
      toast.success(`Task reassigned to ${targetUser?.name || 'team member'}.`);
      onSuccess();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reassign this task.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Reassign Task #${task.id}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: '14px' }}>
          Account: <strong>{task.accountName || `#${task.accountId}`}</strong> &bull; Request: <strong>{task.requestType?.replace(/_/g, ' ')}</strong>
        </p>

        <div className="field">
          <label htmlFor="reassign-select">Select Assignee (Relationship Owner)</label>
          <select
            id="reassign-select"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="tasks-filter-select"
            style={{ width: '100%' }}
          >
            {eligibleAssignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role.replace('_', ' ')}) - {u.email}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Reassigning…' : 'Confirm Reassignment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
