import { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Users,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Award,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import './MyStats.css';

const pct = (v) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(0)}%`);
const days = (v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(1)}d`);

export default function MyStats() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [teamData, setTeamData] = useState([]);
  const [viewMode, setViewMode] = useState('personal'); // 'personal' | 'team'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const isManager = user?.role === 'manager';
  const orgId = user?.orgId;

  useEffect(() => {
    setLoading(true);
    api
      .getMyStats()
      .then((res) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err, 'Could not load your performance stats.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isManager && viewMode === 'team' && orgId) {
      setLoadingTeam(true);
      api
        .getTeamStats(orgId)
        .then((res) => setTeamData(res.data || []))
        .catch((err) => console.error('Could not load team stats:', err))
        .finally(() => setLoadingTeam(false));
    }
  }, [isManager, viewMode, orgId]);

  if (loading) return <p className="empty-state">Loading your stats…</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!data) return null;

  const kept = data.ptpKept ?? 0;
  const broken = data.ptpBroken ?? 0;
  const totalPtps = kept + broken;
  const keptPct = totalPtps > 0 ? Math.round((kept / totalPtps) * 100) : 0;
  const brokenPct = totalPtps > 0 ? 100 - keptPct : 0;

  const reduced = data.dsoDaysReducedEstimate;
  const avgUser = data.avgDaysToPayYourAccounts ?? 0;
  const avgOrg = data.avgDaysToPayOrgWide ?? 0;
  const deltaDays = avgOrg - avgUser; // Positive = faster than org average

  const targetKeptRate = 0.75;
  const isAboveTarget = (data.ptpKeptRate ?? 0) >= targetKeptRate;

  // Max comparison width scale for comparative bars
  const maxDays = Math.max(avgUser, avgOrg, 1);
  const userBarPct = Math.min(100, Math.round((avgUser / maxDays) * 100));
  const orgBarPct = Math.min(100, Math.round((avgOrg / maxDays) * 100));

  return (
    <div className="mystats-page-container">
      {/* Clean B2B Header */}
      <div className="page-header" style={{ alignItems: 'center' }}>
        <h1 className="page-title">My stats</h1>

        {isManager && (
          <div className="mystats-view-switcher">
            <button
              type="button"
              className={`switcher-btn ${viewMode === 'personal' ? 'active' : ''}`}
              onClick={() => setViewMode('personal')}
            >
              <User size={13} strokeWidth={2} />
              <span>My scorecard</span>
            </button>
            <button
              type="button"
              className={`switcher-btn ${viewMode === 'team' ? 'active' : ''}`}
              onClick={() => setViewMode('team')}
            >
              <Users size={13} strokeWidth={2} />
              <span>Team leaderboard</span>
            </button>
          </div>
        )}
      </div>

      {/* Context Identity Strip */}
      <div className="mystats-context-strip">
        <div className="mystats-identity">
          <span className="mystats-user-name">{user?.name || user?.email}</span>
          <span className="mystats-role-tag">
            {user?.role === 'manager'
              ? 'Workspace Manager'
              : user?.role === 'relationship_owner'
              ? 'Relationship Owner'
              : 'Worklist Collector'}
          </span>
          <span className="mystats-org-name">{user?.orgName || 'Workspace'}</span>
        </div>
        <div className="mystats-period-badge">
          <Clock size={12} strokeWidth={2} />
          <span>All-time portfolio activity</span>
        </div>
      </div>

      {viewMode === 'personal' ? (
        <>
          {/* Balanced 4-Card Performance Grid */}
          <div className="mystats-metrics-grid">
            <div className="mystats-card">
              <span className="mystats-card-label">Accounts worked</span>
              <div className="mystats-val-group">
                <span className="mystats-value num">{data.accountsWorked}</span>
              </div>
              <span className="mystats-subtext">Distinct debtor accounts touched</span>
            </div>

            <div className="mystats-card">
              <span className="mystats-card-label">PTP kept-rate</span>
              <div className="mystats-val-group">
                <span className="mystats-value num">{pct(data.ptpKeptRate)}</span>
                {data.ptpKeptRate != null && (
                  <span className={`mystats-pill ${isAboveTarget ? 'pill-good' : 'pill-warn'}`}>
                    {isAboveTarget ? (
                      <>
                        <TrendingUp size={11} strokeWidth={2.5} />
                        <span>Above 75% target</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown size={11} strokeWidth={2.5} />
                        <span>Below 75% target</span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <span className="mystats-subtext">Honored promises across your queue</span>
            </div>

            <div className="mystats-card">
              <span className="mystats-card-label">Estimated DSO-days reduced</span>
              <div className="mystats-val-group">
                <span
                  className="mystats-value num"
                  style={{ color: reduced != null && reduced >= 0 ? 'var(--success-strong)' : 'var(--ink)' }}
                >
                  {reduced != null ? `${reduced >= 0 ? '+' : ''}${Number(reduced).toFixed(1)}d` : '—'}
                </span>
                {reduced != null && reduced > 0 && (
                  <span className="mystats-pill pill-good">
                    <span>Cash accelerated</span>
                  </span>
                )}
              </div>
              <span className="mystats-subtext">Total collection cycle velocity delta</span>
            </div>

            <div className="mystats-card">
              <span className="mystats-card-label">Payment velocity</span>
              <div className="mystats-val-group">
                <span
                  className="mystats-value num"
                  style={{ color: deltaDays >= 0 ? 'var(--success-strong)' : 'var(--danger-strong)' }}
                >
                  {deltaDays >= 0 ? `+${deltaDays.toFixed(1)}d` : `${deltaDays.toFixed(1)}d`}
                </span>
                <span className={`mystats-pill ${deltaDays >= 0 ? 'pill-good' : 'pill-neutral'}`}>
                  {deltaDays >= 0 ? 'Faster than avg' : 'Behind avg'}
                </span>
              </div>
              <span className="mystats-subtext">Collection pace vs. organization baseline</span>
            </div>
          </div>

          {/* Promise-to-Pay Breakdown Panel */}
          <div className="panel" style={{ marginTop: '16px' }}>
            <div className="panel-title-row">
              <span className="panel-title">Promise-to-pay commitment outcomes</span>
              <span className="panel-badge-meta num">{totalPtps} total logged</span>
            </div>

            {totalPtps === 0 ? (
              <p className="empty-state">No PTP commitments logged against your accounts yet.</p>
            ) : (
              <div className="ptp-outcomes-container">
                <div className="mystats-ptp-bar">
                  {kept > 0 && (
                    <div
                      className="mystats-ptp-bar-kept"
                      style={{ width: `${keptPct}%` }}
                      title={`${kept} kept (${keptPct}%)`}
                    >
                      {keptPct >= 15 && <span>{keptPct}%</span>}
                    </div>
                  )}
                  {broken > 0 && (
                    <div
                      className="mystats-ptp-bar-broken"
                      style={{ width: `${brokenPct}%` }}
                      title={`${broken} broken (${brokenPct}%)`}
                    >
                      {brokenPct >= 15 && <span>{brokenPct}%</span>}
                    </div>
                  )}
                </div>

                <div className="mystats-ptp-legend-row">
                  <div className="ptp-legend-item">
                    <span className="mystats-dot mystats-dot-good" />
                    <span className="legend-label">Promises kept:</span>
                    <span className="legend-val num">{kept} ({keptPct}%)</span>
                  </div>
                  <div className="ptp-legend-item">
                    <span className="mystats-dot mystats-dot-bad" />
                    <span className="legend-label">Promises broken:</span>
                    <span className="legend-val num">{broken} ({brokenPct}%)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Days-to-Pay Benchmark Comparison */}
          <div className="panel" style={{ marginTop: '16px' }}>
            <div className="panel-title-row">
              <span className="panel-title">Days-to-pay benchmark</span>
              {deltaDays >= 0 ? (
                <span className="mystats-differential-pill pill-good">
                  <Zap size={12} strokeWidth={2.5} />
                  <span>{deltaDays.toFixed(1)} days faster than team baseline</span>
                </span>
              ) : (
                <span className="mystats-differential-pill pill-warn">
                  <span>{Math.abs(deltaDays).toFixed(1)} days behind team baseline</span>
                </span>
              )}
            </div>

            <div className="benchmark-bars-container">
              {/* Your Accounts Bar */}
              <div className="benchmark-row">
                <div className="benchmark-info">
                  <span className="benchmark-name">Your worked accounts</span>
                  <span className="benchmark-value num">{days(avgUser)}</span>
                </div>
                <div className="benchmark-track">
                  <div
                    className="benchmark-fill benchmark-fill-user"
                    style={{ width: `${userBarPct}%` }}
                  />
                </div>
              </div>

              {/* Organization Wide Bar */}
              <div className="benchmark-row">
                <div className="benchmark-info">
                  <span className="benchmark-name">Organization baseline</span>
                  <span className="benchmark-value num">{days(avgOrg)}</span>
                </div>
                <div className="benchmark-track">
                  <div
                    className="benchmark-fill benchmark-fill-org"
                    style={{ width: `${orgBarPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Team Leaderboard View (for Managers) */
        <div className="panel" style={{ marginTop: '16px' }}>
          <div className="panel-title-row">
            <span className="panel-title">Team performance leaderboard</span>
            <span className="panel-badge-meta num">{teamData.length} team members</span>
          </div>

          {loadingTeam ? (
            <p className="empty-state">Loading team statistics…</p>
          ) : teamData.length === 0 ? (
            <p className="empty-state">No team performance records found.</p>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                  <th>Staff member</th>
                  <th>Role</th>
                  <th className="align-right">Accounts worked</th>
                  <th className="align-right">Touchpoints logged</th>
                  <th className="align-right">PTP kept-rate</th>
                  <th className="align-right">DSO reduction</th>
                </tr>
              </thead>
              <tbody>
                {teamData.map((m, idx) => {
                  const mKeptRate = m.ptpKeptRate;
                  const mReduced = m.dsoDaysReducedEstimate;

                  return (
                    <tr key={m.userId || idx}>
                      <td className="align-center num" style={{ fontWeight: 700, color: idx < 3 ? 'var(--accent)' : 'var(--ink-soft)' }}>
                        #{idx + 1}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{m.name}</span>
                        {m.userId === user?.id && (
                          <span className="status-pill tone-accent" style={{ marginLeft: 6, fontSize: '10px' }}>You</span>
                        )}
                      </td>
                      <td>
                        <span style={{ textTransform: 'capitalize', color: 'var(--ink-soft)', fontSize: '12px' }}>
                          {(m.role || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="align-right num" style={{ fontWeight: 600 }}>
                        {m.accountsWorked ?? 0}
                      </td>
                      <td className="align-right num">{m.communicationsLogged ?? 0}</td>
                      <td className="align-right num" style={{ fontWeight: 600 }}>
                        {pct(mKeptRate)}
                      </td>
                      <td
                        className="align-right num"
                        style={{
                          fontWeight: 700,
                          color: mReduced != null && mReduced >= 0 ? 'var(--success-strong)' : 'var(--ink-soft)',
                        }}
                      >
                        {mReduced != null ? `${mReduced >= 0 ? '+' : ''}${Number(mReduced).toFixed(1)}d` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
