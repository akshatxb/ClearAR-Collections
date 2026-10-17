import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import './Dashboard.css';

const money = (v) =>
  Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const BUCKET_ORDER = ['current', '0-30', '31-60', '61-90', '90+'];
const HEAT_KEY = { current: 'current', '0-30': '0-30', '31-60': '31-60', '61-90': '61-90', '90+': '90plus' };

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const ptpTableRef = useRef(null);

  const [data, setData] = useState(null);
  const [ptpAlerts, setPtpAlerts] = useState([]);
  const [worklistAccounts, setWorklistAccounts] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [coActorTasks, setCoActorTasks] = useState([]);
  const [agingMode, setAgingMode] = useState('count'); // 'count' | 'balance'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.orgId) return;
    setLoading(true);
    Promise.all([
      api.getDashboard(user.orgId),
      api.getPtpAlerts(user.orgId).catch(() => ({ data: [] })),
      api.getWorklist().catch(() => ({ data: [] })),
      api.getOrgDisputes().catch(() => ({ data: [] })),
      api.getEscalationEvents(user.orgId).catch(() => ({ data: [] })),
      api.getCoActorTasks('all').catch(() => ({ data: [] })),
    ])
      .then(([dashRes, ptpRes, worklistRes, disputeRes, escRes, tasksRes]) => {
        setData(dashRes.data);
        setPtpAlerts(ptpRes.data || []);
        setWorklistAccounts(worklistRes.data || []);
        setDisputes(disputeRes.data || []);
        setEscalations(escRes.data || []);
        setCoActorTasks(tasksRes.data || []);
      })
      .catch((err) => setError(apiErrorMessage(err, 'Could not load dashboard data.')))
      .finally(() => setLoading(false));
  }, [user?.orgId]);

  const openDisputes = useMemo(() => {
    return disputes.filter((d) => d.status !== 'resolved');
  }, [disputes]);

  const pendingTasks = useMemo(() => {
    return coActorTasks.filter((t) => t.status !== 'done');
  }, [coActorTasks]);

  const unassignedAccounts = useMemo(() => {
    return worklistAccounts.filter((a) => a.ownershipMode === 'direct' && !a.assignedCollectorId);
  }, [worklistAccounts]);

  // Derive dollar balance per aging bucket from server data or fallback to worklist
  const balanceByBucket = useMemo(() => {
    if (data?.amountByAgingBucket) {
      return data.amountByAgingBucket;
    }
    const map = { current: 0, '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    worklistAccounts.forEach((acc) => {
      const b = acc.agingBucket || 'current';
      if (map[b] !== undefined) {
        map[b] += Number(acc.openBalance || 0);
      }
    });
    return map;
  }, [data?.amountByAgingBucket, worklistAccounts]);

  // Account ID to Name lookup for PTP alerts
  const accountMap = useMemo(() => {
    const map = new Map();
    worklistAccounts.forEach((acc) => {
      map.set(acc.id, acc.name);
    });
    return map;
  }, [worklistAccounts]);

  if (loading) return <p className="empty-state">Loading team dashboard…</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!data) return null;

  const maxCount = Math.max(...Object.values(data.countByAgingBucket || {}), 1);
  const maxBalance = Math.max(...Object.values(balanceByBucket), 1);

  function handleBucketClick(bucket) {
    navigate(`/worklist?agingBucket=${encodeURIComponent(bucket)}`);
  }

  function scrollToPtps() {
    if (ptpTableRef.current) {
      ptpTableRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }

  const totalUrgentItems = ptpAlerts.length + openDisputes.length + escalations.length + pendingTasks.length + unassignedAccounts.length;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="page-title">{data.orgName || user?.orgName || 'Team'} Command Dashboard</h1>
            <span className="badge badge-accent">Creditor HQ</span>
          </div>
        </div>
      </div>

      {/* Unified Manager Action Center Banner */}
      <div className={`action-center-panel${totalUrgentItems > 0 ? ' has-items' : ' is-cleared'}`}>
        <div className="action-center-header">
          <div className="action-center-title-group">
            <span className="action-center-indicator" aria-hidden="true" />
            <h2 className="action-center-title">Manager Action Center</h2>
            <span className={`badge ${totalUrgentItems > 0 ? 'badge-warning' : 'badge-good'}`}>
              {totalUrgentItems === 0
                ? 'All queues clear'
                : `${totalUrgentItems} item${totalUrgentItems === 1 ? '' : 's'} needing review`}
            </span>
          </div>

        </div>

        <div className="action-center-grid">
          {/* 1. Unassigned Accounts */}
          <div
            className={`action-card${unassignedAccounts.length > 0 ? ' action-card-warning' : ''}`}
            onClick={() => navigate('/worklist?unassigned=true')}
            title="Allot unassigned accounts across collector portfolio"
          >
            <span className="action-card-hero">{unassignedAccounts.length}</span>
            <span className="action-card-label">Unassigned accounts</span>
            <span className="action-card-action">Allot portfolio →</span>
          </div>

          {/* 2. PTP Alerts */}
          <div
            className={`action-card${ptpAlerts.length > 0 ? ' action-card-urgent' : ''}`}
            onClick={scrollToPtps}
            title="Scroll to PTP commitments due in the next 24 hours"
          >
            <span className="action-card-hero">{ptpAlerts.length}</span>
            <span className="action-card-label">PTPs due (24h)</span>
            <span className="action-card-action">Review commitments ↓</span>
          </div>

          {/* 3. Open Disputes */}
          <div
            className={`action-card${openDisputes.length > 0 ? ' action-card-urgent' : ''}`}
            onClick={() => navigate('/analytics?tab=disputes')}
            title="Open customer dispute resolution queue"
          >
            <span className="action-card-hero">{openDisputes.length}</span>
            <span className="action-card-label">Open disputes</span>
            <span className="action-card-action">Resolve →</span>
          </div>

          {/* 4. SLA Escalations */}
          <div
            className={`action-card${escalations.length > 0 ? ' action-card-warning' : ''}`}
            onClick={() => navigate('/analytics?tab=escalations')}
            title="Review breached SLA escalation events"
          >
            <span className="action-card-hero">{escalations.length}</span>
            <span className="action-card-label">SLA escalations</span>
            <span className="action-card-action">Triage →</span>
          </div>

          {/* 5. Outreach Requests */}
          <div
            className={`action-card${pendingTasks.length > 0 ? ' action-card-neutral' : ''}`}
            onClick={() => navigate('/tasks')}
            title="Review pending relationship owner outreach tasks"
          >
            <span className="action-card-hero">{pendingTasks.length}</span>
            <span className="action-card-label">Outreach tasks</span>
            <span className="action-card-action">Manage →</span>
          </div>
        </div>
      </div>

      {/* Core Financial & Performance KPIs */}
      <div className="kpi-row" style={{ marginTop: '20px' }}>
        {/* Cash collected — green accent */}
        <div className="kpi-card highlight">
          <span className="kpi-value num">{money(data.cashCollectedMtd || 0)}</span>
          <span className="kpi-label">Cash collected (MTD)</span>
          <span
            className="kpi-sub"
            style={{
              fontSize: '12px',
              color: Number(data.cashCollectedToday || 0) > 0 ? 'var(--accent)' : 'var(--ink-soft)',
              fontWeight: 600,
            }}
          >
            {Number(data.cashCollectedToday || 0) > 0 ? `+${money(data.cashCollectedToday)} collected today` : 'No payments posted today yet'}
          </span>
        </div>

        {/* Open AR balance — blue accent */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <span className="kpi-value num">{money(data.totalOpenBalance)}</span>
          <span className="kpi-label">Total open AR balance</span>
          <span className="kpi-sub" style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
            Across {data.totalAccounts} customer accounts
          </span>
        </div>

        {/* Priority score — amber accent */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <span className="kpi-value num">{Number(data.avgPriorityScore).toFixed(1)}</span>
          <span className="kpi-label">Average priority score</span>
          <span className="kpi-sub" style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>Scale 0–100</span>
        </div>

        {/* Worklist — teal accent (interactive) */}
        <div
          className="kpi-card kpi-card-interactive"
          onClick={() => navigate('/worklist')}
          title="Open entire accounts worklist"
          style={{ borderLeft: '4px solid var(--accent)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-value num">{data.totalAccounts || 0}</span>
            <span className="bucket-drilldown-arrow" aria-hidden="true" style={{ fontSize: '16px' }}>→</span>
          </div>
          <span className="kpi-label">Managed worklist</span>
          <span className="kpi-sub" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 700 }}>
            Open full accounts list →
          </span>
        </div>
      </div>

      {/* Aging Breakdown Panel with Drill-Down */}
      <div className="panel">
        <div className="panel-title-row">
          <span className="panel-title">AR portfolio breakdown by aging bucket</span>
          <div className="aging-mode-toggle">
            <button
              type="button"
              className={`toggle-option${agingMode === 'count' ? ' is-active' : ''}`}
              onClick={() => setAgingMode('count')}
            >
              By account count
            </button>
            <button
              type="button"
              className={`toggle-option${agingMode === 'balance' ? ' is-active' : ''}`}
              onClick={() => setAgingMode('balance')}
            >
              By balance ($)
            </button>
          </div>
        </div>

        <div className="bucket-chart" style={{ marginTop: '14px' }}>
          {BUCKET_ORDER.map((bucket) => {
            const count = data.countByAgingBucket?.[bucket] ?? 0;
            const balance = balanceByBucket[bucket] ?? 0;
            const heatKey = HEAT_KEY[bucket];
            const fillWidth =
              agingMode === 'count'
                ? Math.max(3, (count / maxCount) * 100)
                : Math.max(3, (balance / maxBalance) * 100);

            return (
              <div
                className="bucket-row bucket-row-interactive"
                key={bucket}
                onClick={() => handleBucketClick(bucket)}
                title={`Filter worklist to ${bucket} accounts`}
              >
                <span className="bucket-label">{bucket}</span>
                <div className="bucket-track">
                  <div
                    className="bucket-fill"
                    style={{
                      width: `${fillWidth}%`,
                      background: `var(--heat-${heatKey})`,
                    }}
                  />
                </div>
                <div className="bucket-metric-group">
                  <span className="bucket-count num">
                    {agingMode === 'count' ? count : money(balance)}
                  </span>
                  <span className="bucket-drilldown-arrow" aria-hidden="true">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PTP Alerts Due Soon Panel */}
      <div className="panel" style={{ marginTop: '24px' }} ref={ptpTableRef}>
        <div className="panel-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="panel-title">Promises-to-pay due soon (next 24h)</span>
            <span className={`badge ${ptpAlerts.length > 0 ? 'badge-danger' : 'badge-neutral'}`}>
              {ptpAlerts.length} {ptpAlerts.length === 1 ? 'promise' : 'promises'}
            </span>
          </div>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => navigate('/worklist')}
          >
            View full worklist →
          </button>
        </div>

        {ptpAlerts.length === 0 ? (
          <div className="ptp-empty-notice">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>All customer promises-to-pay are on schedule. No commitments due within 24 hours.</span>
          </div>
        ) : (
          <table className="mini-table" style={{ marginTop: '8px' }}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Promised amount</th>
                <th>Due date</th>
                <th>Status</th>
                <th className="align-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {ptpAlerts.map((ptp) => {
                const accountName = accountMap.get(ptp.accountId) || `Account #${ptp.accountId}`;
                return (
                  <tr key={ptp.id}>
                    <td>
                      <button
                        type="button"
                        className="btn-quiet"
                        style={{ fontWeight: 600, padding: 0 }}
                        onClick={() => navigate(`/accounts/${ptp.accountId}`)}
                      >
                        {accountName}
                      </button>
                    </td>
                    <td className="num font-semibold">{money(ptp.promisedAmount)}</td>
                    <td>{ptp.promisedDate}</td>
                    <td>
                      <span className="status-pill tone-warning">pending</span>
                    </td>
                    <td className="align-right">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="tbl-btn tbl-btn-secondary"
                          onClick={() => navigate(`/accounts/${ptp.accountId}`)}
                        >
                          <Eye size={12} strokeWidth={2} />
                          <span>View account</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending Outreach Requests Panel */}
      <div className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="panel-title">Active outreach requests</span>
            <span className={`badge ${pendingTasks.length > 0 ? 'badge-primary' : 'badge-neutral'}`}>
              {pendingTasks.length} {pendingTasks.length === 1 ? 'request' : 'requests'}
            </span>
          </div>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => navigate('/tasks')}
          >
            View all requests →
          </button>
        </div>

        {pendingTasks.length === 0 ? (
          <div className="ptp-empty-notice">
            <CheckCircle2 size={18} strokeWidth={2} />
            <span>No pending outreach requests in the organization. All co-actor tasks are up to date.</span>
          </div>
        ) : (
          <table className="mini-table" style={{ marginTop: '8px' }}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Requested by</th>
                <th>Assigned to</th>
                <th>Type</th>
                <th>Notes</th>
                <th className="align-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingTasks.slice(0, 5).map((task) => (
                <tr key={task.id}>
                  <td>
                    <button
                      type="button"
                      className="btn-quiet"
                      style={{ fontWeight: 600, padding: 0 }}
                      onClick={() => navigate(`/accounts/${task.accountId}`)}
                    >
                      {task.accountName || `Account #${task.accountId}`}
                    </button>
                  </td>
                  <td>{task.requestedByName || 'Collector'}</td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                      {task.assignedToName || 'Owner'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-primary" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                      {task.requestType || 'outreach'}
                    </span>
                  </td>
                  <td style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {task.notes || '—'}
                  </td>
                  <td className="align-right">
                    <button
                      type="button"
                      className="tbl-btn tbl-btn-secondary"
                      onClick={() => navigate('/tasks')}
                    >
                      <Eye size={12} strokeWidth={2} />
                      <span>Review</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
