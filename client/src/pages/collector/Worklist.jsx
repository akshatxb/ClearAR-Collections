import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Eye, ArrowRight, UserCheck, UserX, Users, Shuffle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useToast } from '../../context/ToastContext';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import AgingBadge from '../../components/AgingBadge';
import Modal from '../../components/Modal';
import './Worklist.css';

const AGING_OPTIONS = ['', 'current', '0-30', '31-60', '61-90', '90+'];
const OWNERSHIP_OPTIONS = ['', 'direct', 'indirect'];

const money = (v) =>
  Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function Worklist() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlBucket = searchParams.get('agingBucket') || '';
  const urlOwnership = searchParams.get('ownershipMode') || '';
  const urlAssignedTo = searchParams.get('assignedTo') || '';
  const urlCollectorId = searchParams.get('collectorId') || '';
  const urlUnassigned = searchParams.get('unassigned') === 'true';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [staffUsers, setStaffUsers] = useState([]);
  const [filters, setFilters] = useState(() => ({
    agingBucket: urlBucket,
    ownershipMode: urlOwnership,
    assignedTo: urlAssignedTo,
    collectorId: urlCollectorId,
    unassignedOnly: urlUnassigned,
    mine: user?.role === 'relationship_owner' || user?.role === 'collector',
  }));
  const [showCreate, setShowCreate] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [showAssignCollector, setShowAssignCollector] = useState(false);
  const [showAutoDistribute, setShowAutoDistribute] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showOwnershipMode, setShowOwnershipMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'priorityScore', direction: 'desc' });

  // Default to assigned portfolio only for relationship owners and collectors
  useEffect(() => {
    if (user?.role === 'relationship_owner' || user?.role === 'collector') {
      setFilters((f) => ({ ...f, mine: true }));
    }
  }, [user?.role]);

  // Load active staff members for assigned-to filtering, owner display, and reassignment
  useEffect(() => {
    if (user?.role && ['manager', 'collector', 'relationship_owner'].includes(user.role)) {
      api.listUsers()
        .then(({ data }) => setStaffUsers((data || []).filter((u) => u.active)))
        .catch(() => {});
    }
  }, [user?.role]);

  const staffMap = useMemo(() => {
    const map = new Map();
    staffUsers.forEach((u) => {
      map.set(u.id, u.name || u.email);
    });
    return map;
  }, [staffUsers]);

  const relationshipOwners = useMemo(
    () => staffUsers.filter((u) => u.role === 'relationship_owner'),
    [staffUsers]
  );

  const collectors = useMemo(
    () => staffUsers.filter((u) => u.role === 'collector'),
    [staffUsers]
  );

  // Sync state if URL search params change
  useEffect(() => {
    const b = searchParams.get('agingBucket') || '';
    const o = searchParams.get('ownershipMode') || '';
    const a = searchParams.get('assignedTo') || '';
    const c = searchParams.get('collectorId') || '';
    const u = searchParams.get('unassigned') === 'true';
    setFilters((prev) => {
      if (
        prev.agingBucket === b &&
        prev.ownershipMode === o &&
        prev.assignedTo === a &&
        prev.collectorId === c &&
        prev.unassignedOnly === u
      ) {
        return prev;
      }
      return {
        ...prev,
        agingBucket: b,
        ownershipMode: o,
        assignedTo: a,
        collectorId: c,
        unassignedOnly: u,
      };
    });
  }, [searchParams]);

  function handleFilterChange(key, val) {
    const next = { ...filters, [key]: val };
    if (key === 'unassignedOnly' && val) {
      next.collectorId = '';
      next.mine = false;
    }
    if (key === 'collectorId' && val) {
      next.unassignedOnly = false;
      next.mine = false;
    }
    if (key === 'mine' && val) {
      next.unassignedOnly = false;
      next.collectorId = '';
      next.assignedTo = '';
    }
    setFilters(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next.agingBucket) nextParams.set('agingBucket', next.agingBucket);
    else nextParams.delete('agingBucket');
    if (next.ownershipMode) nextParams.set('ownershipMode', next.ownershipMode);
    else nextParams.delete('ownershipMode');
    if (next.assignedTo) nextParams.set('assignedTo', next.assignedTo);
    else nextParams.delete('assignedTo');
    if (next.collectorId) nextParams.set('collectorId', next.collectorId);
    else nextParams.delete('collectorId');
    if (next.unassignedOnly) nextParams.set('unassigned', 'true');
    else nextParams.delete('unassigned');
    setSearchParams(nextParams, { replace: true });
  }

  function handleClearFilters() {
    setFilters({
      agingBucket: '',
      ownershipMode: '',
      assignedTo: '',
      collectorId: '',
      unassignedOnly: false,
      mine: user?.role === 'relationship_owner' || user?.role === 'collector',
    });
    setSearchQuery('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('agingBucket');
    nextParams.delete('ownershipMode');
    nextParams.delete('assignedTo');
    nextParams.delete('collectorId');
    nextParams.delete('unassigned');
    setSearchParams(nextParams, { replace: true });
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.agingBucket) params.agingBucket = filters.agingBucket;
      if (filters.ownershipMode) params.ownershipMode = filters.ownershipMode;
      if (filters.unassignedOnly) params.unassigned = true;
      if (filters.collectorId) params.collectorId = filters.collectorId;
      if (user?.role === 'collector') {
        params.collectorId = user.userId || user.id;
        delete params.unassigned;
        delete params.assignedTo;
      } else if (filters.mine && user?.userId) {
        if (user.role === 'relationship_owner') {
          params.assignedTo = user.userId;
        } else {
          params.assignedTo = user.userId;
        }
      }
      const { data } = await api.getWorklist(params);
      setRows(data);
      setSelected(new Set());
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the worklist.'));
    } finally {
      setLoading(false);
    }
  }, [filters, user]);

  useEffect(() => {
    load();
  }, [load]);

  // Queue Triage KPI calculations
  const triage = useMemo(() => {
    let brokenPtps = 0;
    let pendingPtps = 0;
    let highAging = 0;
    let creditHolds = 0;
    let unassigned = 0;
    let totalBal = 0;

    rows.forEach((r) => {
      if (r.hasBrokenPtp) brokenPtps++;
      if (r.hasPendingPtp) pendingPtps++;
      if (r.agingBucket === '61-90' || r.agingBucket === '90+') highAging++;
      if (r.creditHold) creditHolds++;
      if (r.ownershipMode === 'direct' && !r.assignedCollectorId) unassigned++;
      totalBal += Number(r.openBalance || 0);
    });

    return { brokenPtps, pendingPtps, highAging, creditHolds, unassigned, totalBal };
  }, [rows]);

  // Client-side search and column sorting
  const processedRows = useMemo(() => {
    let list = [...rows];
    if (user?.role === 'collector') {
      const myId = Number(user.userId || user.id);
      list = list.filter((r) => r.assignedCollectorId && Number(r.assignedCollectorId) === myId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.contactEmail && r.contactEmail.toLowerCase().includes(q)) ||
        (r.contactPhone && r.contactPhone.toLowerCase().includes(q)) ||
        (r.creditTerms && r.creditTerms.toLowerCase().includes(q))
      );
    }

    if (sortConfig.key) {
      list.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (sortConfig.key === 'openBalance' || sortConfig.key === 'priorityScore') {
          valA = Number(valA || 0);
          valB = Number(valB || 0);
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }
        if (sortConfig.key === 'name') {
          valA = (valA || '').toLowerCase();
          valB = (valB || '').toLowerCase();
          return sortConfig.direction === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        if (sortConfig.key === 'agingBucket') {
          const order = { '90+': 5, '61-90': 4, '31-60': 3, '0-30': 2, 'current': 1 };
          const rankA = order[valA] || 0;
          const rankB = order[valB] || 0;
          return sortConfig.direction === 'asc' ? rankA - rankB : rankB - rankA;
        }
        return 0;
      });
    }
    return list;
  }, [rows, searchQuery, sortConfig]);

  function handleSort(key) {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: key === 'name' ? 'asc' : 'desc' };
    });
  }

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === processedRows.length ? new Set() : new Set(processedRows.map((r) => r.id))
    );
  }

  async function handleBulkReminder() {
    setBulkBusy(true);
    try {
      const { data } = await api.bulkReminder(Array.from(selected));
      const sent = data.filter((r) => r.status === 'reminder_sent').length;
      toast.success(`Sent ${sent} of ${data.length} reminder${data.length === 1 ? '' : 's'}.`);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send bulk reminders.'));
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleSweep() {
    setSweeping(true);
    try {
      const { data } = await api.runPtpSweep();
      toast.success(
        data.length === 0
          ? 'No overdue promises-to-pay found.'
          : `Flagged ${data.length} overdue promise${data.length === 1 ? '' : 's'} as broken.`
      );
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not run the PTP sweep.'));
    } finally {
      setSweeping(false);
    }
  }

  const totalOpen = rows.reduce((sum, r) => sum + Number(r.openBalance || 0), 0);

  function handleExportCsv() {
    if (!processedRows || processedRows.length === 0) return;
    const headers = ['Account ID', 'Name', 'Score', 'Open Balance', 'Aging Bucket', 'Ownership Mode', 'Contact Email', 'Contact Phone', 'Credit Terms', 'Credit Hold', 'Broken PTP'];
    const csvRows = [headers.join(',')];
    processedRows.forEach((r) => {
      const vals = [
        r.id,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        r.priorityScore ?? '',
        r.openBalance ?? 0,
        r.agingBucket || '',
        r.ownershipMode || '',
        `"${(r.contactEmail || '').replace(/"/g, '""')}"`,
        `"${(r.contactPhone || '').replace(/"/g, '""')}"`,
        `"${(r.creditTerms || '').replace(/"/g, '""')}"`,
        r.creditHold ? 'Yes' : 'No',
        r.hasBrokenPtp ? 'Yes' : 'No',
      ];
      csvRows.push(vals.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `worklist_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 className="page-title">Worklist</h1>
          <span className="badge badge-neutral">
            {processedRows.length}{searchQuery ? ` of ${rows.length}` : ''} accounts
          </span>
        </div>
        <div className="worklist-header-actions">
          <button type="button" className="btn" onClick={handleExportCsv} disabled={processedRows.length === 0}>
            Export CSV
          </button>
          {user?.role === 'manager' && (
            <>
              <button type="button" className="btn" onClick={() => setShowAutoDistribute(true)}>
                Auto-distribute
              </button>
              <button type="button" className="btn" onClick={() => setShowImport(true)}>
                Import CSV
              </button>
              <button type="button" className="btn" onClick={handleSweep} disabled={sweeping}>
                {sweeping ? 'Sweeping…' : 'Run PTP sweep'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
                New account
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collector Daily Queue Triage Strip */}
      <div className="queue-triage-strip">
        <div className="triage-card" title={`${triage.brokenPtps} broken PTP(s) to call`}>
          <div className="triage-icon triage-icon-danger">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="triage-info">
            <span className="triage-value num" title={String(triage.brokenPtps)}>{triage.brokenPtps}</span>
            <span className="triage-label" title="Broken PTPs to call">Broken PTPs to call</span>
          </div>
        </div>
        <div className="triage-card" title={`${triage.pendingPtps} pending PTP(s) due`}>
          <div className="triage-icon triage-icon-warning">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="triage-info">
            <span className="triage-value num" title={String(triage.pendingPtps)}>{triage.pendingPtps}</span>
            <span className="triage-label" title="Pending PTPs due">Pending PTPs due</span>
          </div>
        </div>
        <div className="triage-card" title={`${triage.highAging} account(s) 60+ days delinquent`}>
          <div className="triage-icon triage-icon-aging">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="triage-info">
            <span className="triage-value num" title={String(triage.highAging)}>{triage.highAging}</span>
            <span className="triage-label" title="60+ Days delinquent">60+ Days delinquent</span>
          </div>
        </div>
        {user?.role === 'manager' && (
          <div
            className={`triage-card triage-card-interactive${filters.unassignedOnly ? ' triage-active' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => handleFilterChange('unassignedOnly', !filters.unassignedOnly)}
            title={`${triage.unassigned} unassigned direct account(s). Click to filter.`}
          >
            <div className="triage-icon triage-icon-warning">
              <UserX size={18} strokeWidth={2} aria-hidden="true" />
            </div>
            <div className="triage-info">
              <span className="triage-value num" title={String(triage.unassigned)}>{triage.unassigned}</span>
              <span className="triage-label" title="Unassigned accounts">Unassigned accounts</span>
            </div>
          </div>
        )}
        <div className="triage-card" title={`${triage.creditHolds} account(s) on credit hold`}>
          <div className="triage-icon triage-icon-hold">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <div className="triage-info">
            <span className="triage-value num" title={String(triage.creditHolds)}>{triage.creditHolds}</span>
            <span className="triage-label" title="On credit hold">On credit hold</span>
          </div>
        </div>
        <div className="triage-card triage-card-balance" title={`Queue open balance: ${money(triage.totalBal)}`}>
          <div className="triage-icon triage-icon-accent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="triage-info">
            <span className="triage-value num" title={money(triage.totalBal)}>{money(triage.totalBal)}</span>
            <span className="triage-label" title="Queue open balance">Queue open balance</span>
          </div>
        </div>
      </div>

      <div className="worklist-filters">
        <div className="worklist-search-wrap">
          <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="worklist-search-input"
            placeholder="Search account, AP email, phone…"
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

        <label>
          Aging bucket
          <select
            value={filters.agingBucket}
            onChange={(e) => handleFilterChange('agingBucket', e.target.value)}
          >
            {AGING_OPTIONS.map((o) => (
              <option key={o || 'all'} value={o}>
                {o || 'All'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ownership
          <select
            value={filters.ownershipMode}
            onChange={(e) => handleFilterChange('ownershipMode', e.target.value)}
          >
            {OWNERSHIP_OPTIONS.map((o) => (
              <option key={o || 'all'} value={o}>
                {o || 'All'}
              </option>
            ))}
          </select>
        </label>
        {user?.role === 'manager' && (
          <label>
            Assigned collector
            <select
              value={filters.unassignedOnly ? '__unassigned__' : (filters.collectorId || '')}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__unassigned__') {
                  handleFilterChange('unassignedOnly', true);
                } else {
                  handleFilterChange('collectorId', val);
                }
              }}
            >
              <option value="">All collectors</option>
              <option value="__unassigned__">⚠️ Unassigned only ({triage.unassigned})</option>
              {collectors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </label>
        )}
        {user?.role === 'manager' && (
          <label>
            Relationship owner
            <select
              value={filters.assignedTo}
              onChange={(e) => handleFilterChange('assignedTo', e.target.value)}
            >
              <option value="">All relationship owners</option>
              {relationshipOwners.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </label>
        )}
        {user?.role === 'relationship_owner' && (
          <label className="worklist-mine-toggle" title="Filter to your assigned portfolio accounts">
            <input
              type="checkbox"
              checked={filters.mine}
              onChange={(e) => setFilters((f) => ({ ...f, mine: e.target.checked }))}
            />
            My portfolio only
          </label>
        )}
        {user?.role === 'collector' && (
          <div
            className="worklist-portfolio-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#1d4ed8',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
            }}
            title="As a collector, you are viewing accounts assigned to your portfolio."
          >
            <UserCheck size={14} strokeWidth={2.2} />
            <span>My assigned accounts ({processedRows.length})</span>
          </div>
        )}
        {(filters.agingBucket || filters.ownershipMode || filters.assignedTo || filters.collectorId || filters.unassignedOnly || filters.mine || searchQuery) && (
          <button
            type="button"
            className="btn-quiet"
            onClick={handleClearFilters}
            style={{ marginLeft: 'auto', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <X size={12} strokeWidth={2} aria-hidden="true" />
            <span>Clear filters</span>
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {user?.role === 'relationship_owner' && !filters.mine && (
        <div className="notice-banner" style={{ background: 'var(--surface-sunken, #f8fafc)', borderLeft: '3px solid var(--accent, #3b82f6)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Eye size={15} strokeWidth={2} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>
            <strong>Org Overview (Read-Only):</strong> Viewing all organization accounts. Actions are restricted to accounts within your assigned relationship portfolio.
          </span>
        </div>
      )}

      {selected.size > 0 && (
        <div className="bulk-toolbar">
          <span className="badge badge-accent">{selected.size} selected</span>
          <div className="bulk-toolbar-actions">
            {user?.role !== 'relationship_owner' && (
              <button type="button" className="btn" onClick={handleBulkReminder} disabled={bulkBusy}>
                {bulkBusy ? 'Sending…' : 'Send reminders'}
              </button>
            )}
            {user?.role === 'manager' && (
              <>
                <button type="button" className="btn btn-primary" onClick={() => setShowAssignCollector(true)} disabled={bulkBusy}>
                  Assign collector
                </button>
                <button type="button" className="btn" onClick={() => setShowAutoDistribute(true)} disabled={bulkBusy}>
                  Auto-distribute
                </button>
                <button type="button" className="btn" onClick={() => setShowReassign(true)} disabled={bulkBusy}>
                  Reassign owner
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowOwnershipMode(true)}
                  disabled={bulkBusy}
                >
                  Change ownership mode
                </button>
              </>
            )}
            <button type="button" className="btn-quiet" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="worklist-table-wrap">
        <table className="worklist-table">
          <thead>
            <tr>
              <th className="select-col">
                <input
                  type="checkbox"
                  checked={processedRows.length > 0 && selected.size === processedRows.length}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="sortable-th" onClick={() => handleSort('name')}>
                <div className="th-content">
                  <span>Account</span>
                  <span className="sort-indicator">
                    {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>
              <th>Ownership</th>
              <th className="sortable-th" onClick={() => handleSort('agingBucket')}>
                <div className="th-content">
                  <span>Aging</span>
                  <span className="sort-indicator">
                    {sortConfig.key === 'agingBucket' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>
              <th className="align-right sortable-th" onClick={() => handleSort('openBalance')}>
                <div className="th-content th-content-right">
                  <span>Open balance</span>
                  <span className="sort-indicator">
                    {sortConfig.key === 'openBalance' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>
              <th className="align-right sortable-th" onClick={() => handleSort('priorityScore')}>
                <div className="th-content th-content-right">
                  <span>Priority score</span>
                  <span className="sort-indicator">
                    {sortConfig.key === 'priorityScore' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>
              <th className="align-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="empty-state">
                  Loading worklist…
                </td>
              </tr>
            )}
            {!loading && processedRows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  No accounts match these filters.
                </td>
              </tr>
            )}
            {!loading &&
              processedRows.map((row) => (
                <tr key={row.id} className="worklist-row">
                  <td className="select-col" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      aria-label={`Select ${row.name}`}
                    />
                  </td>
                  <td onClick={() => navigate(`/accounts/${row.id}`)}>
                    <div className="worklist-account-cell">
                      <div className="worklist-account-title-row">
                        <span className="worklist-account-name">{row.name}</span>
                        {row.hasBrokenPtp && <span className="badge badge-danger">Broken PTP</span>}
                        {!row.hasBrokenPtp && row.hasPendingPtp && <span className="badge badge-warning">PTP Pending</span>}
                        {row.creditHold && <span className="hold-flag">credit hold</span>}
                      </div>
                      {(row.contactEmail || row.contactPhone) && (
                        <div className="worklist-account-contact">
                          {row.contactPhone && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.8 }}>
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                              </svg>
                              <span>{row.contactPhone}</span>
                            </span>
                          )}
                          {row.contactPhone && row.contactEmail && <span className="contact-divider">·</span>}
                          {row.contactEmail && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.8 }}>
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                              </svg>
                              <span>{row.contactEmail}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="worklist-ownership" onClick={() => navigate(`/accounts/${row.id}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`status-pill tone-${row.ownershipMode === 'direct' ? 'primary' : 'neutral'}`} style={{ textTransform: 'capitalize', fontSize: '11px', padding: '1px 6px' }}>
                        {row.ownershipMode}
                      </span>
                    </div>
                    {row.ownershipMode === 'direct' && (
                      <div style={{ fontSize: '11.5px', marginTop: '3px' }}>
                        {row.assignedCollectorId ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--ink)' }}>
                            <UserCheck size={11} color="var(--accent)" strokeWidth={2.2} />
                            <span>{row.assignedCollectorName || staffMap.get(row.assignedCollectorId) || `Collector #${row.assignedCollectorId}`}</span>
                          </span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: '10px', padding: '1px 5px' }}>
                            Unassigned
                          </span>
                        )}
                      </div>
                    )}
                    {row.ownershipMode === 'indirect' && (
                      <div style={{ fontSize: '11.5px', marginTop: '3px', color: 'var(--ink-soft)' }}>
                        {row.relationshipOwnerId && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={11} strokeWidth={2} />
                            <span>Owner: {row.relationshipOwnerName || staffMap.get(row.relationshipOwnerId) || `Owner #${row.relationshipOwnerId}`}</span>
                          </div>
                        )}
                        {row.assignedCollectorId && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', opacity: 0.85, marginTop: '1px' }}>
                            <UserCheck size={10} />
                            <span>Collector: {row.assignedCollectorName || staffMap.get(row.assignedCollectorId) || `#${row.assignedCollectorId}`}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td onClick={() => navigate(`/accounts/${row.id}`)}>
                    <AgingBadge bucket={row.agingBucket} />
                  </td>
                  <td className="align-right num" onClick={() => navigate(`/accounts/${row.id}`)}>
                    {money(row.openBalance)}
                  </td>
                  <td
                    className="align-right num worklist-score"
                    onClick={() => navigate(`/accounts/${row.id}`)}
                  >
                    {Number(row.priorityScore).toFixed(1)}
                  </td>
                  <td className="align-right" onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${row.id}`); }}>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="tbl-btn tbl-btn-secondary"
                        onClick={() => navigate(`/accounts/${row.id}`)}
                      >
                        <Eye size={12} strokeWidth={2} />
                        <span>View</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateAccountModal
          staffUsers={staffUsers}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {showAssignCollector && (
        <BulkAssignCollectorModal
          accountIds={Array.from(selected)}
          staffUsers={staffUsers}
          onClose={() => setShowAssignCollector(false)}
          onSaved={() => {
            setShowAssignCollector(false);
            toast.success(`Assigned collector to ${selected.size} account${selected.size === 1 ? '' : 's'}.`);
            load();
          }}
        />
      )}
      {showAutoDistribute && (
        <AutoDistributeModal
          accountIds={Array.from(selected)}
          staffUsers={staffUsers}
          onClose={() => setShowAutoDistribute(false)}
          onDistributed={(res) => {
            setShowAutoDistribute(false);
            const count = res?.distributedAccounts ?? selected.size;
            toast.success(`Auto-distributed ${count} account${count === 1 ? '' : 's'} across active collectors.`);
            load();
          }}
        />
      )}
      {showReassign && (
        <BulkReassignModal
          accountIds={Array.from(selected)}
          staffUsers={staffUsers}
          onClose={() => setShowReassign(false)}
          onSaved={() => {
            setShowReassign(false);
            toast.success(`Reassigned ${selected.size} account${selected.size === 1 ? '' : 's'}.`);
            load();
          }}
        />
      )}
      {showImport && (
        <ImportCsvModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            load();
          }}
        />
      )}
      {showOwnershipMode && (
        <BulkOwnershipModeModal
          accountIds={Array.from(selected)}
          staffUsers={staffUsers}
          onClose={() => setShowOwnershipMode(false)}
          onSaved={() => {
            setShowOwnershipMode(false);
            toast.success(`Updated ownership mode for ${selected.size} account${selected.size === 1 ? '' : 's'}.`);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateAccountModal({ staffUsers = [], onClose, onCreated }) {
  const eligibleOwners = useMemo(
    () => staffUsers.filter((u) => u.role === 'relationship_owner'),
    [staffUsers]
  );
  const eligibleCollectors = useMemo(
    () => staffUsers.filter((u) => u.role === 'collector'),
    [staffUsers]
  );

  const [form, setForm] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    creditTerms: 'Net 30',
    ownershipMode: 'direct',
    relationshipOwnerId: '',
    assignedCollectorId: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const hasOwner = Boolean(form.relationshipOwnerId);
      const effectiveMode = hasOwner ? 'indirect' : form.ownershipMode;
      const payload = {
        name: form.name,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        creditTerms: form.creditTerms,
        ownershipMode: effectiveMode,
        relationshipOwnerId: hasOwner ? Number(form.relationshipOwnerId) : null,
        assignedCollectorId: form.assignedCollectorId ? Number(form.assignedCollectorId) : null,
      };
      await api.createAccount(payload);
      onCreated();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the account.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New account" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="acc-name">Account name</label>
          <input id="acc-name" value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="acc-email">Contact email</label>
          <input
            id="acc-email"
            type="email"
            value={form.contactEmail}
            onChange={(e) => update('contactEmail', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="acc-phone">Contact phone</label>
          <input id="acc-phone" value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="acc-terms">Credit terms</label>
          <input id="acc-terms" value={form.creditTerms} onChange={(e) => update('creditTerms', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="acc-mode">Ownership mode</label>
          <select
            id="acc-mode"
            value={form.ownershipMode}
            onChange={(e) => {
              const val = e.target.value;
              update('ownershipMode', val);
              if (val === 'direct') {
                update('relationshipOwnerId', '');
              }
            }}
          >
            <option value="direct">Direct</option>
            <option value="indirect">Indirect (via relationship owner)</option>
          </select>
        </div>
        {form.ownershipMode === 'direct' && (
          <div className="field">
            <label htmlFor="acc-collector">Assigned collector</label>
            <select
              id="acc-collector"
              value={form.assignedCollectorId}
              onChange={(e) => update('assignedCollectorId', e.target.value)}
            >
              <option value="">Unassigned (pool)</option>
              {eligibleCollectors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>
        )}
        {form.ownershipMode === 'indirect' && (
          <div className="field">
            <label htmlFor="acc-owner">Relationship owner</label>
            {eligibleOwners.length > 0 ? (
              <select
                id="acc-owner"
                value={form.relationshipOwnerId}
                onChange={(e) => update('relationshipOwnerId', e.target.value)}
                required
              >
                <option value="" disabled>Select relationship owner…</option>
                {eligibleOwners.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email} ({u.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="acc-owner"
                type="number"
                value={form.relationshipOwnerId}
                onChange={(e) => update('relationshipOwnerId', e.target.value)}
                placeholder="Enter relationship owner user ID"
                required
              />
            )}
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BulkAssignCollectorModal({ accountIds, staffUsers = [], onClose, onSaved }) {
  const eligibleCollectors = useMemo(
    () => staffUsers.filter((u) => u.role === 'collector'),
    [staffUsers]
  );
  const [collectorId, setCollectorId] = useState(() => (eligibleCollectors[0]?.id ? String(eligibleCollectors[0].id) : ''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!collectorId) {
      setError('Please select a collector to assign.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api.bulkAssignCollector(accountIds, Number(collectorId));
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not assign collector.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Assign collector to ${accountIds.length} account${accountIds.length === 1 ? '' : 's'}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="bulk-collector">Select collector</label>
          {eligibleCollectors.length > 0 ? (
            <select
              id="bulk-collector"
              value={collectorId}
              onChange={(e) => setCollectorId(e.target.value)}
              required
            >
              <option value="" disabled>Select collector…</option>
              {eligibleCollectors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          ) : (
            <p className="notice-banner">No active collectors found in organization.</p>
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !collectorId}>
            {busy ? 'Assigning…' : 'Assign collector'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AutoDistributeModal({ accountIds = [], staffUsers = [], onClose, onDistributed }) {
  const eligibleCollectors = useMemo(
    () => staffUsers.filter((u) => u.role === 'collector'),
    [staffUsers]
  );
  const [selectedCollectors, setSelectedCollectors] = useState(() =>
    new Set(eligibleCollectors.map((u) => u.id))
  );
  const [strategy, setStrategy] = useState('balanced_balance');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function toggleCollector(id) {
    setSelectedCollectors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    if (selectedCollectors.size === 0) {
      setError('Please select at least one collector.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const targetIds = accountIds.length > 0 ? accountIds : null;
      const { data } = await api.autoDistributeAccounts(
        targetIds,
        Array.from(selectedCollectors),
        strategy
      );
      onDistributed(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not auto-distribute accounts.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={
        accountIds.length > 0
          ? `Auto-distribute ${accountIds.length} selected account${accountIds.length === 1 ? '' : 's'}`
          : 'Auto-distribute unassigned direct accounts'
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <p className="page-subtitle" style={{ marginBottom: '14px' }}>
          {accountIds.length > 0
            ? `Distribute the ${accountIds.length} selected accounts evenly across your chosen collectors.`
            : 'Automatically allot all currently unassigned direct accounts across your collector team.'}
        </p>

        <div className="field">
          <label htmlFor="dist-strategy">Distribution strategy</label>
          <select id="dist-strategy" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            <option value="balanced_balance">Balanced open balance (optimizes total $ debt load per collector)</option>
            <option value="round_robin">Round robin (equal account count per collector)</option>
          </select>
        </div>

        <div className="field">
          <label>Target collectors ({selectedCollectors.size} selected)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--radius-s)', padding: '10px' }}>
            {eligibleCollectors.map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={selectedCollectors.has(u.id)}
                  onChange={() => toggleCollector(u.id)}
                />
                <span>{u.name || u.email}</span>
                <span className="badge badge-neutral" style={{ fontSize: '10px', marginLeft: 'auto' }}>
                  {u.role.replace('_', ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || selectedCollectors.size === 0}>
            {busy ? 'Distributing…' : 'Distribute accounts'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---- P1 #39 -- bulk actions: reassign relationship owner across selected accounts ---- */
function BulkReassignModal({ accountIds, staffUsers = [], onClose, onSaved }) {
  const eligibleOwners = useMemo(
    () => staffUsers.filter((u) => u.role === 'relationship_owner'),
    [staffUsers]
  );
  const [relationshipOwnerId, setRelationshipOwnerId] = useState(
    () => {
      const pref = eligibleOwners.find((u) => u.role === 'relationship_owner') || eligibleOwners[0];
      return pref?.id ? String(pref.id) : '';
    }
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!relationshipOwnerId) {
      setError('Please select a relationship owner.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { data } = await api.bulkReassign(accountIds, Number(relationshipOwnerId));
      const skipped = (data || []).filter((r) => r.status && r.status.startsWith('skipped'));
      if (skipped.length > 0) {
        setError(`Warning: ${skipped[0].status}`);
        return;
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reassign these accounts.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Reassign ${accountIds.length} account${accountIds.length === 1 ? '' : 's'}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="bulk-owner">New relationship owner</label>
          {eligibleOwners.length > 0 ? (
            <select
              id="bulk-owner"
              value={relationshipOwnerId}
              onChange={(e) => setRelationshipOwnerId(e.target.value)}
              required
            >
              <option value="" disabled>Select relationship owner…</option>
              {eligibleOwners.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email} ({u.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          ) : (
            <input
              id="bulk-owner"
              type="number"
              value={relationshipOwnerId}
              onChange={(e) => setRelationshipOwnerId(e.target.value)}
              placeholder="Enter user ID"
              required
            />
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Reassigning…' : 'Reassign'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---- P1 #43 -- CSV import: multipart file upload, bulk-inserts accounts/invoices ---- */
function ImportCsvModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function handleDownloadTemplate() {
    const headers = [
      'accountName',
      'contactEmail',
      'contactPhone',
      'creditTerms',
      'ownershipMode',
      'relationshipOwnerId',
      'invoiceAmount',
      'invoiceDueDate',
      'invoiceIssuedDate',
    ];
    const sampleRows = [
      ['Acme Corp', 'billing@acme.com', '+1-555-0199', 'net30', 'direct', '', '12500.00', '2026-10-15', '2026-09-15'],
      ['Globex Ltd', 'ap@globex.org', '+1-555-0244', 'net45', 'indirect', '2', '8400.50', '2026-10-30', '2026-09-15'],
    ];
    const csvContent = [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'accounts_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const { data } = await api.importAccountsCsv(file);
      setResult(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not import this file.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Import accounts from CSV" onClose={onClose} width={500}>
      {!result && (
        <form onSubmit={submit}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-soft)' }}>
              Need the expected CSV format?
            </span>
            <button
              type="button"
              className="btn-quiet"
              onClick={handleDownloadTemplate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12.5px',
                padding: '4px 10px',
                fontWeight: 600,
                color: 'var(--accent)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download sample CSV</span>
            </button>
          </div>
          <p className="page-subtitle" style={{ marginBottom: 14 }}>
            Columns: <code>accountName</code>, <code>contactEmail</code>, <code>contactPhone</code>,{' '}
            <code>creditTerms</code>, <code>ownershipMode</code> (direct/indirect),{' '}
            <code>relationshipOwnerId</code>, <code>invoiceAmount</code>, <code>invoiceDueDate</code> (YYYY-MM-DD),{' '}
            <code>invoiceIssuedDate</code>.
          </p>
          <div className="field">
            <label htmlFor="csv-file">CSV file</label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !file}>
              {busy ? 'Importing…' : 'Import'}
            </button>
          </div>
        </form>
      )}
      {result && (
        <div>
          <div className="kpi-row">
            <div className="kpi-card">
              <span className="kpi-value num">{result.accountsCreated}</span>
              <span className="kpi-label">Accounts created</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-value num">{result.accountsReused}</span>
              <span className="kpi-label">Accounts matched</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-value num">{result.invoicesCreated}</span>
              <span className="kpi-label">Invoices created</span>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className="panel">
              <span className="panel-title">Row errors ({result.errors.length})</span>
              <ul className="import-error-list">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={onImported}>
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---- P1 #48 -- ownership-mode override (bulk), same loop-and-update pattern as bulk-reassign ---- */
function BulkOwnershipModeModal({ accountIds, staffUsers = [], onClose, onSaved }) {
  const eligibleOwners = useMemo(
    () => staffUsers.filter((u) => u.role === 'relationship_owner'),
    [staffUsers]
  );
  const [ownershipMode, setOwnershipMode] = useState('direct');
  const [relationshipOwnerId, setRelationshipOwnerId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.bulkOwnershipMode(
        accountIds,
        ownershipMode,
        ownershipMode === 'indirect' && relationshipOwnerId ? Number(relationshipOwnerId) : null
      );
      const skipped = (data || []).filter((r) => r.status && r.status.startsWith('skipped'));
      if (skipped.length > 0) {
        setError(`Warning: ${skipped[0].status}`);
        return;
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update ownership mode.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Change ownership mode for ${accountIds.length} account${accountIds.length === 1 ? '' : 's'}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="bulk-mode">Ownership mode</label>
          <select id="bulk-mode" value={ownershipMode} onChange={(e) => setOwnershipMode(e.target.value)}>
            <option value="direct">Direct</option>
            <option value="indirect">Indirect (via relationship owner)</option>
          </select>
        </div>
        {ownershipMode === 'indirect' && (
          <div className="field">
            <label htmlFor="bulk-mode-owner">Relationship owner</label>
            {eligibleOwners.length > 0 ? (
              <select
                id="bulk-mode-owner"
                value={relationshipOwnerId}
                onChange={(e) => setRelationshipOwnerId(e.target.value)}
                required
              >
                <option value="" disabled>Select relationship owner…</option>
                {eligibleOwners.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email} ({u.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="bulk-mode-owner"
                type="number"
                value={relationshipOwnerId}
                onChange={(e) => setRelationshipOwnerId(e.target.value)}
                placeholder="Enter relationship owner user ID"
                required
              />
            )}
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
