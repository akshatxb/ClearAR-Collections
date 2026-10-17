import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Eye, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useToast } from '../../context/ToastContext';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import StatusPill from '../../components/StatusPill';
import './Promises.css';

const money = (v) =>
  Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const d = (v) => (v ? new Date(v).toLocaleDateString() : '—');

export default function Promises() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [ptps, setPtps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.getOrgPtps();
      setPtps(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load promises to pay.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdateStatus(id, newStatus) {
    setBusyAction(`${id}-${newStatus}`);
    try {
      await api.updatePtpStatus(id, newStatus);
      toast.success(`Promise to pay marked as ${newStatus}.`);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not update promise status.'));
    } finally {
      setBusyAction('');
    }
  }

  async function handleSweep() {
    setBusyAction('sweep');
    try {
      const { data } = await api.runPtpSweep();
      toast.success(
        data.length === 0
          ? 'No overdue promises found.'
          : `Flagged ${data.length} overdue promise${data.length === 1 ? '' : 's'} as broken.`
      );
      load();
    } catch (err) {
      const msg = apiErrorMessage(err, 'Could not run PTP sweep.');
      toast.error(msg);
      setError(msg);
    } finally {
      setBusyAction('');
    }
  }

  // Triage stats
  const stats = useMemo(() => {
    let broken = 0;
    let pending = 0;
    let kept = 0;
    let totalBrokenBal = 0;
    let totalPendingBal = 0;
    let totalKeptBal = 0;

    ptps.forEach((p) => {
      const amt = Number(p.promisedAmount || 0);
      if (p.status === 'broken') {
        broken++;
        totalBrokenBal += amt;
      } else if (p.status === 'pending') {
        pending++;
        totalPendingBal += amt;
      } else if (p.status === 'kept') {
        kept++;
        totalKeptBal += amt;
      }
    });

    const totalPromises = broken + pending + kept;
    const keptRate = totalPromises > 0 ? (kept / (kept + broken || 1)) * 100 : 0;

    return {
      broken,
      pending,
      kept,
      totalBrokenBal,
      totalPendingBal,
      totalKeptBal,
      totalPromises,
      keptRate,
    };
  }, [ptps]);

  // Filtered list
  const filteredPtps = useMemo(() => {
    return ptps.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.accountName && p.accountName.toLowerCase().includes(q);
        const matchesPhone = p.contactPhone && p.contactPhone.toLowerCase().includes(q);
        const matchesEmail = p.contactEmail && p.contactEmail.toLowerCase().includes(q);
        const matchesCreator = p.createdByName && p.createdByName.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesEmail && !matchesCreator) return false;
      }
      return true;
    });
  }, [ptps, statusFilter, searchQuery]);

  function handleExportCsv() {
    if (filteredPtps.length === 0) return;
    const headers = ['Account Name', 'Promised Amount', 'Promised Date', 'Status', 'Logged By', 'Contact Phone', 'Contact Email'];
    const rows = [headers.join(',')];
    filteredPtps.forEach((p) => {
      rows.push([
        `"${(p.accountName || '').replace(/"/g, '""')}"`,
        p.promisedAmount ?? 0,
        p.promisedDate || '',
        p.status || '',
        `"${(p.createdByName || '').replace(/"/g, '""')}"`,
        `"${(p.contactPhone || '').replace(/"/g, '""')}"`,
        `"${(p.contactEmail || '').replace(/"/g, '""')}"`,
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `promises_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="promises-page">
      <div className="page-header" style={{ alignItems: 'center' }}>
        <h1 className="page-title">Promises to pay</h1>
        <div className="promises-header-actions">
          <button type="button" className="btn" onClick={handleExportCsv} disabled={filteredPtps.length === 0}>
            <Download size={13} strokeWidth={2} aria-hidden="true" />
            <span>Export CSV</span>
          </button>
          {user?.role === 'manager' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSweep}
              disabled={busyAction === 'sweep'}
            >
              <RefreshCw size={13} strokeWidth={2} className={busyAction === 'sweep' ? 'spin-anim' : ''} aria-hidden="true" />
              <span>{busyAction === 'sweep' ? 'Sweeping…' : 'Run PTP sweep'}</span>
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {/* KPI Triage Cards */}
      <div className="promises-kpi-grid">
        <div className={`promises-kpi-card ${stats.broken > 0 ? 'kpi-card-danger' : ''}`} onClick={() => setStatusFilter('broken')}>
          <div className="kpi-icon" style={{ color: 'var(--danger)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="kpi-body">
            <span className="kpi-value num">{stats.broken}</span>
            <span className="kpi-label">Broken PTPs ({money(stats.totalBrokenBal)})</span>
          </div>
        </div>
        <div className="promises-kpi-card" onClick={() => setStatusFilter('pending')}>
          <div className="kpi-icon" style={{ color: 'var(--warn)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="kpi-body">
            <span className="kpi-value num">{stats.pending}</span>
            <span className="kpi-label">Pending commitments ({money(stats.totalPendingBal)})</span>
          </div>
        </div>
        <div className="promises-kpi-card" onClick={() => setStatusFilter('kept')}>
          <div className="kpi-icon" style={{ color: 'var(--success)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="kpi-body">
            <span className="kpi-value num">{stats.kept}</span>
            <span className="kpi-label">Kept commitments ({money(stats.totalKeptBal)})</span>
          </div>
        </div>
        <div className="promises-kpi-card kpi-card-good" onClick={() => setStatusFilter('all')}>
          <div className="kpi-icon" style={{ color: 'var(--accent)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div className="kpi-body">
            <span className="kpi-value num">{stats.keptRate.toFixed(0)}%</span>
            <span className="kpi-label">Fulfillment rate</span>
          </div>
        </div>
      </div>

      {/* Filter Bar & Tabs */}
      <div className="promises-toolbar">
        <div className="promises-tabs">
          <button
            type="button"
            className={`promises-tab ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All <span className="tab-pill">{stats.totalPromises}</span>
          </button>
          <button
            type="button"
            className={`promises-tab ${statusFilter === 'broken' ? 'active' : ''}`}
            onClick={() => setStatusFilter('broken')}
          >
            Broken <span className="tab-pill">{stats.broken}</span>
          </button>
          <button
            type="button"
            className={`promises-tab ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Pending <span className="tab-pill">{stats.pending}</span>
          </button>
          <button
            type="button"
            className={`promises-tab ${statusFilter === 'kept' ? 'active' : ''}`}
            onClick={() => setStatusFilter('kept')}
          >
            Kept <span className="tab-pill">{stats.kept}</span>
          </button>
        </div>

        <div className="promises-search-wrap">
          <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="promises-search-input"
            placeholder="Search company, phone, collector…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')} aria-label="Clear search">
              <X size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Promises Table */}
      <div className="promises-table-wrap">
        <table className="promises-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Promised date</th>
              <th className="align-right">Promised amount</th>
              <th>Status</th>
              <th>Logged by</th>
              <th className="align-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="empty-state">
                  Loading promises to pay…
                </td>
              </tr>
            )}
            {!loading && filteredPtps.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  No promises to pay match your current view.
                </td>
              </tr>
            )}
            {!loading &&
              filteredPtps.map((p) => (
                <tr key={p.id} className="promises-row">
                  <td onClick={() => navigate(`/accounts/${p.accountId}`)}>
                    <div className="ptp-account-cell">
                      <div className="ptp-account-name-row">
                        <span className="ptp-account-name">{p.accountName}</span>
                        {p.relationshipOwnerName ? (
                          <span className="ptp-owner-tag" title={`Relationship owner: ${p.relationshipOwnerName}`}>
                            Owner: {p.relationshipOwnerName}
                          </span>
                        ) : (
                          <span className="ptp-direct-tag" title="Direct collections account">
                            Direct
                          </span>
                        )}
                      </div>
                      {(p.contactPhone || p.contactEmail) && (
                        <div className="ptp-account-meta">
                          {p.contactPhone && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.8 }}>
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                              </svg>
                              <span>{p.contactPhone}</span>
                            </span>
                          )}
                          {p.contactPhone && p.contactEmail && <span>·</span>}
                          {p.contactEmail && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.8 }}>
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                              </svg>
                              <span>{p.contactEmail}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td onClick={() => navigate(`/accounts/${p.accountId}`)}>
                    <span className="num">{d(p.promisedDate)}</span>
                  </td>
                  <td className="align-right num ptp-amount" onClick={() => navigate(`/accounts/${p.accountId}`)}>
                    {money(p.promisedAmount)}
                  </td>
                  <td onClick={() => navigate(`/accounts/${p.accountId}`)}>
                    <StatusPill value={p.status} />
                  </td>
                  <td onClick={() => navigate(`/accounts/${p.accountId}`)}>
                    <span className="ptp-creator">{p.createdByName || 'Staff member'}</span>
                  </td>
                  <td className="align-right">
                    <div className="row-actions">
                      {p.status === 'pending' && (() => {
                        const currentUserId = user?.userId ?? user?.id;
                        const isAssignedToRelationshipOwner = Boolean(p.relationshipOwnerId || p.ownershipMode === 'indirect');
                        const canUpdate = user?.role === 'manager' ||
                          (user?.role === 'relationship_owner' && Number(p.relationshipOwnerId) === Number(currentUserId)) ||
                          (user?.role === 'collector' && !isAssignedToRelationshipOwner);

                        if (!canUpdate) {
                          return (
                            <span
                              className="ptp-owner-restricted-tag"
                              title="Actions reserved for the assigned relationship owner"
                            >
                              Owner managed
                            </span>
                          );
                        }

                        return (
                          <>
                            <button
                              type="button"
                              className="tbl-btn tbl-btn-success"
                              onClick={() => handleUpdateStatus(p.id, 'kept')}
                              disabled={busyAction === `${p.id}-kept`}
                              title="Mark payment fulfilled"
                            >
                              <Check size={12} strokeWidth={2.5} />
                              <span>{busyAction === `${p.id}-kept` ? 'Saving…' : 'Kept'}</span>
                            </button>
                            <button
                              type="button"
                              className="tbl-btn tbl-btn-danger"
                              onClick={() => handleUpdateStatus(p.id, 'broken')}
                              disabled={busyAction === `${p.id}-broken`}
                              title="Mark promise broken"
                            >
                              <X size={12} strokeWidth={2.5} />
                              <span>{busyAction === `${p.id}-broken` ? 'Saving…' : 'Broken'}</span>
                            </button>
                          </>
                        );
                      })()}
                      <button
                        type="button"
                        className="tbl-btn tbl-btn-secondary"
                        onClick={() => navigate(`/accounts/${p.accountId}`)}
                        title="View account"
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
    </div>
  );
}
