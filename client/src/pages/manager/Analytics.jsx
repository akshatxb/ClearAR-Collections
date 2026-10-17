import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Users, Search, Check, X, CheckCircle2, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Eye, Mail, Phone, ShieldAlert, AlertTriangle, TrendingUp, Copy, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useToast } from '../../context/ToastContext';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import StatusPill from '../../components/StatusPill';
import AgingBadge from '../../components/AgingBadge';
import Modal from '../../components/Modal';
import './Analytics.css';

const money = (v) =>
  Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const MAIN_TABS = [
  { key: 'customer', label: 'Customer portfolio' },
  { key: 'employee', label: 'Team performance' },
];

const EMPLOYEE_TABS = [
  { key: 'team', label: 'Team performance' },
  { key: 'disputes', label: 'Disputes queue' },
  { key: 'outcomes', label: 'Outcomes' },
  { key: 'weights', label: 'Weight suggestions' },
  { key: 'escalations', label: 'Escalations' },
  { key: 'reports', label: 'Reports' },
];

const VALID_EMPLOYEE_TABS = EMPLOYEE_TABS.map((t) => t.key);

export default function Analytics() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlMainTab = searchParams.get('section');
  const urlTab = searchParams.get('tab');

  const [mainTab, setMainTab] = useState(urlMainTab === 'employee' ? 'employee' : 'customer');
  const activeEmpTab = VALID_EMPLOYEE_TABS.includes(urlTab) ? urlTab : 'team';
  const [empTab, setEmpTab] = useState(activeEmpTab);

  useEffect(() => {
    if (urlMainTab && (urlMainTab === 'customer' || urlMainTab === 'employee') && urlMainTab !== mainTab) {
      setMainTab(urlMainTab);
    }
  }, [urlMainTab, mainTab]);

  useEffect(() => {
    if (urlTab && VALID_EMPLOYEE_TABS.includes(urlTab) && urlTab !== empTab) {
      setEmpTab(urlTab);
    }
  }, [urlTab, empTab]);

  function handleMainTabChange(key) {
    setMainTab(key);
    setSearchParams({ section: key, tab: key === 'employee' ? empTab : undefined }, { replace: true });
  }

  function handleEmpTabChange(key) {
    setEmpTab(key);
    setSearchParams({ section: 'employee', tab: key }, { replace: true });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
        </div>
      </div>

      {/* Main Top-Level Split: Customer Portfolio vs Team Performance */}
      <div className="tab-row">
        {MAIN_TABS.map((mt) => (
          <button
            key={mt.key}
            type="button"
            className={`tab-btn${mainTab === mt.key ? ' is-active' : ''}`}
            onClick={() => handleMainTabChange(mt.key)}
          >
            {mt.key === 'customer' ? (
              <Building2 size={15} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Users size={15} strokeWidth={2} aria-hidden="true" />
            )}
            <span>{mt.label}</span>
          </button>
        ))}
      </div>

      {/* 1. CUSTOMER ANALYTICS TAB */}
      {mainTab === 'customer' && <CustomerAnalyticsPanel orgId={user?.orgId} />}

      {/* 2. EMPLOYEE & TEAM ANALYTICS TAB */}
      {mainTab === 'employee' && (
        <div className="employee-analytics-section">
          <div className="tab-row" style={{ marginTop: '16px' }}>
            {EMPLOYEE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`tab-btn${empTab === t.key ? ' is-active' : ''}`}
                onClick={() => handleEmpTabChange(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {empTab === 'team' && <TeamPerformancePanel orgId={user?.orgId} />}
          {empTab === 'disputes' && <DisputesQueuePanel orgId={user?.orgId} />}
          {empTab === 'outcomes' && <OutcomeStatsPanel orgId={user?.orgId} />}
          {empTab === 'weights' && <WeightSuggestionsPanel orgId={user?.orgId} />}
          {empTab === 'escalations' && <EscalationsPanel orgId={user?.orgId} />}
          {empTab === 'reports' && <ReportsPanel orgId={user?.orgId} />}
        </div>
      )}
    </div>
  );
}

/* ---- Team performance & collector leaderboard ---- */
function TeamPerformancePanel({ orgId }) {
  const [teamStats, setTeamStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.getTeamStats(orgId);
      setTeamStats(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load team performance stats.'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="empty-state">Loading team performance…</p>;
  if (error) return <p className="error-text">{error}</p>;

  const totalTouches = teamStats.reduce((sum, s) => sum + (s.communicationsLogged || 0), 0);
  const totalAccountsWorked = teamStats.reduce((sum, s) => sum + (s.accountsWorked || 0), 0);
  const activeStaff = teamStats.filter((s) => s.active);

  const totalKept = teamStats.reduce((sum, s) => sum + (s.ptpKept || 0), 0);
  const totalBroken = teamStats.reduce((sum, s) => sum + (s.ptpBroken || 0), 0);
  const orgPtpKeptRate = (totalKept + totalBroken) > 0 ? (totalKept / (totalKept + totalBroken)) * 100 : null;

  return (
    <>
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-value num">{activeStaff.length}</span>
          <span className="kpi-label">Active staff</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value num">{totalTouches}</span>
          <span className="kpi-label">Communications logged</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value num">{totalAccountsWorked}</span>
          <span className="kpi-label">Accounts engaged</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value num">{orgPtpKeptRate != null ? `${orgPtpKeptRate.toFixed(1)}%` : '—'}</span>
          <span className="kpi-label">Team PTP kept rate</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title-row">
          <span className="panel-title">Collector leaderboard</span>
          <span className="badge badge-neutral">{teamStats.length} staff members</span>
        </div>

        {teamStats.length === 0 ? (
          <p className="empty-state">No staff activity recorded yet.</p>
        ) : (
          <table className="mini-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Staff member</th>
                <th>Role</th>
                <th className="align-right">Assigned accounts</th>
                <th className="align-right">Accounts engaged</th>
                <th className="align-right">Outreach touches</th>
                <th className="align-right">PTP kept rate</th>
                <th className="align-right">DSO reduction delta</th>
              </tr>
            </thead>
            <tbody>
              {teamStats.map((staff, idx) => (
                <tr key={staff.userId}>
                  <td className="num font-semibold">
                    <span className={`rank-badge rank-${idx + 1}`} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justify: 'center',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: idx === 0 ? 'rgba(234, 179, 8, 0.15)' : idx === 1 ? 'rgba(148, 163, 184, 0.18)' : idx === 2 ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
                      color: idx === 0 ? '#ca8a04' : idx === 1 ? '#64748b' : idx === 2 ? '#b45309' : 'inherit',
                      border: idx < 3 ? '1px solid currentColor' : 'none'
                    }}>
                      #{idx + 1}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{staff.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{staff.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill tone-${staff.role === 'manager' ? 'neutral' : 'good'}`}>
                      {staff.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="align-right num">{staff.assignedAccounts}</td>
                  <td className="align-right num">{staff.accountsWorked}</td>
                  <td className="align-right num font-semibold">{staff.communicationsLogged}</td>
                  <td className="align-right num">
                    {staff.ptpKeptRate != null ? (
                      <span style={{ color: staff.ptpKeptRate >= 0.7 ? '#16a34a' : staff.ptpKeptRate >= 0.5 ? '#d97706' : '#dc2626', fontWeight: 600 }}>
                        {(staff.ptpKeptRate * 100).toFixed(0)}% ({staff.ptpKept}/{staff.ptpKept + staff.ptpBroken})
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="align-right num">
                    {staff.dsoDaysReducedEstimate != null ? (
                      <span style={{ color: staff.dsoDaysReducedEstimate > 0 ? '#16a34a' : 'inherit', fontWeight: staff.dsoDaysReducedEstimate > 0 ? 600 : 400 }}>
                        {staff.dsoDaysReducedEstimate > 0 ? `+${staff.dsoDaysReducedEstimate.toFixed(1)} days` : `${staff.dsoDaysReducedEstimate.toFixed(1)} days`}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ---- Centralized Org-Wide Dispute Management Queue ---- */
function DisputesQueuePanel({ orgId }) {
  const { toast } = useToast();
  const [disputes, setDisputes] = useState([]);
  const [reasonCodes, setReasonCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [resolvingDispute, setResolvingDispute] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: dList }, { data: rCodes }] = await Promise.all([
        api.getOrgDisputes(),
        api.getReasonCodes(),
      ]);
      setDisputes(dList);
      setReasonCodes(rCodes);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load dispute queue.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = disputes.filter((d) => {
    if (statusFilter === 'all') return true;
    return d.status?.toLowerCase() === statusFilter;
  });

  const openCount = disputes.filter((d) => d.status === 'open').length;
  const reviewCount = disputes.filter((d) => d.status === 'investigating').length;
  const resolvedCount = disputes.filter((d) => d.status === 'resolved').length;
  const avgDaysOpen = disputes.length > 0
    ? (disputes.reduce((sum, d) => sum + (d.daysOpen || 0), 0) / disputes.length).toFixed(1)
    : 0;

  function handleExportCsv() {
    if (!disputes || disputes.length === 0) return;
    const headers = ['Dispute ID', 'Account ID', 'Account Name', 'Contact Email', 'Reason', 'Status', 'Origin', 'Reason Code', 'Days Open', 'Created At', 'Resolved At'];
    const csvRows = [headers.join(',')];
    disputes.forEach((d) => {
      const vals = [
        d.id,
        d.accountId,
        `"${(d.accountName || '').replace(/"/g, '""')}"`,
        `"${(d.contactEmail || '').replace(/"/g, '""')}"`,
        `"${(d.reason || '').replace(/"/g, '""')}"`,
        d.status,
        d.customerOrigin ? 'Customer' : 'Staff',
        `"${(d.reasonCodeLabel || '').replace(/"/g, '""')}"`,
        d.daysOpen ?? 0,
        d.createdAt || '',
        d.resolvedAt || '',
      ];
      csvRows.push(vals.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `disputes_queue_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-value num">{disputes.length}</span>
          <span className="kpi-label">Total disputes</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value num">{openCount}</span>
          <span className="kpi-label">Open</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value num">{reviewCount}</span>
          <span className="kpi-label">Investigating</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value num">{resolvedCount}</span>
          <span className="kpi-label">Resolved</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value num">{avgDaysOpen}d</span>
          <span className="kpi-label">Avg duration open</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="panel-title" style={{ margin: 0 }}>Dispute queue</span>
            <div className="tab-pills">
              {['all', 'open', 'investigating', 'resolved'].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`tab-pill-btn${statusFilter === st ? ' is-active' : ''}`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === 'investigating' ? 'Investigating' : st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="btn"
            onClick={handleExportCsv}
            disabled={disputes.length === 0}
          >
            Export CSV
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}

        {loading ? (
          <p className="empty-state">Loading dispute queue…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">No disputes matching "{statusFilter}".</p>
        ) : (
          <div className="table-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Reason</th>
                  <th>Origin</th>
                  <th className="align-right">Days open</th>
                  <th>Status</th>
                  <th>Resolution code</th>
                  <th className="align-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link to={`/accounts/${d.accountId}`} className="task-account-link">
                        {d.accountName}
                      </Link>
                      {d.contactEmail && (
                        <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>
                          {d.contactEmail}
                        </div>
                      )}
                    </td>
                    <td style={{ maxWidth: '280px', lineHeight: 1.4 }}>{d.reason}</td>
                    <td>
                      <span className={`dispute-origin-pill ${d.customerOrigin ? 'origin-customer' : 'origin-staff'}`}>
                        {d.customerOrigin ? 'Customer portal' : 'Internal staff'}
                      </span>
                    </td>
                    <td className="align-right num">{d.daysOpen}d</td>
                    <td>
                      <StatusPill value={d.status} />
                    </td>
                    <td>
                      {d.reasonCodeLabel ? (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                          {d.reasonCodeLabel}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td className="align-right">
                      {d.status !== 'resolved' ? (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="tbl-btn tbl-btn-primary"
                            onClick={() => setResolvingDispute(d)}
                          >
                            <CheckCircle2 size={12} strokeWidth={2} />
                            <span>Resolve / Update</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--ink-faint)' }}>Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resolvingDispute && (
        <ResolveDisputeModal
          dispute={resolvingDispute}
          reasonCodes={reasonCodes}
          onClose={() => setResolvingDispute(null)}
          onSuccess={() => {
            setResolvingDispute(null);
            toast.success(`Dispute #${resolvingDispute.id} updated.`);
            load();
          }}
        />
      )}
    </>
  );
}

function ResolveDisputeModal({ dispute, reasonCodes, onClose, onSuccess }) {
  const [status, setStatus] = useState(dispute.status === 'open' ? 'investigating' : 'resolved');
  const [reasonCodeId, setReasonCodeId] = useState(dispute.reasonCodeId || (reasonCodes[0]?.id ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === 'resolved' && !reasonCodeId) {
      setError('A structured reason code is required when resolving a dispute.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.updateDispute(dispute.id, {
        status,
        reasonCodeId: status === 'resolved' ? Number(reasonCodeId) : null,
      });
      onSuccess();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update dispute.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Manage Dispute #${dispute.id}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: '14px' }}>
          Account: <strong>{dispute.accountName}</strong> &bull; Reason: <em>"{dispute.reason}"</em>
        </p>

        <div className="field">
          <label htmlFor="dispute-status">Dispute status</label>
          <select
            id="dispute-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="investigating">Under investigation</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {status === 'resolved' && (
          <div className="field" style={{ marginTop: '12px' }}>
            <label htmlFor="dispute-rc">Resolution reason code</label>
            <select
              id="dispute-rc"
              value={reasonCodeId}
              onChange={(e) => setReasonCodeId(e.target.value)}
              required
            >
              {reasonCodes.map((rc) => (
                <option key={rc.id} value={rc.id}>
                  [{rc.category}] {rc.label} ({rc.code})
                </option>
              ))}
            </select>
            <span style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>
              Resolving will record an outcome event and automatically trigger priority score recalculation.
            </span>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Updating…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---- P1 #27 -- outcome analytics dashboard ---- */
function OutcomeStatsPanel({ orgId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    api
      .getOutcomeStats(orgId)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err, 'Could not load outcome stats.')))
      .finally(() => setLoading(false));
  }, [orgId]);

  if (loading) return <p className="empty-state">Loading outcome stats…</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!data) return null;

  const reasonEntries = Object.entries(data.byReasonCode || {});
  const eventEntries = Object.entries(data.byEventType || {});
  const maxReason = Math.max(...reasonEntries.map(([, v]) => v), 1);
  const maxEvent = Math.max(...eventEntries.map(([, v]) => v), 1);

  return (
    <>
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-value num">{data.totalEvents}</span>
          <span className="kpi-label">Total outcome events</span>
        </div>
      </div>

      <div className="panel">
        <span className="panel-title">By event type</span>
        {eventEntries.length === 0 ? (
          <p className="empty-state">No outcome events recorded yet.</p>
        ) : (
          <div className="bucket-chart">
            {eventEntries.map(([label, count]) => (
              <div className="bucket-row" key={label}>
                <span className="bucket-label">{label}</span>
                <div className="bucket-track">
                  <div
                    className="bucket-fill"
                    style={{ width: `${Math.max(3, (count / maxEvent) * 100)}%`, background: 'var(--accent)' }}
                  />
                </div>
                <span className="bucket-count num">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <span className="panel-title">By reason code</span>
        {reasonEntries.length === 0 ? (
          <p className="empty-state">No reason-coded outcomes recorded yet.</p>
        ) : (
          <div className="bucket-chart">
            {reasonEntries.map(([label, count]) => (
              <div className="bucket-row" key={label}>
                <span className="bucket-label" title={label}>
                  {label.length > 9 ? label.slice(0, 9) + '…' : label}
                </span>
                <div className="bucket-track">
                  <div
                    className="bucket-fill"
                    style={{ width: `${Math.max(3, (count / maxReason) * 100)}%`, background: 'var(--heat-0-30)' }}
                  />
                </div>
                <span className="bucket-count num">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ---- P1 #28/#29 -- feedback analysis job + weight-suggestion review panel ---- */
function WeightSuggestionsPanel({ orgId }) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState('');

  const run = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.getWeightSuggestions(orgId);
      setSuggestions(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not run the feedback analysis job.'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  async function approve(s) {
    setApplying(s.factorId);
    try {
      await api.updatePriorityFactors(orgId, [{ id: s.factorId, weight: s.suggestedWeight }]);
      toast.success(`Applied new weight for "${s.label}".`);
      run();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not apply suggested weight.'));
    } finally {
      setApplying('');
    }
  }

  function reject(s) {
    setSuggestions((list) => list.filter((x) => x.factorId !== s.factorId));
  }

  return (
    <div className="panel">
      <div className="panel-title-row">
        <span className="panel-title">Factor-accuracy feedback</span>
        <button type="button" className="btn btn-primary" onClick={run} disabled={loading}>
          {loading ? 'Analyzing…' : suggestions === null ? 'Run analysis' : 'Re-run analysis'}
        </button>
      </div>
      <p className="page-subtitle" style={{ marginBottom: 14 }}>
        Compares each factor's typical value ahead of good outcomes (PTPs kept, disputes resolved as payment
        processed) vs. bad outcomes (PTPs broken, other dispute resolutions), and suggests a weight nudge.
      </p>

      {error && <p className="error-text">{error}</p>}

      {suggestions === null && !loading && (
        <p className="empty-state">Run the analysis to see weight suggestions.</p>
      )}
      {suggestions !== null && suggestions.length === 0 && (
        <p className="empty-state">No suggestions remaining.</p>
      )}
      {suggestions !== null && suggestions.length > 0 && (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Factor</th>
              <th className="align-right">Current</th>
              <th className="align-right">Suggested</th>
              <th>Rationale</th>
              <th>Samples</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.factorId}>
                <td>{s.label}</td>
                <td className="align-right num">{s.currentWeight.toFixed(2)}</td>
                <td className="align-right num">{s.suggestedWeight.toFixed(2)}</td>
                <td className="analytics-rationale">{s.rationale}</td>
                <td className="num">
                  {s.goodSampleSize} good / {s.badSampleSize} bad
                </td>
                <td className="align-right">
                  <div className="row-actions">
                    <button
                      type="button"
                      className="tbl-btn tbl-btn-success"
                      onClick={() => approve(s)}
                      disabled={applying === s.factorId || s.suggestedWeight === s.currentWeight}
                    >
                      <Check size={12} strokeWidth={2.5} />
                      <span>{applying === s.factorId ? 'Applying…' : 'Approve'}</span>
                    </button>
                    <button
                      type="button"
                      className="tbl-btn tbl-btn-danger"
                      onClick={() => reject(s)}
                    >
                      <X size={12} strokeWidth={2.5} />
                      <span>Reject</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---- P1 #32/#34 -- SLA-based escalation engine + history log ---- */
function EscalationsPanel({ orgId }) {
  const { toast } = useToast();
  const [rules, setRules] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deletingRuleId, setDeletingRuleId] = useState(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const [rulesRes, eventsRes] = await Promise.all([
        api.getEscalationRules(orgId),
        api.getEscalationEvents(orgId),
      ]);
      setRules(rulesRes.data);
      setEvents(eventsRes.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load escalation data.'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRun() {
    setRunning(true);
    setError('');
    try {
      const { data } = await api.runEscalationCheck();
      toast.success(
        data.length === 0
          ? 'No SLA breaches found.'
          : `Escalated ${data.length} account${data.length === 1 ? '' : 's'}.`
      );
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not run the escalation check.'));
    } finally {
      setRunning(false);
    }
  }

  async function handleDeleteRule(r) {
    if (!window.confirm(`Delete SLA rule for ${r.agingBucket}+?`)) return;
    setDeletingRuleId(r.id);
    setError('');
    try {
      await api.deleteEscalationRule(orgId, r.id);
      setRules((list) => list.filter((x) => x.id !== r.id));
      toast.success('SLA escalation rule deleted.');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not delete escalation rule.'));
    } finally {
      setDeletingRuleId(null);
    }
  }

  function handleExportEvents() {
    if (!events || events.length === 0) return;
    const headers = ['Event ID', 'Account ID', 'Rule ID', 'Reason', 'Aging Bucket', 'Escalated To Role', 'When'];
    const csvRows = [headers.join(',')];
    events.forEach((e) => {
      csvRows.push([
        e.id,
        e.accountId,
        e.ruleId || '',
        `"${(e.reason || '').replace(/"/g, '""')}"`,
        e.agingBucket || '',
        e.escalateToRole || '',
        e.createdAt || '',
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sla_escalations_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="panel">
        <div className="panel-title-row">
          <span className="panel-title">SLA rules</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditingRule(null);
                setShowRuleModal(true);
              }}
            >
              + New SLA rule
            </button>
            <button type="button" className="btn" onClick={handleRun} disabled={running}>
              {running ? 'Checking…' : 'Run escalation check'}
            </button>
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        {loading ? (
          <p className="empty-state">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="empty-state">No escalation rules configured.</p>
        ) : (
          <table className="mini-table">
            <thead>
              <tr>
                <th>Aging bucket threshold</th>
                <th>Escalates to</th>
                <th className="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.agingBucket}+</td>
                  <td style={{ textTransform: 'capitalize' }}>{r.escalateToRole?.replace('_', ' ')}</td>
                  <td className="align-right">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="tbl-btn tbl-btn-secondary"
                        onClick={() => {
                          setEditingRule(r);
                          setShowRuleModal(true);
                        }}
                      >
                        <Pencil size={12} strokeWidth={2} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="tbl-btn tbl-btn-danger"
                        onClick={() => handleDeleteRule(r)}
                        disabled={deletingRuleId === r.id}
                      >
                        <Trash2 size={12} strokeWidth={2} />
                        <span>{deletingRuleId === r.id ? 'Deleting…' : 'Delete'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showRuleModal && (
        <EscalationRuleModal
          rule={editingRule}
          orgId={orgId}
          onClose={() => setShowRuleModal(false)}
          onSaved={() => {
            setShowRuleModal(false);
            toast.success(editingRule ? 'SLA rule updated.' : 'New SLA rule created.');
            load();
          }}
        />
      )}

      <div className="panel">
        <div className="panel-title-row">
          <span className="panel-title">Escalation history</span>
          <button
            type="button"
            className="btn"
            onClick={handleExportEvents}
            disabled={events.length === 0}
          >
            Export CSV
          </button>
        </div>
        {loading ? (
          <p className="empty-state">Loading…</p>
        ) : events.length === 0 ? (
          <p className="empty-state">No escalations logged yet.</p>
        ) : (
          <table className="mini-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Reason</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {events
                .slice()
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((e) => (
                  <tr key={e.id}>
                    <td className="num">#{e.accountId}</td>
                    <td>{e.reason}</td>
                    <td>{new Date(e.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function EscalationRuleModal({ rule, orgId, onClose, onSaved }) {
  const [agingBucket, setAgingBucket] = useState(rule?.agingBucket || '61-90');
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
      } else {
        await api.createEscalationRule(orgId, { agingBucket, escalateToRole });
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save escalation rule.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={rule ? 'Edit SLA escalation rule' : 'New SLA escalation rule'} onClose={onClose} width={440}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="aging-bucket">Aging bucket threshold</label>
          <select
            id="aging-bucket"
            value={agingBucket}
            onChange={(e) => setAgingBucket(e.target.value)}
          >
            <option value="0-30">0-30 days</option>
            <option value="31-60">31-60 days</option>
            <option value="61-90">61-90 days</option>
            <option value="90+">90+ days</option>
          </select>
          <span className="field-hint" style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>
            Accounts whose worst aging bucket reaches this threshold will be escalated.
          </span>
        </div>

        <div className="field" style={{ marginTop: '14px' }}>
          <label htmlFor="escalate-role">Escalate to role</label>
          <select
            id="escalate-role"
            value={escalateToRole}
            onChange={(e) => setEscalateToRole(e.target.value)}
          >
            <option value="manager">Manager</option>
            <option value="relationship_owner">Relationship owner</option>
            <option value="collector">Collector</option>
          </select>
          <span className="field-hint" style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' }}>
            Notifications and SLA escalation events will be targeted to active staff in this role.
          </span>
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

/* ---- P1 #44 -- org-wide reporting: DSO, CEI, aging trend ---- */
function ReportsPanel({ orgId }) {
  const [periodDays, setPeriodDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.getOrgReport(orgId, periodDays);
      setData(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the report.'));
    } finally {
      setLoading(false);
    }
  }, [orgId, periodDays]);

  useEffect(() => {
    load();
  }, [load]);

  const maxAmount = data ? Math.max(...Object.values(data.agingTrendByAmount || {}), 1) : 1;

  function handleExportReport() {
    if (!data) return;
    const lines = [
      'ClearAR Collections - Org Performance Report',
      `Period,${periodDays} days`,
      `DSO (days),${Number(data.dso).toFixed(1)}`,
      `CEI (%),${Number(data.cei).toFixed(1)}%`,
      `Ending Total Receivables,$${Number(data.endingTotalReceivables).toFixed(2)}`,
      `Credit Sales In Period,$${Number(data.creditSalesInPeriod).toFixed(2)}`,
      '',
      'Aging Bucket,Open Amount ($)',
    ];
    Object.entries(data.agingTrendByAmount || {}).forEach(([bucket, amount]) => {
      lines.push(`${bucket},${amount}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `org_report_${periodDays}d_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label className="analytics-period-select">
            Period
            <select value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <button
            type="button"
            className="btn"
            onClick={handleExportReport}
            disabled={!data}
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="empty-state">Loading report…</p>
      ) : (
        data && (
          <>
            <div className="kpi-row">
              <div className="kpi-card">
                <span className="kpi-value num">{Number(data.dso).toFixed(1)}</span>
                <span className="kpi-label">DSO (days)</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-value num">{Number(data.cei).toFixed(1)}%</span>
                <span className="kpi-label">CEI</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-value num">{money(data.endingTotalReceivables)}</span>
                <span className="kpi-label">Ending total receivables</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-value num">{money(data.creditSalesInPeriod)}</span>
                <span className="kpi-label">Credit sales in period</span>
              </div>
            </div>

            <div className="panel">
              <span className="panel-title">Aging trend (by open amount)</span>
              <div className="bucket-chart">
                {Object.entries(data.agingTrendByAmount || {}).map(([bucket, amount]) => (
                  <div className="bucket-row" key={bucket}>
                    <span className="bucket-label">{bucket}</span>
                    <div className="bucket-track">
                      <div
                        className="bucket-fill"
                        style={{ width: `${Math.max(3, (amount / maxAmount) * 100)}%`, background: 'var(--accent)' }}
                      />
                    </div>
                    <span className="bucket-count num">{money(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      )}
    </>
  );
}

function getPlaybookRecommendation(cust) {
  if (!cust) return { actionTitle: '', strategy: '', tone: 'neutral' };

  if (cust.hasBrokenPtp || cust.brokenPtpCount > 0) {
    return {
      actionTitle: 'Immediate Broken PTP Follow-Up & Escalation',
      strategy: 'Account has breached a formal promise-to-pay commitment. Re-establish urgent contact with accounts payable to secure an immediate wire transfer and evaluate placing credit hold restrictions.',
      tone: 'bad',
    };
  }

  if (cust.creditHold) {
    return {
      actionTitle: 'Enforce Credit Freeze & Request Settlement Schedule',
      strategy: 'Account is under active credit restriction. Suspend further order fulfillment until delinquent balance is cleared or an executive-approved payment plan is executed.',
      tone: 'bad',
    };
  }

  if (cust.openDisputeCount > 0) {
    return {
      actionTitle: 'Expedite Dispute Resolution with Relationship Owner',
      strategy: `Customer has ${cust.openDisputeCount} active disputed invoice(s) impeding settlement. Coordinate with the relationship owner to investigate root causes, issue credit adjustments if valid, and unblock collections.`,
      tone: 'info',
    };
  }

  if (cust.activePtpCount > 0) {
    return {
      actionTitle: 'Active Promise in Grace Period — Monitor Settlement',
      strategy: 'Account has an active, non-expired promise-to-pay. Trust relief has suppressed priority urgency. Avoid aggressive dunning while the commitment remains valid; monitor bank receipts on the promised date.',
      tone: 'info',
    };
  }

  if (cust.zone === 'red') {
    return {
      actionTitle: 'Escalate to Relationship Manager & Issue Demand Notice',
      strategy: 'Critical priority exposure with significant aging or balance. Initiate formal demand sequence and schedule high-touch executive review with the portfolio manager.',
      tone: 'bad',
    };
  }

  if (cust.zone === 'blue') {
    return {
      actionTitle: 'Proactive Outreach & Confirm Invoice Receipt',
      strategy: 'Account is on the 31–60 day delinquency watchlist. Reach out to the accounts payable contact to verify invoice receipt and establish a firm payment schedule.',
      tone: 'info',
    };
  }

  return {
    actionTitle: 'Standard Net 30 Cadence & Trust Maintenance',
    strategy: cust.ptpKeptRatio >= 0.5
      ? 'Account maintains high fulfillment reliability and earned trust relief. Continue standard automated invoice reminders; no manual collector intervention is required.'
      : 'Account maintains prompt payment behavior and net terms compliance. Continue standard automated reminders.',
    tone: 'good',
  };
}

/* ---- Customer Priority 3-Zone Flag Scatter Chart Panel ---- */
function CustomerAnalyticsPanel({ orgId }) {
  const { toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState('all'); // all | direct | indirect
  const [zoneFilter, setZoneFilter] = useState('all'); // all | green | blue | red
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [hoveredCustomer, setHoveredCustomer] = useState(null);
  const [sortField, setSortField] = useState('priorityScore');
  const [sortDir, setSortDir] = useState('desc');
  const [error, setError] = useState('');

  function handleCopyId(id) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(String(id));
    }
    toast.success(`Account ID #${id} copied to clipboard.`);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getWorklist()
      .then((res) => {
        const liveList = res.data || [];

        // Map database accounts dynamically into 3 zones calibrated to the bidirectional priority system
        const mapped = liveList.map((acc) => {
          const score = Number(acc.priorityScore) || 0;
          const bucket = acc.agingBucket || 'current';
          const creditHold = !!acc.creditHold;
          const brokenPtpCount = Number(acc.brokenPtpCount || 0);
          const hasBrokenPtp = !!acc.hasBrokenPtp || brokenPtpCount > 0;
          const activePtpCount = Number(acc.activePtpCount || 0);
          const ptpKeptRatio = Number(acc.ptpKeptRatio || 0);
          const openDisputeCount = Number(acc.openDisputeCount || acc.disputeCount || 0);
          const weightedDpd = acc.weightedDpd !== undefined ? Number(acc.weightedDpd) : 0;
          const recentPaymentsK = Number(acc.recentPaymentsK || 0);
          const name = acc.name || `Account #${acc.id}`;

          let zone = 'green';
          let behavior = 'Prompt Payer • Net terms compliant • Current';

          const openBalance = Number(acc.openBalance || 0);

          // Zero open balance means fully settled -> Green Zone
          if (openBalance <= 0) {
            zone = 'green';
            behavior = ptpKeptRatio >= 0.5
              ? `Fully Settled (${Math.round(ptpKeptRatio * 100)}% PTP Kept) • Earned Trust Credit`
              : 'Fully Settled • Zero Open Exposure • Clean';
          }
          // Categorization rules calibrated to the bidirectional priority system:
          // [RED ZONE]: Credit Hold, active broken PTP with balance, or priorityScore >= 8.0
          else if (creditHold || hasBrokenPtp || score >= 8.0) {
            zone = 'red';
            if (hasBrokenPtp) {
              behavior = 'Defaulted PTP Commitment • Critical Action Required';
            } else if (creditHold) {
              behavior = 'Active Credit Freeze • Delinquent Shipments Held';
            } else {
              behavior = 'Critical Risk • High Exposure (Score 8.0+)';
            }
          }
          // [BLUE ZONE]: Moderate Risk (Score 3.0 to 7.9, or unresolved dispute)
          else if ((score >= 3.0 && score < 8.0) || openDisputeCount > 0) {
            zone = 'blue';
            if (openDisputeCount > 0) {
              behavior = `Disputed Invoices (${openDisputeCount}) • Investigation Watchlist`;
            } else {
              behavior = 'Moderate Risk • Watchlist (Score 3.0–7.9)';
            }
          } else {
            // [GREEN ZONE]: Low Risk / Prompt Payer / Trust Relief
            zone = 'green';
            if (ptpKeptRatio >= 0.5) {
              behavior = `High Reliability (${Math.round(ptpKeptRatio * 100)}% PTP Kept) • Trust Credit`;
            } else if (activePtpCount > 0) {
              behavior = 'Active Promise Grace Period • Settlement Pending';
            } else if (recentPaymentsK > 0) {
              behavior = `Recent Collection ($${recentPaymentsK.toFixed(1)}k paid in 14d) • Credit Applied`;
            } else {
              behavior = 'Prompt Payer • Net terms compliant • Current';
            }
          }

          return {
            id: acc.id,
            name,
            contactEmail: acc.contactEmail || 'N/A',
            contactPhone: acc.contactPhone || 'N/A',
            openBalance: Number(acc.openBalance || 0),
            priorityScore: score,
            agingBucket: bucket,
            creditHold,
            hasBrokenPtp,
            brokenPtpCount,
            activePtpCount,
            ptpKeptRatio,
            openDisputeCount,
            weightedDpd,
            recentPaymentsK,
            riskTier: zone === 'red' ? 'HIGH' : zone === 'blue' ? 'MEDIUM' : 'LOW',
            ownershipMode: acc.ownershipMode || 'direct',
            zone,
            paymentBehavior: behavior,
          };
        });

        setCustomers(mapped);
      })
      .catch((err) => {
        setError(apiErrorMessage(err, 'Could not fetch DB accounts.'));
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  // Overall Portfolio Aggregates
  const totalPortfolioBalance = customers.reduce((sum, c) => sum + (c.openBalance || 0), 0) || 1;
  const allGreenAccounts = customers.filter((c) => c.zone === 'green');
  const allBlueAccounts = customers.filter((c) => c.zone === 'blue');
  const allRedAccounts = customers.filter((c) => c.zone === 'red');

  const allGreenBalance = allGreenAccounts.reduce((sum, c) => sum + (c.openBalance || 0), 0);
  const allBlueBalance = allBlueAccounts.reduce((sum, c) => sum + (c.openBalance || 0), 0);
  const allRedBalance = allRedAccounts.reduce((sum, c) => sum + (c.openBalance || 0), 0);

  const greenShare = ((allGreenBalance / totalPortfolioBalance) * 100).toFixed(1);
  const blueShare = ((allBlueBalance / totalPortfolioBalance) * 100).toFixed(1);
  const redShare = ((allRedBalance / totalPortfolioBalance) * 100).toFixed(1);

  // Filtered dataset
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return customers.filter((c) => {
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.contactEmail.toLowerCase().includes(q);
      const matchesOwnership = ownershipFilter === 'all' || c.ownershipMode === ownershipFilter;
      const matchesZone = zoneFilter === 'all' || c.zone === zoneFilter;
      return matchesSearch && matchesOwnership && matchesZone;
    });
  }, [customers, searchQuery, ownershipFilter, zoneFilter]);

  const greenZone = useMemo(() => filteredCustomers.filter((c) => c.zone === 'green'), [filteredCustomers]);
  const blueZone = useMemo(() => filteredCustomers.filter((c) => c.zone === 'blue'), [filteredCustomers]);
  const redZone = useMemo(() => filteredCustomers.filter((c) => c.zone === 'red'), [filteredCustomers]);

  const redNodePositions = useMemo(() => computeZoneNodePositions(redZone), [redZone]);
  const blueNodePositions = useMemo(() => computeZoneNodePositions(blueZone), [blueZone]);
  const greenNodePositions = useMemo(() => computeZoneNodePositions(greenZone), [greenZone]);

  const totalRedBalance = redZone.reduce((sum, c) => sum + (c.openBalance || 0), 0);
  const totalBlueBalance = blueZone.reduce((sum, c) => sum + (c.openBalance || 0), 0);
  const totalGreenBalance = greenZone.reduce((sum, c) => sum + (c.openBalance || 0), 0);

  // Sorting
  function handleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' || field === 'contactEmail' || field === 'id' ? 'asc' : 'desc');
    }
  }

  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
  }, [filteredCustomers, sortField, sortDir]);

  function renderSortIcon(field) {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.35, marginLeft: 4 }} />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp size={12} style={{ color: 'var(--accent)', marginLeft: 4 }} />
    ) : (
      <ArrowDown size={12} style={{ color: 'var(--accent)', marginLeft: 4 }} />
    );
  }

  return (
    <div className="customer-analytics-container">
      {/* App-Standard Filter Toolbar */}
      <div className="admin-filter-bar" style={{ marginBottom: '16px' }}>
        <div className="admin-search-wrap">
          <Search size={14} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search customer name, contact email…"
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
          Risk tier
          <select
            className="admin-filter-select"
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
          >
            <option value="all">All risk tiers</option>
            <option value="green">Low risk (Prompt / Current)</option>
            <option value="blue">Moderate (Watchlist Net 30–60)</option>
            <option value="red">Critical (Immediate action)</option>
          </select>
        </label>

        <label className="admin-filter-label">
          Ownership
          <select
            className="admin-filter-select"
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value)}
          >
            <option value="all">All ownership</option>
            <option value="direct">Direct</option>
            <option value="indirect">Indirect</option>
          </select>
        </label>

        {(searchQuery || zoneFilter !== 'all' || ownershipFilter !== 'all') && (
          <button
            type="button"
            className="btn btn-quiet"
            style={{ height: '36px', fontSize: '12.5px' }}
            onClick={() => {
              setSearchQuery('');
              setZoneFilter('all');
              setOwnershipFilter('all');
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Interactive Portfolio Exposure KPI Cards (Click-to-Filter) */}
      <div className="admin-metrics-grid" style={{ marginBottom: '20px' }}>
        <button
          type="button"
          className={`admin-stat-card flag-kpi-card green-kpi-card ${zoneFilter === 'green' ? 'is-card-selected' : ''}`}
          onClick={() => setZoneFilter((prev) => (prev === 'green' ? 'all' : 'green'))}
          title="Click to toggle filter for Low Risk accounts"
        >
          <span className="admin-stat-label">Low Risk Portfolio</span>
          <div className="admin-stat-val-group">
            <span className="admin-stat-value num">{money(allGreenBalance)}</span>
            <span className={`admin-stat-tag ${zoneFilter === 'green' ? 'tag-good' : 'tag-neutral'}`}>
              {zoneFilter === 'green' ? 'Filtered' : `${greenShare}%`}
            </span>
          </div>
          <span className="admin-stat-sub num">{allGreenAccounts.length} accounts</span>
        </button>

        <button
          type="button"
          className={`admin-stat-card flag-kpi-card blue-kpi-card ${zoneFilter === 'blue' ? 'is-card-selected' : ''}`}
          onClick={() => setZoneFilter((prev) => (prev === 'blue' ? 'all' : 'blue'))}
          title="Click to toggle filter for Moderate Risk accounts"
        >
          <span className="admin-stat-label">Moderate Watchlist</span>
          <div className="admin-stat-val-group">
            <span className="admin-stat-value num">{money(allBlueBalance)}</span>
            <span className={`admin-stat-tag ${zoneFilter === 'blue' ? 'tag-accent' : 'tag-neutral'}`}>
              {zoneFilter === 'blue' ? 'Filtered' : `${blueShare}%`}
            </span>
          </div>
          <span className="admin-stat-sub num">{allBlueAccounts.length} accounts</span>
        </button>

        <button
          type="button"
          className={`admin-stat-card flag-kpi-card red-kpi-card ${zoneFilter === 'red' ? 'is-card-selected' : ''}`}
          onClick={() => setZoneFilter((prev) => (prev === 'red' ? 'all' : 'red'))}
          title="Click to toggle filter for Critical Risk accounts"
        >
          <span className="admin-stat-label">Critical Action Queue</span>
          <div className="admin-stat-val-group">
            <span className="admin-stat-value num">{money(allRedBalance)}</span>
            <span className={`admin-stat-tag ${zoneFilter === 'red' ? 'tag-danger' : 'tag-neutral'}`}>
              {zoneFilter === 'red' ? 'Filtered' : `${redShare}%`}
            </span>
          </div>
          <span className="admin-stat-sub num">{allRedAccounts.length} accounts</span>
        </button>
      </div>

      {/* 3-ZONE SCATTER MATRIX */}
      <div className="panel flag-graph-panel">
        <div className="panel-title-row">
          <span className="panel-title">Portfolio Risk vs Exposure Matrix</span>
          <span className="badge badge-neutral">{filteredCustomers.length} accounts displayed</span>
        </div>

        {error && <p className="error-text">{error}</p>}

        {loading ? (
          <p className="empty-state">Loading Customer Priority Matrix…</p>
        ) : (
          <div className="flag-matrix-outer">
            <div className="flag-matrix-inner">
              <div className="flag-matrix-wrapper">
                {/* CONTINUOUS CANVAS */}
                <div className="unified-flag-canvas-container">
                  {/* STREAMLINED Y-AXIS SCALE STRIP (Top = High Risk, Bottom = Low Risk) */}
                  <div className="yaxis-zone-strip">
                    <div className="yaxis-zone-label yaxis-red">
                      <span className="y-dot red-dot" />
                      <span className="y-text">CRITICAL</span>
                      <span className="y-score-tag">Score 8.0+</span>
                      <span className="y-count-tag">{redZone.length}</span>
                    </div>
                    <div className="yaxis-zone-label yaxis-blue">
                      <span className="y-dot blue-dot" />
                      <span className="y-text">MODERATE</span>
                      <span className="y-score-tag">Score 3.0–7.9</span>
                      <span className="y-count-tag">{blueZone.length}</span>
                    </div>
                    <div className="yaxis-zone-label yaxis-green">
                      <span className="y-dot green-dot" />
                      <span className="y-text">LOW RISK</span>
                      <span className="y-score-tag">Score &lt; 3.0</span>
                      <span className="y-count-tag">{greenZone.length}</span>
                    </div>
                  </div>

                  {/* CONTINUOUS 3-ZONE PLOT AREA WITH GRIDLINES */}
                  <div className="unified-flag-plot-area">
                    {/* VERTICAL COORDINATE GRIDLINES */}
                    <div className="matrix-coord-gridline" style={{ left: '22%' }} />
                    <div className="matrix-coord-gridline" style={{ left: '42%' }} />
                    <div className="matrix-coord-gridline" style={{ left: '62%' }} />
                    <div className="matrix-coord-gridline" style={{ left: '80%' }} />
                    <div className="matrix-coord-gridline" style={{ left: '94%' }} />

                    {/* 1. RED ZONE BAND (TOP - CRITICAL RISK) */}
                    <div className="unified-zone-band unified-red-band">
                      <div className="zone-band-header">
                        <span className="zone-band-tag zone-tag-red">CRITICAL RISK &bull; SCORE 8.0+ &bull; IMMEDIATE ESCALATION</span>
                        {/* High Exposure Danger Zone Callout */}
                        <div className="high-exposure-callout-zone" title="High Balance Exposure (> $350k) & Critical Delinquency">
                          <span className="danger-zone-pill">
                            <AlertTriangle size={10} strokeWidth={2.5} />
                            <span>HIGH EXPOSURE ZONE ($350k+)</span>
                          </span>
                        </div>
                      </div>
                      <div className="zone-nodes-scatter">
                        {redNodePositions.map((node) => (
                          <CustomerBubbleNode
                            key={node.cust.id}
                            cust={node.cust}
                            leftPercent={node.leftPercent}
                            topPercent={node.topPercent}
                            sizePx={node.sizePx}
                            isHovered={hoveredCustomer?.id === node.cust.id}
                            onHover={setHoveredCustomer}
                            onClick={setSelectedCustomer}
                          />
                        ))}
                      </div>
                    </div>

                    {/* 2. BLUE ZONE BAND (MIDDLE - MODERATE RISK WATCHLIST) */}
                    <div className="unified-zone-band unified-blue-band">
                      <div className="zone-band-header">
                        <span className="zone-band-tag zone-tag-blue">MODERATE RISK &bull; SCORE 3.0–7.9 &bull; NET 30–60 WATCHLIST</span>
                      </div>
                      <div className="zone-nodes-scatter">
                        {blueNodePositions.map((node) => (
                          <CustomerBubbleNode
                            key={node.cust.id}
                            cust={node.cust}
                            leftPercent={node.leftPercent}
                            topPercent={node.topPercent}
                            sizePx={node.sizePx}
                            isHovered={hoveredCustomer?.id === node.cust.id}
                            onHover={setHoveredCustomer}
                            onClick={setSelectedCustomer}
                          />
                        ))}
                      </div>
                    </div>

                    {/* 3. GREEN ZONE BAND (BOTTOM - LOW RISK / CURRENT) */}
                    <div className="unified-zone-band unified-green-band">
                      <div className="zone-band-header">
                        <span className="zone-band-tag zone-tag-green">LOW RISK &bull; SCORE &lt; 3.0 &bull; PROMPT PAYER &amp; TRUST RELIEF</span>
                      </div>
                      <div className="zone-nodes-scatter">
                        {greenNodePositions.map((node) => (
                          <CustomerBubbleNode
                            key={node.cust.id}
                            cust={node.cust}
                            leftPercent={node.leftPercent}
                            topPercent={node.topPercent}
                            sizePx={node.sizePx}
                            isHovered={hoveredCustomer?.id === node.cust.id}
                            onHover={setHoveredCustomer}
                            onClick={setSelectedCustomer}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* X-AXIS TICK RULER */}
              <div className="xaxis-canvas-ruler xaxis-ruler-external">
                <div className="xaxis-ticks-row">
                  <div className="xaxis-tick" style={{ left: '5%' }}>
                    <span className="tick-mark" />
                    <span className="tick-label">$0</span>
                  </div>
                  <div className="xaxis-tick" style={{ left: '22%' }}>
                    <span className="tick-mark" />
                    <span className="tick-label">$50k</span>
                  </div>
                  <div className="xaxis-tick" style={{ left: '42%' }}>
                    <span className="tick-mark" />
                    <span className="tick-label">$150k</span>
                  </div>
                  <div className="xaxis-tick" style={{ left: '62%' }}>
                    <span className="tick-mark" />
                    <span className="tick-label">$350k</span>
                  </div>
                  <div className="xaxis-tick" style={{ left: '80%' }}>
                    <span className="tick-mark" />
                    <span className="tick-label">$650k</span>
                  </div>
                  <div className="xaxis-tick" style={{ left: '94%' }}>
                    <span className="tick-mark" />
                    <span className="tick-label">$1M+</span>
                  </div>
                </div>
              </div>

              {/* HORIZONTAL X-AXIS LABEL */}
              <div className="xaxis-external-label">
                <span>Outstanding Balance Exposure ($)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hover Quick-Tooltip */}
      {hoveredCustomer && (
        <div className="customer-bubble-tooltip">
          <div className="tooltip-header">
            <div>
              <strong style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>{hoveredCustomer.name}</strong>
              <span style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>#{hoveredCustomer.id} &bull; {hoveredCustomer.ownershipMode} portfolio</span>
            </div>
            <span className={`status-pill tone-${hoveredCustomer.zone === 'green' ? 'good' : hoveredCustomer.zone === 'blue' ? 'info' : 'bad'}`}>
              {hoveredCustomer.zone === 'green' ? 'LOW RISK' : hoveredCustomer.zone === 'blue' ? 'MODERATE' : 'CRITICAL'}
            </span>
          </div>
          <div className="tooltip-body">
            <div><span>Outstanding Exposure:</span> <strong>{money(hoveredCustomer.openBalance)}</strong></div>
            <div><span>Priority Score:</span> <strong>{hoveredCustomer.priorityScore.toFixed(1)}</strong></div>
            <div><span>Weighted DPD:</span> <strong>{hoveredCustomer.weightedDpd ? `${hoveredCustomer.weightedDpd.toFixed(0)} days` : hoveredCustomer.agingBucket}</strong></div>
            <div><span>Aging Bucket:</span> <strong>{hoveredCustomer.agingBucket}</strong></div>
            {hoveredCustomer.activePtpCount > 0 && (
              <div><span>Active Promise:</span> <span style={{ color: '#0284c7', fontWeight: 600 }}>Grace Period Active</span></div>
            )}
            {hoveredCustomer.ptpKeptRatio > 0 && (
              <div><span>PTP Track Record:</span> <span style={{ color: '#059669', fontWeight: 600 }}>{Math.round(hoveredCustomer.ptpKeptRatio * 100)}% Kept</span></div>
            )}
            {hoveredCustomer.openDisputeCount > 0 && (
              <div><span>Disputes:</span> <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{hoveredCustomer.openDisputeCount} Disputed Invoice(s)</span></div>
            )}
            <div><span>Credit Status:</span> <span style={{ color: hoveredCustomer.creditHold ? 'var(--danger-strong)' : 'var(--good-strong)', fontWeight: 600 }}>{hoveredCustomer.creditHold ? 'Active Hold' : 'Normal'}</span></div>
            {hoveredCustomer.hasBrokenPtp && (
              <div><span>Commitments:</span> <span style={{ color: 'var(--danger-strong)', fontWeight: 600 }}>Broken PTP Default</span></div>
            )}
            <div><span>Ledger Profile:</span> <em>{hoveredCustomer.paymentBehavior}</em></div>
          </div>
          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--line)', fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>
            Click node to inspect full risk dossier &rarr;
          </div>
        </div>
      )}

      {/* Selected Customer Side Drawer Modal */}
      {selectedCustomer && (() => {
        const playbook = getPlaybookRecommendation(selectedCustomer);
        const initials = (selectedCustomer.name || '')
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join('') || 'AC';

        return (
          <Modal title="Account Risk Dossier" width={740} onClose={() => setSelectedCustomer(null)}>
            <div className="customer-modal-details">
              {/* Hero Account Header */}
              <div className={`dossier-hero-box zone-border-${selectedCustomer.zone}`}>
                <div className="dossier-hero-top">
                  <div className="dossier-avatar-group">
                    <div className={`dossier-avatar avatar-zone-${selectedCustomer.zone}`}>
                      {initials}
                    </div>
                    <div>
                      <div className="dossier-title-row">
                        <h2 className="dossier-account-name">{selectedCustomer.name}</h2>
                        <span className={`status-pill tone-${selectedCustomer.zone === 'green' ? 'good' : selectedCustomer.zone === 'blue' ? 'info' : 'bad'}`}>
                          {selectedCustomer.riskTier} RISK
                        </span>
                        <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                          {selectedCustomer.ownershipMode} portfolio
                        </span>
                      </div>
                      <div className="dossier-meta-row">
                        <span className="dossier-id-badge">
                          <span className="num font-semibold">#{selectedCustomer.id}</span>
                          <button
                            type="button"
                            className="dossier-copy-btn"
                            onClick={() => handleCopyId(selectedCustomer.id)}
                            title="Copy Account ID"
                            aria-label="Copy Account ID"
                          >
                            <Copy size={11} strokeWidth={2} />
                          </button>
                        </span>
                        {selectedCustomer.contactEmail && selectedCustomer.contactEmail !== 'N/A' && (
                          <a
                            href={`mailto:${selectedCustomer.contactEmail}`}
                            className="dossier-contact-chip"
                            title="Send email"
                          >
                            <Mail size={12} strokeWidth={2} />
                            <span>{selectedCustomer.contactEmail}</span>
                          </a>
                        )}
                        {selectedCustomer.contactPhone && selectedCustomer.contactPhone !== 'N/A' && (
                          <a
                            href={`tel:${selectedCustomer.contactPhone}`}
                            className="dossier-contact-chip"
                            title="Call customer"
                          >
                            <Phone size={12} strokeWidth={2} />
                            <span>{selectedCustomer.contactPhone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-KPI Metric Cards Grid */}
              <div className="dossier-kpi-grid">
                <div className="dossier-kpi-card">
                  <span className="dossier-kpi-label">Outstanding Exposure</span>
                  <span className={`dossier-kpi-value num ${selectedCustomer.zone === 'red' ? 'val-danger' : selectedCustomer.zone === 'blue' ? 'val-accent' : 'val-good'}`}>
                    {money(selectedCustomer.openBalance)}
                  </span>
                </div>

                <div className="dossier-kpi-card">
                  <span className="dossier-kpi-label">Priority Urgency Score</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span className="dossier-kpi-value num">{selectedCustomer.priorityScore.toFixed(1)}</span>
                    <span className={`status-pill tone-${selectedCustomer.zone === 'green' ? 'good' : selectedCustomer.zone === 'blue' ? 'info' : 'bad'}`} style={{ fontSize: '10.5px' }}>
                      {selectedCustomer.riskTier} RISK
                    </span>
                  </div>
                </div>

                <div className="dossier-kpi-card">
                  <span className="dossier-kpi-label">Aging &amp; Weighted DPD</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <AgingBadge bucket={selectedCustomer.agingBucket} large={true} />
                    <span className="num" style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                      ({selectedCustomer.weightedDpd ? selectedCustomer.weightedDpd.toFixed(0) : 0}d DPD)
                    </span>
                  </div>
                </div>

                <div className="dossier-kpi-card">
                  <span className="dossier-kpi-label">Commitment &amp; Trust</span>
                  <div className="dossier-signals-wrap">
                    {selectedCustomer.creditHold && (
                      <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldAlert size={11} strokeWidth={2.5} />
                        <span>Credit Hold</span>
                      </span>
                    )}
                    {selectedCustomer.hasBrokenPtp && (
                      <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={11} strokeWidth={2.5} />
                        <span>Broken PTP</span>
                      </span>
                    )}
                    {selectedCustomer.activePtpCount > 0 && (
                      <span className="badge badge-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7' }}>
                        <CheckCircle2 size={11} strokeWidth={2.5} />
                        <span>Active Promise Grace</span>
                      </span>
                    )}
                    {selectedCustomer.ptpKeptRatio > 0 && (
                      <span className="badge badge-good" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={11} strokeWidth={2.5} />
                        <span>{Math.round(selectedCustomer.ptpKeptRatio * 100)}% PTP Kept</span>
                      </span>
                    )}
                    {selectedCustomer.openDisputeCount > 0 && (
                      <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#8b5cf6' }}>
                        <AlertTriangle size={11} strokeWidth={2.5} />
                        <span>{selectedCustomer.openDisputeCount} Dispute{selectedCustomer.openDisputeCount > 1 ? 's' : ''}</span>
                      </span>
                    )}
                    {!selectedCustomer.creditHold && !selectedCustomer.hasBrokenPtp && selectedCustomer.activePtpCount === 0 && selectedCustomer.ptpKeptRatio === 0 && selectedCustomer.openDisputeCount === 0 && (
                      <span className="badge badge-good" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={11} strokeWidth={2.5} />
                        <span>Standard Account</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Collector Action Strategy / Recommended Playbook */}
              <div className={`dossier-playbook-card playbook-tone-${playbook.tone}`}>
                <div className="dossier-playbook-header">
                  <TrendingUp size={15} strokeWidth={2} />
                  <span className="dossier-playbook-title">Recommended Collector Strategy</span>
                </div>
                <div className="dossier-playbook-action">{playbook.actionTitle}</div>
                <p className="dossier-playbook-text">{playbook.strategy}</p>
                <div className="dossier-behavior-tag">
                  <span className="dossier-behavior-lbl">Ledger Profile:</span>
                  <span className="dossier-behavior-val">{selectedCustomer.paymentBehavior}</span>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="modal-actions" style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn" onClick={() => setSelectedCustomer(null)}>
                  Close
                </button>
                <Link
                  to={`/accounts/${selectedCustomer.id}`}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ExternalLink size={13} strokeWidth={2} />
                  <span>Open Account File</span>
                </Link>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Customer Comparison List Table */}
      <div className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-title-row">
          <div>
            <span className="panel-title">Customer Portfolio Ledger</span>
            <span className="panel-subtitle-text" style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--ink-soft)' }}>
              Executive customer risk breakdown &amp; credit metrics
            </span>
          </div>
          <span className="badge badge-neutral">{sortedCustomers.length} Records</span>
        </div>
        <div className="table-wrap">
          <table className="mini-table customer-ledger-table">
            <thead>
              <tr>
                <th className="sortable-th" style={{ width: '80px' }} onClick={() => handleSort('id')}>
                  <div className="th-content">
                    <span>ID</span>
                    {renderSortIcon('id')}
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort('name')}>
                  <div className="th-content">
                    <span>Customer / Contact</span>
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th className="sortable-th" style={{ width: '130px' }} onClick={() => handleSort('zone')}>
                  <div className="th-content">
                    <span>Risk Tier</span>
                    {renderSortIcon('zone')}
                  </div>
                </th>
                <th className="sortable-th align-center" style={{ width: '130px' }} onClick={() => handleSort('agingBucket')}>
                  <div className="th-content" style={{ justifyContent: 'center', width: '100%' }}>
                    <span>Aging Bucket</span>
                    {renderSortIcon('agingBucket')}
                  </div>
                </th>
                <th className="align-right sortable-th" style={{ width: '170px' }} onClick={() => handleSort('openBalance')}>
                  <div className="th-content" style={{ justifyContent: 'flex-end', width: '100%' }}>
                    <span>Outstanding Balance</span>
                    {renderSortIcon('openBalance')}
                  </div>
                </th>
                <th className="align-right sortable-th" style={{ width: '130px' }} onClick={() => handleSort('priorityScore')}>
                  <div className="th-content" style={{ justifyContent: 'flex-end', width: '100%' }}>
                    <span>Priority Score</span>
                    {renderSortIcon('priorityScore')}
                  </div>
                </th>
                <th className="align-right" style={{ width: '110px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state" style={{ padding: '36px 16px', textAlign: 'center' }}>
                    No customer accounts match the current filter criteria.
                  </td>
                </tr>
              ) : (
                sortedCustomers.map((cust) => (
                  <tr
                    key={cust.id}
                    className={`table-row-zone-${cust.zone} ${hoveredCustomer?.id === cust.id ? 'row-highlighted' : ''}`}
                    onMouseEnter={() => setHoveredCustomer(cust)}
                    onMouseLeave={() => setHoveredCustomer(null)}
                  >
                    <td>
                      <span className="num font-semibold" style={{ color: 'var(--ink-soft)' }}>
                        #{cust.id}
                      </span>
                    </td>
                    <td>
                      <div>
                        <Link
                          to={`/accounts/${cust.id}`}
                          className="account-link font-semibold"
                          style={{ color: 'var(--ink)', textDecoration: 'none', display: 'inline-block' }}
                        >
                          {cust.name}
                        </Link>
                        {cust.contactEmail && cust.contactEmail !== 'N/A' && (
                          <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '2px' }}>
                            {cust.contactEmail}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill tone-${cust.zone === 'green' ? 'good' : cust.zone === 'blue' ? 'info' : 'bad'}`}>
                        {cust.zone === 'green' ? 'Low Risk' : cust.zone === 'blue' ? 'Moderate' : 'Critical'}
                      </span>
                    </td>
                    <td className="align-center">
                      <span className={`aging-pill bucket-${cust.agingBucket.replace('+', 'plus')}`}>
                        {cust.agingBucket}
                      </span>
                    </td>
                    <td className="align-right num font-semibold">{money(cust.openBalance)}</td>
                    <td className="align-right num font-semibold">{cust.priorityScore.toFixed(1)}</td>
                    <td className="align-right">
                      <div className="row-actions" style={{ display: 'inline-flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="tbl-btn tbl-btn-secondary"
                          onClick={() => setSelectedCustomer(cust)}
                          title="Inspect account dossier"
                        >
                          <Eye size={12} strokeWidth={2} />
                          <span>Inspect</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getXPercent(bal) {
  if (bal <= 0) return 6;
  if (bal <= 50000) return 6 + (bal / 50000) * 16; // 6% to 22%
  if (bal <= 150000) return 22 + ((bal - 50000) / 100000) * 20; // 22% to 42%
  if (bal <= 350000) return 42 + ((bal - 150000) / 200000) * 20; // 42% to 62%
  if (bal <= 650000) return 62 + ((bal - 350000) / 300000) * 18; // 62% to 80%
  if (bal <= 1000000) return 80 + ((bal - 650000) / 350000) * 12; // 80% to 92%
  return Math.min(93.5, 92 + Math.min(1.5, Math.log10(bal / 1000000)));
}

/**
 * Deterministic 2D Anti-Collision Relaxation for Scatter Nodes
 * Prevents node overlaps in dense balance/score clusters while
 * preserving true Cartesian exposure alignment.
 */
function computeZoneNodePositions(zoneAccounts) {
  if (!zoneAccounts || zoneAccounts.length === 0) return [];

  // Normalized coordinate model (Width = 1000, Band Height = 140)
  const W = 1000;
  const H = 140;

  const sorted = [...zoneAccounts].sort((a, b) => (a.openBalance - b.openBalance) || (a.id - b.id));
  const scores = sorted.map((c) => c.priorityScore);
  const minScore = Math.min(...scores, 0);
  const maxScore = Math.max(...scores, 1);
  const scoreRange = maxScore - minScore || 1;

  const zeroAccounts = sorted.filter((a) => a.openBalance <= 0);

  const nodes = sorted.map((cust) => {
    let idealLeftPct = 6;
    if (cust.openBalance <= 0) {
      const zeroIdx = zeroAccounts.findIndex((a) => a.id === cust.id);
      idealLeftPct = 4.5 + (zeroIdx % 4) * 2.8;
    } else {
      idealLeftPct = getXPercent(cust.openBalance);
    }

    const scoreRatio = (cust.priorityScore - minScore) / scoreRange;
    const idealTopPct = 62 - scoreRatio * 32; // 30% (high score) to 62% (low score)

    const sizePx = Math.min(46, Math.max(36, 36 + (cust.openBalance > 250000 ? 8 : cust.openBalance > 50000 ? 4 : 0)));

    return {
      cust,
      x0: (idealLeftPct / 100) * W,
      y0: (idealTopPct / 100) * H,
      x: (idealLeftPct / 100) * W,
      y: (idealTopPct / 100) * H,
      sizePx,
      radius: sizePx / 2,
    };
  });

  if (nodes.length <= 1) {
    return nodes.map((n) => ({
      cust: n.cust,
      sizePx: n.sizePx,
      leftPercent: Number(((n.x / W) * 100).toFixed(2)),
      topPercent: Number(((n.y / H) * 100).toFixed(2)),
    }));
  }

  // 24 Iterations of 2D Force-Directed Relaxation
  const iterations = 24;
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const ni = nodes[i];
        const nj = nodes[j];

        const dx = nj.x - ni.x;
        const dy = nj.y - ni.y;
        const dist = Math.hypot(dx, dy);

        // Required separation: sum of radii + 6px breathing gap
        const minDist = ni.radius + nj.radius + 6;

        if (dist < minDist) {
          const overlap = minDist - dist;
          const safeDist = dist === 0 ? 0.001 : dist;
          let nx = dx / safeDist;
          let ny = dy / safeDist;

          // If vertically collinear, supply alternating vertical separation kick
          if (Math.abs(ny) < 0.2) {
            ny = i % 2 === 0 ? 1 : -1;
            nx = j % 2 === 0 ? 0.5 : -0.5;
            const kickLen = Math.hypot(nx, ny);
            nx /= kickLen;
            ny /= kickLen;
          }

          // Bias push toward Y (vertical headroom) to preserve X-axis balance fidelity
          const pushX = nx * overlap * 0.35 * 0.5;
          const pushY = ny * overlap * 0.85 * 0.5;

          ni.x -= pushX;
          ni.y -= pushY;
          nj.x += pushX;
          nj.y += pushY;
        }
      }
    }

    // Constraint bounding after each pass
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      // Keep X strictly anchored near actual balance tick (max +/- 2% = 20px)
      const maxDeltaX = 20;
      n.x = Math.max(n.x0 - maxDeltaX, Math.min(n.x0 + maxDeltaX, n.x));
      // Bounding box: X clamped strictly inside boundaries accounting for node radius
      n.x = Math.max(n.radius + 15, Math.min(W - n.radius - 20, n.x));
      // Y clamped strictly inside band headroom so bubbles never overlap header tag or bottom border
      n.y = Math.max(H * 0.28, Math.min(H * 0.74, n.y));
    }
  }

  return nodes.map((n) => ({
    cust: n.cust,
    sizePx: n.sizePx,
    leftPercent: Number(((n.x / W) * 100).toFixed(2)),
    topPercent: Number(((n.y / H) * 100).toFixed(2)),
  }));
}

function CustomerBubbleNode({ cust, leftPercent, topPercent, sizePx, isHovered, onHover, onClick }) {
  // Operational signals (Credit Hold or Broken PTP)
  const hasWarning = cust.creditHold || cust.hasBrokenPtp;
  const warningType = cust.creditHold ? 'hold' : cust.hasBrokenPtp ? 'ptp' : null;
  const warningTitle = cust.creditHold ? 'Credit Hold Active' : cust.hasBrokenPtp ? 'Broken Promise-to-Pay (PTP)' : '';

  // Get customer initials
  const initials = cust.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const formattedBal = cust.openBalance >= 1000000
    ? `$${(cust.openBalance / 1000000).toFixed(1)}M`
    : `$${(cust.openBalance / 1000).toFixed(0)}k`;

  return (
    <div
      className={`customer-bubble-node bubble-zone-${cust.zone} ${isHovered ? 'node-focused' : ''}`}
      style={{
        left: `${leftPercent}%`,
        top: `${topPercent}%`,
        width: `${sizePx}px`,
        height: `${sizePx}px`,
      }}
      onMouseEnter={() => onHover(cust)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(cust)}
      title={`${cust.name} • ${formattedBal}${warningTitle ? ` • [${warningTitle}]` : ''}`}
    >
      <div className="bubble-content">
        <span className="bubble-initials">{initials}</span>
        <span className="bubble-amount">{formattedBal}</span>
      </div>
      {cust.zone === 'red' && <span className="bubble-pulse-ring" />}
      {hasWarning && (
        <span
          className={`node-signal-pip pip-${warningType}`}
          title={warningTitle}
        />
      )}
    </div>
  );
}




