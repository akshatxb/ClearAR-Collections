import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Check,
  Copy,
  Lock,
  Mail,
  PhoneCall,
  Voicemail,
  AlertTriangle,
  PhoneOff,
  CreditCard,
  Phone,
  FileX,
  FileText,
  X,
  AlertCircle,
  Bell,
  Share2,
  Plus,
  Sparkles,
  MoreHorizontal,
  ChevronDown,
  Search,
  UserCheck,
} from 'lucide-react';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import AgingBadge from '../../components/AgingBadge';
import StatusPill from '../../components/StatusPill';
import ScoreBreakdown from '../../components/ScoreBreakdown';
import Sparkline from '../../components/Sparkline';
import Modal from '../../components/Modal';
import ComposeEmailModal from '../../components/ComposeEmailModal';
import { useAuth } from '../../context/useAuth';
import { useToast } from '../../context/ToastContext';
import './AccountDetail.css';

const money = (v) =>
  Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const dt = (v) => (v ? new Date(v).toLocaleString() : '—');
const d = (v) => (v ? new Date(v).toLocaleDateString() : '—');

function getDaysDiff(targetDate) {
  if (!targetDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((today - target) / (1000 * 60 * 60 * 24));
}

function getBucketColor(bucket) {
  switch (bucket) {
    case 'current': return '#10b981';
    case '0-30':
    case '1-30': return '#f59e0b';
    case '31-60': return '#f97316';
    case '61-90': return '#ef4444';
    case '90+': return '#b91c1c';
    default: return '#6b7280';
  }
}

function getCommTypeIcon(type) {
  switch (type) {
    case 'call': return <Phone size={11} strokeWidth={2.2} aria-hidden="true" />;
    case 'email': return <Mail size={11} strokeWidth={2.2} aria-hidden="true" />;
    case 'note': return <FileText size={11} strokeWidth={2.2} aria-hidden="true" />;
    default: return <FileText size={11} strokeWidth={2.2} aria-hidden="true" />;
  }
}

function CommNoteBody({ content }) {
  const [expanded, setExpanded] = useState(false);
  if (!content) return <em>No content</em>;
  const isLong = content.length > 180 || content.split('\n').length > 3;
  return (
    <div>
      <p className={!expanded && isLong ? 'comm-note-clamped' : ''}>{content}</p>
      {isLong && (
        <button
          type="button"
          className="comm-show-more-btn"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export default function AccountDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [detail, setDetail] = useState(null);
  const [communications, setCommunications] = useState([]);
  const [ptps, setPtps] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [aging, setAging] = useState(null);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [writeOffTarget, setWriteOffTarget] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [talkingPoints, setTalkingPoints] = useState(null);
  const [talkingPointsLoading, setTalkingPointsLoading] = useState(false);
  const [commFilter, setCommFilter] = useState('all');
  const [copiedKey, setCopiedKey] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    return sessionStorage.getItem(`account_readonly_dismissed_${id}`) === 'true';
  });

  function handleDismissBanner() {
    setBannerDismissed(true);
    sessionStorage.setItem(`account_readonly_dismissed_${id}`, 'true');
  }

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    if (!moreMenuOpen) return;
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreMenuOpen]);

  function copyToClipboard(text, key) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    const labelMap = {
      phone: 'phone number',
      email: 'email address',
      link: 'account direct link',
    };
    toast.success(`Copied ${labelMap[key] || 'text'} to clipboard`);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  const filteredCommunications = useMemo(() => {
    if (commFilter === 'all') return communications;
    return communications.filter((c) => c.type === commFilter);
  }, [communications, commFilter]);

  const groupedCommunications = useMemo(() => {
    const groups = [];
    const map = new Map();
    filteredCommunications.forEach((c) => {
      const dateKey = c.createdAt
        ? new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Earlier';
      if (!map.has(dateKey)) {
        const groupObj = { date: dateKey, items: [] };
        map.set(dateKey, groupObj);
        groups.push(groupObj);
      }
      map.get(dateKey).items.push(c);
    });
    return groups;
  }, [filteredCommunications]);

  const commCounts = useMemo(() => {
    const counts = { all: communications.length, call: 0, email: 0, note: 0 };
    communications.forEach((c) => {
      if (counts[c.type] !== undefined) counts[c.type]++;
      else counts[c.type] = 1;
    });
    return counts;
  }, [communications]);

  const [usersMap, setUsersMap] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [detailRes, commsRes, ptpRes, disputeRes, agingRes, scoreHistRes, usersRes] = await Promise.all([
        api.getAccountDetail(id),
        api.getCommunications(id),
        api.getPtps(id),
        api.getDisputes(id),
        api.getAccountAging(id),
        api.getScoreHistory(id),
        api.listUsers().catch(() => ({ data: [] })),
      ]);
      setDetail(detailRes.data);
      setCommunications(commsRes.data);
      setPtps(ptpRes.data);
      setDisputes(disputeRes.data);
      setAging(agingRes.data);
      setScoreHistory(scoreHistRes.data);
      if (usersRes?.data && Array.isArray(usersRes.data)) {
        const map = {};
        usersRes.data.forEach((u) => {
          map[u.id] = u.name || u.email;
        });
        setUsersMap(map);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load this account.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const getAuthorName = useCallback((c) => {
    if (c.createdByName) return c.createdByName;
    if (c.createdBy && usersMap[c.createdBy]) return usersMap[c.createdBy];
    if (user?.userId && Number(user.userId) === Number(c.createdBy)) {
      return user.name || user.fullName || user.username || 'You';
    }
    return c.createdBy ? `User #${c.createdBy}` : null;
  }, [usersMap, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRequestOutreach() {
    if (isIndirect && !account.relationshipOwnerId) {
      toast.error('Cannot request outreach: No relationship owner is assigned to this account. Please ask a manager to assign an owner first.');
      return;
    }
    setBusyAction('outreach');
    try {
      const { data } = await api.requestOutreach(id);
      if (data.routedTo === 'direct') {
        toast.success('Direct account — reminder sent.');
      } else {
        toast.success(`Outreach task #${data.taskId} created for the relationship owner.`);
      }
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not request outreach.'));
    } finally {
      setBusyAction('');
    }
  }

  async function handleSendReminder() {
    setBusyAction('reminder');
    try {
      await api.sendReminder(id);
      toast.success('Reminder sent and logged.');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send reminder.'));
    } finally {
      setBusyAction('');
    }
  }

  async function handleShowTalkingPoints() {
    setModal('talkingPoints');
    if (talkingPoints !== null) return;
    setTalkingPointsLoading(true);
    try {
      const { data } = await api.getTalkingPoints(id);
      setTalkingPoints(data);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not generate talking points.'));
      setModal(null);
    } finally {
      setTalkingPointsLoading(false);
    }
  }

  async function handleConfirmWriteOff() {
    if (!writeOffTarget) return;
    const invoiceId = writeOffTarget.id;
    setBusyAction(`writeoff-${invoiceId}`);
    try {
      await api.writeOffInvoice(id, invoiceId);
      toast.success(`Invoice #${invoiceId} written off.`);
      setWriteOffTarget(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not write off this invoice.'));
    } finally {
      setBusyAction('');
    }
  }

  const openInvoices = useMemo(() => {
    if (!detail?.invoices) return [];
    return detail.invoices.filter((i) => i.status !== 'paid' && i.status !== 'written_off');
  }, [detail]);

  const openInvoicesTotal = useMemo(() => {
    return openInvoices.reduce((sum, i) => sum + Number(i.remainingBalance ?? i.remainingAmount ?? i.amount ?? 0), 0);
  }, [openInvoices]);

  const filteredInvoices = useMemo(() => {
    if (!detail?.invoices) return [];
    if (!invoiceSearch.trim()) return detail.invoices;
    const q = invoiceSearch.trim().toLowerCase();
    return detail.invoices.filter((inv) =>
      String(inv.id).toLowerCase().includes(q) ||
      String(inv.amount).toLowerCase().includes(q) ||
      String(inv.remainingBalance ?? '').toLowerCase().includes(q) ||
      (inv.status && inv.status.toLowerCase().includes(q)) ||
      (inv.agingBucket && inv.agingBucket.toLowerCase().includes(q))
    );
  }, [detail?.invoices, invoiceSearch]);

  const agingDistribution = useMemo(() => {
    if (!aging?.byBucket) return { total: 0, segments: [] };
    const entries = Object.entries(aging.byBucket);
    const total = entries.reduce((acc, [, val]) => acc + Number(val || 0), 0);
    if (total <= 0) return { total: 0, segments: [] };
    const segments = entries
      .map(([bucket, val]) => ({
        bucket,
        amount: Number(val || 0),
        pct: ((Number(val || 0) / total) * 100).toFixed(1),
      }))
      .filter((s) => s.amount > 0);
    return { total, segments };
  }, [aging]);

  if (loading) {
    return (
      <div className="account-skeleton-container" role="status" aria-busy="true" aria-label="Loading account details">
        <div className="skeleton-box" style={{ width: 100, height: 28 }} />
        <div className="skeleton-box" style={{ width: '100%', height: 160 }} />
        <div className="skeleton-box" style={{ width: '100%', height: 48 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="skeleton-box" style={{ width: '100%', height: 140 }} />
            <div className="skeleton-box" style={{ width: '100%', height: 260 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="skeleton-box" style={{ width: '100%', height: 180 }} />
            <div className="skeleton-box" style={{ width: '100%', height: 140 }} />
          </div>
        </div>
      </div>
    );
  }
  if (error && !detail) return <p className="error-text">{error}</p>;
  if (!detail) return null;

  const { account, invoices, openBalance, agingBucket, scoreBreakdown, priorityScore, recentCommunications } = detail;

  const currentUserId = user?.userId ?? user?.id;
  const isRelationshipOwner = user?.role === 'relationship_owner';
  const isAssignedOwner = isRelationshipOwner && Boolean(
    account?.relationshipOwnerId &&
    currentUserId &&
    Number(account.relationshipOwnerId) === Number(currentUserId)
  );
  const isReadOnlyForOwner = isRelationshipOwner && !isAssignedOwner;
  const isIndirect = account.ownershipMode === 'indirect';
  const isManager = user?.role === 'manager';
  const canSendEmail = isManager || isAssignedOwner || (!isRelationshipOwner && !isIndirect);
  const canSendReminder = !isIndirect && !isRelationshipOwner;
  const canRequestOutreach = isIndirect && !isRelationshipOwner;

  return (
    <div>
      <Link to="/worklist" className="back-link">← Worklist</Link>

      <div className="account-hero-card" data-aging-severity={agingBucket || 'current'}>
        <div className="account-hero-main">
          <div className="account-title-row">
            <h1 className="account-title">{account.name}</h1>
            <div className="account-badges">
              {account.creditHold && (
                <span className="hold-flag hold-flag-lg" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Lock size={12} aria-hidden="true" /> Credit Hold
                </span>
              )}
              <span className="account-ownership-pill">{account.ownershipMode}</span>
              {account.relationshipOwnerId && usersMap[account.relationshipOwnerId] && (
                <span className="account-ownership-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <UserCheck size={12} aria-hidden="true" />
                  <span>Owner: {detail.relationshipOwnerName || usersMap[account.relationshipOwnerId]}</span>
                </span>
              )}
              {account.assignedCollectorId ? (
                <span className="account-ownership-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <UserCheck size={12} color="var(--accent)" aria-hidden="true" />
                  <span>Collector: {detail.assignedCollectorName || usersMap[account.assignedCollectorId] || `Collector #${account.assignedCollectorId}`}</span>
                </span>
              ) : (
                account.ownershipMode === 'direct' && (
                  <span className="badge badge-warning" style={{ fontSize: '11px', padding: '3px 8px' }}>
                    Unassigned Collector
                  </span>
                )
              )}
              {user?.role === 'manager' && (
                <button
                  type="button"
                  className="btn-credit-hold-toggle"
                  onClick={() => setModal('assignCollector')}
                >
                  {account.assignedCollectorId ? 'Reassign collector' : 'Assign collector'}
                </button>
              )}
              {user?.role === 'manager' && (
                <button
                  type="button"
                  className="btn-credit-hold-toggle"
                  onClick={() => setModal('reassignOwner')}
                >
                  {account.relationshipOwnerId ? 'Reassign owner' : 'Assign owner'}
                </button>
              )}
              {user?.role === 'manager' && (
                <button
                  type="button"
                  className="btn-credit-hold-toggle"
                  onClick={() => setModal('creditHold')}
                >
                  {account.creditHold ? 'Release credit hold' : 'Place credit hold'}
                </button>
              )}
              <button
                type="button"
                className="btn-credit-hold-toggle"
                onClick={() => copyToClipboard(window.location.href, 'link')}
                title="Copy direct link to this account"
              >
                {copiedKey === 'link' ? (
                  <Check size={12} color="var(--accent)" style={{ marginRight: 4 }} />
                ) : (
                  <Share2 size={12} style={{ marginRight: 4 }} />
                )}
                <span>{copiedKey === 'link' ? 'Copied' : 'Share link'}</span>
              </button>
            </div>
          </div>

          <div className="account-contact-bar">
            {account.contactPhone ? (
              <div className="contact-chip">
                <span className="contact-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Phone size={13} aria-hidden="true" />
                </span>
                <a href={`tel:${account.contactPhone}`} className="contact-link" title="Click to call">
                  {account.contactPhone}
                </a>
                <button
                  type="button"
                  className="contact-copy-btn"
                  onClick={() => copyToClipboard(account.contactPhone, 'phone')}
                  title="Copy phone number"
                  aria-label="Copy phone number"
                >
                  {copiedKey === 'phone' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                      <span>Copied</span>
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Copy size={11} strokeWidth={2} aria-hidden="true" />
                      <span>Copy</span>
                    </span>
                  )}
                </button>
              </div>
            ) : (
              <span className="contact-empty">No phone on file</span>
            )}

            {account.contactEmail ? (
              <div className="contact-chip">
                <span className="contact-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Mail size={13} aria-hidden="true" />
                </span>
                <a href={`mailto:${account.contactEmail}`} className="contact-link" title="Click to email">
                  {account.contactEmail}
                </a>
                <button
                  type="button"
                  className="contact-copy-btn"
                  onClick={() => copyToClipboard(account.contactEmail, 'email')}
                  title="Copy email address"
                  aria-label="Copy email address"
                >
                  {copiedKey === 'email' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                      <span>Copied</span>
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Copy size={11} strokeWidth={2} aria-hidden="true" />
                      <span>Copy</span>
                    </span>
                  )}
                </button>
              </div>
            ) : (
              <span className="contact-empty">No email on file</span>
            )}

            {account.creditTerms && (
              <span className="badge badge-neutral">Terms: {account.creditTerms}</span>
            )}
          </div>
        </div>

        {/* Hero KPI Strip: 3-column balanced cards */}
        <div className="account-hero-kpis">
          <div className="hero-kpi-card">
            <span className="hero-kpi-label">Open Balance</span>
            <span className="hero-kpi-value num">{money(openBalance)}</span>
          </div>
          <div className="hero-kpi-card">
            <span className="hero-kpi-label">Aging Status</span>
            <div className="hero-kpi-badge-wrap">
              <AgingBadge bucket={agingBucket} large />
            </div>
          </div>
          <div className="hero-kpi-card">
            <span className="hero-kpi-label">Priority Score</span>
            <span className="hero-kpi-value num">{priorityScore != null ? Number(priorityScore).toFixed(1) : '—'}</span>
          </div>
        </div>
      </div>

      {isReadOnlyForOwner && !bannerDismissed && (
        <div className="notice-banner--warning" role="alert">
          <div className="notice-banner-content">
            <Lock size={16} strokeWidth={2} style={{ flexShrink: 0 }} aria-hidden="true" />
            <span>
              <strong>Read-Only Mode:</strong> This account is outside your assigned relationship portfolio. Outreach and communication actions are restricted to the assigned owner.
            </span>
          </div>
          <button
            type="button"
            className="notice-dismiss-btn"
            onClick={handleDismissBanner}
            title="Dismiss notification for this session"
            aria-label="Dismiss read-only notification"
          >
            <X size={14} aria-hidden="true" />
            <span>Dismiss</span>
          </button>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}

      <div className="account-actions-toolbar">
        <div className="actions-primary-cluster">
          {!isReadOnlyForOwner && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-action-item"
                onClick={() => setModal('note')}
              >
                <PhoneCall size={14} strokeWidth={2} aria-hidden="true" />
                <span>Log call / Note</span>
              </button>
              <button
                type="button"
                className="btn btn-action-item"
                onClick={() => setModal('ptp')}
              >
                <Check size={14} strokeWidth={2} aria-hidden="true" />
                <span>Promise to pay</span>
              </button>
            </>
          )}

          {canSendEmail && (
            <button
              type="button"
              className="btn btn-action-item"
              onClick={() => setModal('composeEmail')}
            >
              <Mail size={14} strokeWidth={2} aria-hidden="true" />
              <span>Send email</span>
            </button>
          )}

          {canSendReminder && (
            <button
              type="button"
              className="btn btn-action-item"
              onClick={handleSendReminder}
              disabled={busyAction === 'reminder'}
            >
              {busyAction === 'reminder' ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <Bell size={14} strokeWidth={2} aria-hidden="true" />
                  <span>Send reminder</span>
                </>
              )}
            </button>
          )}

          {canRequestOutreach && (
            <button
              type="button"
              className="btn btn-action-item"
              onClick={handleRequestOutreach}
              disabled={busyAction === 'outreach'}
              title="Request diplomatic outreach from the assigned relationship owner"
            >
              <Share2 size={14} strokeWidth={2} aria-hidden="true" />
              <span>{busyAction === 'outreach' ? 'Routing outreach…' : 'Request outreach'}</span>
            </button>
          )}
        </div>

        <div className="actions-utility-cluster">
          <div className="more-actions-menu-container" ref={moreMenuRef}>
            <button
              type="button"
              className={`btn btn-action-item btn-more-toggle ${moreMenuOpen ? 'active' : ''}`}
              onClick={() => setMoreMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={moreMenuOpen}
              id="more-actions-btn"
            >
              <MoreHorizontal size={15} aria-hidden="true" />
              <span>More</span>
              <ChevronDown size={13} aria-hidden="true" className={moreMenuOpen ? 'rotate-180' : ''} />
            </button>

            {moreMenuOpen && (
              <div className="more-actions-dropdown" role="menu" aria-labelledby="more-actions-btn">
                <div className="more-dropdown-header">Additional Tools</div>
                <button
                  type="button"
                  role="menuitem"
                  className="more-dropdown-item"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    handleShowTalkingPoints();
                  }}
                >
                  <Sparkles size={14} className="dropdown-item-icon" aria-hidden="true" />
                  <span>Talking points</span>
                </button>

                {!isReadOnlyForOwner && (
                  <button
                    type="button"
                    role="menuitem"
                    className="more-dropdown-item"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setModal('dispute');
                    }}
                  >
                    <AlertTriangle size={14} className="dropdown-item-icon" aria-hidden="true" />
                    <span>Open dispute</span>
                  </button>
                )}

                {!isRelationshipOwner && (
                  <button
                    type="button"
                    role="menuitem"
                    className="more-dropdown-item"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      handleRequestOutreach();
                    }}
                    disabled={busyAction === 'outreach'}
                  >
                    <Share2 size={14} className="dropdown-item-icon" aria-hidden="true" />
                    <span>{busyAction === 'outreach' ? 'Routing outreach…' : 'Request outreach'}</span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  className="more-dropdown-item"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setModal('handoff');
                  }}
                >
                  <FileText size={14} className="dropdown-item-icon" aria-hidden="true" />
                  <span>Handoff summary</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="account-grid">
        <div className="account-main">
          {/* Executive Aging & Exposure Card */}
          <div className="panel aging-executive-panel">
            <div className="panel-title-row" style={{ marginBottom: 12 }}>
              <span className="panel-title" style={{ margin: 0 }}>Aging Analysis</span>
              {agingDistribution.total > 0 && (
                <span className="panel-title-meta num">
                  Total Ledger: {money(agingDistribution.total)}
                </span>
              )}
            </div>

            <div className="aging-bucket-grid">
              {aging &&
                Object.entries(aging.byBucket).map(([bucket, amount]) => {
                  const numAmount = Number(amount || 0);
                  const pctShare =
                    agingDistribution.total > 0
                      ? ((numAmount / agingDistribution.total) * 100).toFixed(0)
                      : 0;
                  return (
                    <div className="aging-bucket-cell" key={bucket} data-bucket={bucket}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <AgingBadge bucket={bucket} />
                        <span className="aging-bucket-pct num">{pctShare}%</span>
                      </div>
                      <span className="aging-bucket-amount num">{money(amount)}</span>
                    </div>
                  );
                })}
            </div>

            {agingDistribution.total > 0 && (
              <div className="aging-stacked-bar-container">
                <div
                  className="aging-stacked-bar"
                  role="progressbar"
                  aria-valuenow={100}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Debt distribution across aging buckets"
                >
                  {agingDistribution.segments.map((seg) => (
                    <div
                      key={seg.bucket}
                      className="aging-stacked-segment"
                      data-bucket={seg.bucket}
                      style={{ width: `${seg.pct}%` }}
                      title={`${seg.bucket}: ${money(seg.amount)} (${seg.pct}%)`}
                    />
                  ))}
                </div>
                <div className="aging-stacked-legend">
                  {agingDistribution.segments.map((seg) => (
                    <span key={seg.bucket} className="aging-stacked-legend-item">
                      <span className="aging-legend-dot" style={{ backgroundColor: getBucketColor(seg.bucket) }} />
                      <span>{seg.bucket}: {seg.pct}% ({money(seg.amount)})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Invoices Panel */}
          <div className="panel">
            <div className="panel-title-row" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="panel-title" style={{ margin: 0 }}>Invoices</span>
                <span className="panel-title-meta num">
                  {money(openBalance)} open · <AgingBadge bucket={agingBucket} />
                </span>
              </div>

              <div className="invoice-panel-header-actions">
                <div className="invoice-search-input-wrap">
                  <Search size={12} className="invoice-search-icon" aria-hidden="true" />
                  <input
                    type="text"
                    className="invoice-search-input"
                    placeholder="Search invoices…"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                  />
                  {invoiceSearch && (
                    <button
                      type="button"
                      className="invoice-search-clear"
                      onClick={() => setInvoiceSearch('')}
                      aria-label="Clear search"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                {!isReadOnlyForOwner && (
                  <button
                    type="button"
                    className="btn btn-primary btn-action-item"
                    onClick={() => setModal('invoice')}
                    style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                  >
                    <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
                    <span>Add invoice</span>
                  </button>
                )}
              </div>
            </div>

            {filteredInvoices.length === 0 ? (
              <p className="empty-state">No invoices found matching your criteria.</p>
            ) : (
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Due</th>
                    <th>Aging</th>
                    <th>Status</th>
                    <th className="align-right">Balance / Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => {
                    const diffDays = getDaysDiff(inv.dueDate);
                    const isUnpaid = inv.status !== 'paid' && inv.status !== 'written_off';
                    const isOverdue = isUnpaid && (inv.agingBucket !== 'current' || (diffDays != null && diffDays > 0));
                    return (
                      <tr key={inv.id} className={isOverdue ? 'invoice-row-overdue' : ''}>
                        <td>
                          <div className="invoice-chip">
                            <span className="num font-mono">#{inv.id}</span>
                            <button
                              type="button"
                              className="invoice-copy-btn"
                              onClick={() => copyToClipboard(String(inv.id), `inv-${inv.id}`)}
                              title="Copy invoice number"
                              aria-label={`Copy invoice number ${inv.id}`}
                            >
                              {copiedKey === `inv-${inv.id}` ? (
                                <Check size={11} strokeWidth={2.5} aria-hidden="true" style={{ color: 'var(--accent)' }} />
                              ) : (
                                <Copy size={11} strokeWidth={2} aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td>
                          <div>{d(inv.dueDate)}</div>
                          {isUnpaid && diffDays != null && (
                            <div>
                              {diffDays > 0 ? (
                                <span className="overdue-tag">{diffDays}d overdue</span>
                              ) : diffDays === 0 ? (
                                <span className="overdue-tag" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#92400e' }}>
                                  Due today
                                </span>
                              ) : (
                                <span className="upcoming-tag">Due in {Math.abs(diffDays)}d</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <AgingBadge bucket={inv.agingBucket} />
                        </td>
                        <td>
                          <StatusPill value={inv.status} />
                        </td>
                        <td className="align-right num">
                          {inv.remainingBalance != null && Number(inv.remainingBalance) < Number(inv.amount) && inv.status !== 'paid' && inv.status !== 'written_off' ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>{money(inv.remainingBalance)}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                orig. {money(inv.amount)}
                              </div>
                            </div>
                          ) : (
                            <div>{money(inv.status === 'paid' ? inv.amount : (inv.remainingBalance ?? inv.amount))}</div>
                          )}
                        </td>
                        <td className="align-right">
                          <div className="row-actions">
                            {!isReadOnlyForOwner && inv.status !== 'paid' && inv.status !== 'written_off' && (
                              <button
                                type="button"
                                className="tbl-btn tbl-btn-success"
                                onClick={() => {
                                  setModal(null);
                                  setPaymentTarget(inv.id);
                                }}
                              >
                                <CreditCard size={12} strokeWidth={2} aria-hidden="true" />
                                <span>Record payment</span>
                              </button>
                            )}
                            {user?.role === 'manager' && inv.status !== 'paid' && inv.status !== 'written_off' && (
                              <button
                                type="button"
                                className="tbl-btn tbl-btn-danger"
                                onClick={() => setWriteOffTarget(inv)}
                                disabled={busyAction === `writeoff-${inv.id}`}
                              >
                                <FileX size={12} strokeWidth={2} aria-hidden="true" />
                                <span>{busyAction === `writeoff-${inv.id}` ? 'Writing off…' : 'Write off'}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>
                      <strong>Open total ({openInvoices.length} {openInvoices.length === 1 ? 'invoice' : 'invoices'})</strong>
                    </td>
                    <td className="align-right num">
                      <strong>{money(openInvoicesTotal)}</strong>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <div className="panel">
            <span className="panel-title">Promises to pay</span>
            {ptps.length === 0 ? (
              <p className="empty-state">No promises to pay logged.</p>
            ) : (
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Promised</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ptps.map((p) => (
                    <PtpRow key={p.id} ptp={p} onUpdated={load} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <span className="panel-title">Disputes</span>
            {disputes.length === 0 ? (
              <p className="empty-state">No disputes on this account.</p>
            ) : (
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Opened</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((disp) => (
                    <DisputeRow key={disp.id} dispute={disp} onUpdated={load} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <div className="panel-title-row">
              <span className="panel-title">Communication history</span>
              <div className="comm-filter-tabs" role="tablist" aria-label="Filter communication types">
                {['all', 'call', 'email', 'note'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={commFilter === f}
                    className={`comm-tab ${commFilter === f ? 'active' : ''}`}
                    onClick={() => setCommFilter(f)}
                  >
                    {f === 'all' ? 'All' : f === 'call' ? 'Calls' : f === 'email' ? 'Emails' : 'Notes'}
                    <span className="comm-tab-count">{commCounts[f] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
            {filteredCommunications.length === 0 ? (
              <p className="empty-state">No communications found for this filter.</p>
            ) : (
              <ul className="comm-list">
                {groupedCommunications.map((group) => (
                  <li key={group.date} className="comm-group">
                    <div className="timeline-date-divider">
                      <span className="timeline-date-pill">{group.date}</span>
                    </div>
                    {group.items.map((c) => (
                      <div key={c.id} className="comm-item" style={{ marginBottom: 12 }}>
                        <span className={`comm-type comm-type-${c.type}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {getCommTypeIcon(c.type)}
                          <span>{c.type}</span>
                        </span>
                        <div className="comm-body">
                          <CommNoteBody content={c.content} />
                          <div className="comm-meta">
                            <span className="num">{dt(c.createdAt)}</span>
                            {getAuthorName(c) && (
                              <span className="comm-author" style={{ marginLeft: 8 }}>
                                · Logged by: {getAuthorName(c)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="account-side">
          <div className="panel">
            <span className="panel-title">Score breakdown</span>
            <ScoreBreakdown factors={scoreBreakdown} totalScore={priorityScore} />
          </div>
          <div className="panel">
            <span className="panel-title">Score history</span>
            <Sparkline points={scoreHistory} />
          </div>
          <div className="panel">
            <span className="panel-title">Recent activity</span>
            {recentCommunications.length === 0 ? (
              <p className="empty-state">Nothing recent.</p>
            ) : (
              <ul className="comm-list comm-list-compact">
                {recentCommunications.map((c) => (
                  <li key={c.id} className="comm-item">
                    <span className={`comm-type comm-type-${c.type}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {getCommTypeIcon(c.type)}
                      <span>{c.type}</span>
                    </span>
                    <div className="comm-body">
                      <CommNoteBody content={c.content} />
                      <div className="comm-meta">
                        <span className="num">{dt(c.createdAt)}</span>
                        {getAuthorName(c) && (
                          <span className="comm-author" style={{ marginLeft: 8 }}>
                            · Logged by: {getAuthorName(c)}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {modal === 'note' && (
        <LogNoteModal accountId={id} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {modal === 'ptp' && (
        <CreatePtpModal
          accountId={id}
          openInvoices={openInvoices}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
      {modal === 'dispute' && (
        <CreateDisputeModal
          accountId={id}
          openInvoices={openInvoices}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
      {modal === 'invoice' && (
        <CreateInvoiceModal accountId={id} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {paymentTarget && (
        <RecordPaymentModal
          invoiceId={paymentTarget}
          invoice={detail?.invoices?.find((i) => i.id === paymentTarget)}
          onClose={() => setPaymentTarget(null)}
          onSaved={() => { setPaymentTarget(null); load(); }}
        />
      )}
      {modal === 'talkingPoints' && (
        <Modal title="Suggested talking points" onClose={() => setModal(null)}>
          {talkingPointsLoading && <p className="empty-state">Generating…</p>}
          {!talkingPointsLoading && (!talkingPoints || talkingPoints.length === 0) && (
            <p className="empty-state">No suggestions available.</p>
          )}
          {!talkingPointsLoading && talkingPoints && talkingPoints.length > 0 && (
            <ul className="talking-points-list">
              {talkingPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
        </Modal>
      )}
      {modal === 'handoff' && (
        <HandoffSummaryModal accountId={id} onClose={() => setModal(null)} />
      )}
      {modal === 'creditHold' && (
        <CreditHoldModal
          account={account}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
      {modal === 'assignCollector' && (
        <AssignCollectorModal
          account={account}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
      {modal === 'reassignOwner' && (
        <ReassignOwnerModal
          account={account}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
      {modal === 'composeEmail' && (
        <ComposeEmailModal
          accountId={Number(id)}
          accountName={account?.companyName}
          defaultRecipient={account?.contactEmail}
          invoices={invoices}
          onClose={() => setModal(null)}
          onSent={() => {
            toast.success('Email sent successfully!');
            load();
          }}
        />
      )}
      {writeOffTarget && (
        <ConfirmWriteOffModal
          invoice={writeOffTarget}
          onClose={() => setWriteOffTarget(null)}
          onConfirm={handleConfirmWriteOff}
          busy={busyAction === `writeoff-${writeOffTarget.id}`}
        />
      )}
    </div>
  );
}

function PtpRow({ ptp, onUpdated }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const diffDays = getDaysDiff(ptp.promisedDate);
  const isOverdue = diffDays != null && diffDays > 0 && ptp.status === 'pending';

  async function handleMark(status) {
    setBusy(true);
    try {
      await api.updatePtpStatus(ptp.id, status);
      toast.success(`Promise to pay marked as ${status}.`);
      onUpdated();
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not mark promise as ${status}.`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className={isOverdue ? 'ptp-row-overdue' : ''}>
      <td>
        <div>{d(ptp.promisedDate)}</div>
        {diffDays != null && (
          <span className={`ptp-relative-due ${isOverdue ? 'is-overdue' : ''}`}>
            {diffDays > 0 ? `${diffDays}d overdue` : diffDays === 0 ? 'Due today' : `Due in ${Math.abs(diffDays)}d`}
          </span>
        )}
      </td>
      <td className="num">
        <div>{money(ptp.promisedAmount)}</div>
        {ptp.invoiceId && (
          <span className="invoice-chip" style={{ fontSize: '11px', display: 'inline-flex', marginTop: '2px' }}>
            Invoice #{ptp.invoiceId}
          </span>
        )}
      </td>
      <td>
        <StatusPill value={ptp.status} />
      </td>
      <td className="align-right">
        {ptp.status === 'pending' && (
          <div style={{ display: 'inline-flex', gap: '6px' }}>
            <button
              type="button"
              className="btn-quiet"
              style={{ color: '#059669', fontWeight: 600 }}
              disabled={busy}
              onClick={() => handleMark('kept')}
              title="Mark Promise Kept"
            >
              Kept
            </button>
            <button
              type="button"
              className="btn-quiet"
              style={{ color: '#e11d48', fontWeight: 600 }}
              disabled={busy}
              onClick={() => handleMark('broken')}
              title="Mark Promise Broken"
            >
              Broken
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function DisputeRow({ dispute, onUpdated }) {
  const [reasonCodes, setReasonCodes] = useState([]);
  const [resolving, setResolving] = useState(false);
  const [reasonCodeId, setReasonCodeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (resolving && reasonCodes.length === 0) {
      api.getReasonCodes().then((res) => setReasonCodes(res.data)).catch(() => {});
    }
  }, [resolving, reasonCodes.length]);

  async function submitResolve(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.updateDispute(dispute.id, { status: 'resolved', reasonCodeId: Number(reasonCodeId) });
      onUpdated();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not resolve dispute.'));
    } finally {
      setBusy(false);
    }
  }

  async function markInvestigating() {
    setBusy(true);
    try {
      await api.updateDispute(dispute.id, { status: 'investigating' });
      onUpdated();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update dispute.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        <div>{dispute.reason}</div>
        {(dispute.reasonCodeLabel || dispute.invoiceId) && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
            {dispute.reasonCodeLabel && (
              <span className="badge" style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px' }}>
                {dispute.reasonCodeLabel}
              </span>
            )}
            {dispute.invoiceId && (
              <span className="invoice-chip" style={{ fontSize: '11px' }}>
                Invoice #{dispute.invoiceId}
              </span>
            )}
          </div>
        )}
      </td>
      <td>
        <StatusPill value={dispute.status} />
      </td>
      <td>{d(dispute.createdAt)}</td>
      <td className="align-right">
        {dispute.status === 'open' && (
          <button type="button" className="btn-quiet" onClick={markInvestigating} disabled={busy}>
            Investigate
          </button>
        )}
        {dispute.status !== 'resolved' && !resolving && (
          <button type="button" className="btn-quiet" onClick={() => setResolving(true)}>
            Resolve
          </button>
        )}
        {resolving && (
          <form onSubmit={submitResolve} className="inline-resolve-form">
            <select value={reasonCodeId} onChange={(e) => setReasonCodeId(e.target.value)} required>
              <option value="">Reason code…</option>
              {reasonCodes.map((rc) => (
                <option key={rc.id} value={rc.id}>
                  {rc.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-quiet" disabled={busy || !reasonCodeId}>
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </form>
        )}
        {error && <span className="error-text">{error}</span>}
      </td>
    </tr>
  );
}

function HandoffSummaryModal({ accountId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getHandoffSummary(accountId)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err, 'Could not load handoff summary.')))
      .finally(() => setLoading(false));
  }, [accountId]);

  return (
    <Modal title="Handoff summary" onClose={onClose} width={520}>
      {loading && <p className="empty-state">Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {data && (
        <div className="handoff-summary">
          <div className="handoff-row">
            <span className="handoff-label">Open balance</span>
            <span className="num">{money(data.openBalance)}</span>
          </div>
          <div className="handoff-row">
            <span className="handoff-label">Aging bucket</span>
            <AgingBadge bucket={data.agingBucket} />
          </div>
          <div className="handoff-row">
            <span className="handoff-label">Priority score</span>
            <span className="num">{Number(data.priorityScore).toFixed(1)}</span>
          </div>

          <div className="handoff-section">
            <span className="panel-title">Last contact</span>
            {data.lastContact ? (
              <p>
                <span className={`comm-type comm-type-${data.lastContact.type}`}>{data.lastContact.type}</span>{' '}
                {data.lastContact.content || <em>No content</em>} — <span className="num">{dt(data.lastContact.createdAt)}</span>
              </p>
            ) : (
              <p className="empty-state">No contact logged yet.</p>
            )}
          </div>

          <div className="handoff-section">
            <span className="panel-title">Promise-to-pay history</span>
            {data.ptpHistory?.length ? (
              <ul className="comm-list-compact">
                {data.ptpHistory.map((p) => (
                  <li key={p.id}>
                    {d(p.promisedDate)} — {money(p.promisedAmount)} — <StatusPill value={p.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No promises to pay.</p>
            )}
          </div>

          <div className="handoff-section">
            <span className="panel-title">Open disputes</span>
            {data.openDisputes?.length ? (
              <ul className="comm-list-compact">
                {data.openDisputes.map((disp) => (
                  <li key={disp.id}>
                    {disp.reason} — <StatusPill value={disp.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No open disputes.</p>
            )}
          </div>

          <div className="handoff-section">
            <span className="panel-title">Score breakdown</span>
            <ScoreBreakdown factors={data.scoreBreakdown} totalScore={data.priorityScore} />
          </div>
        </div>
      )}
    </Modal>
  );
}

function AssignCollectorModal({ account, onClose, onSaved }) {
  const [users, setUsers] = useState([]);
  const [selectedCollector, setSelectedCollector] = useState(
    account.assignedCollectorId ? String(account.assignedCollectorId) : ''
  );
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listUsers()
      .then(({ data }) => {
        const eligible = (data || []).filter(
          (u) => u.active && u.role === 'collector'
        );
        setUsers(eligible);
        if (!selectedCollector && eligible.length > 0) {
          setSelectedCollector(String(eligible[0].id));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!selectedCollector) {
      setError('Please select a collector.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api.assignCollector(account.id, Number(selectedCollector));
      onSaved(Number(selectedCollector));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not assign collector.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Assign Collector — ${account.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="modal-collector-select">Select Assigned Collector</label>
          {loadingUsers ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading eligible collectors…</p>
          ) : users.length > 0 ? (
            <select
              id="modal-collector-select"
              value={selectedCollector}
              onChange={(e) => setSelectedCollector(e.target.value)}
              required
            >
              <option value="" disabled>Choose collector…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          ) : (
            <p className="notice-banner">No active collectors found in the organization.</p>
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !selectedCollector}>
            {busy ? 'Saving…' : 'Save assignment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReassignOwnerModal({ account, onClose, onSaved }) {
  const [users, setUsers] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState(
    account.relationshipOwnerId ? String(account.relationshipOwnerId) : ''
  );
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listUsers()
      .then(({ data }) => {
        const eligible = (data || []).filter(
          (u) => u.active && u.role === 'relationship_owner'
        );
        setUsers(eligible);
        if (!selectedOwner && eligible.length > 0) {
          setSelectedOwner(String(eligible[0].id));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!selectedOwner) {
      setError('Please select a relationship owner.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { data } = await api.bulkReassign([account.id], Number(selectedOwner));
      const skipped = (data || []).filter((r) => r.status && r.status.startsWith('skipped'));
      if (skipped.length > 0) {
        setError(`Warning: ${skipped[0].status}`);
        return;
      }
      onSaved(Number(selectedOwner));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reassign relationship owner.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Assign Relationship Owner — ${account.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="modal-owner-select">Select Relationship Owner</label>
          {loadingUsers ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading eligible team members…</p>
          ) : users.length > 0 ? (
            <select
              id="modal-owner-select"
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              required
            >
              <option value="" disabled>Choose relationship owner…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email} ({u.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          ) : (
            <input
              id="modal-owner-select"
              type="number"
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
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
            {busy ? 'Saving…' : 'Assign Owner'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreditHoldModal({ account, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const placing = !account.creditHold;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.setCreditHold(account.id, placing, reason || undefined);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update credit hold.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={placing ? 'Place credit hold' : 'Release credit hold'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="hold-reason">Reason</label>
          <textarea
            id="hold-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placing ? 'e.g. Repeated broken promises to pay' : 'e.g. Payment plan agreed'}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={`btn ${placing ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>
            {busy ? 'Saving…' : placing ? 'Place hold' : 'Release hold'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const CALL_DISPOSITIONS = [
  { id: 'spoke', label: 'Spoke with AP — Promised to Pay', type: 'call', text: 'Spoke with accounts payable contact. Customer confirmed invoice and promised to initiate payment.', duration: 120 },
  { id: 'voicemail', label: 'Left Voicemail', type: 'call', text: 'Left voicemail requesting callback regarding overdue balance and invoice status.', duration: 45 },
  { id: 'statement', label: 'Requested Statement & Copies', type: 'email', text: 'Customer requested updated statement of account and invoice PDF copies.', duration: 0 },
  { id: 'disputed', label: 'Customer Disputed Invoice', type: 'call', text: 'Customer raised pricing/delivery dispute. Recommended opening dispute ticket.', duration: 180 },
  { id: 'busy', label: 'Line Busy / No Answer', type: 'call', text: 'Dialed AP contact phone number. Unanswered / line busy.', duration: 20 },
  { id: 'transit', label: 'Payment In Transit', type: 'call', text: 'Customer stated payment has been initiated / check is in the mail. Awaiting clearing.', duration: 90 },
];

function getDispositionIcon(id) {
  switch (id) {
    case 'spoke': return <PhoneCall size={12} strokeWidth={2} aria-hidden="true" />;
    case 'voicemail': return <Voicemail size={12} strokeWidth={2} aria-hidden="true" />;
    case 'statement': return <Mail size={12} strokeWidth={2} aria-hidden="true" />;
    case 'disputed': return <AlertTriangle size={12} strokeWidth={2} aria-hidden="true" />;
    case 'busy': return <PhoneOff size={12} strokeWidth={2} aria-hidden="true" />;
    case 'transit': return <CreditCard size={12} strokeWidth={2} aria-hidden="true" />;
    default: return <Phone size={12} strokeWidth={2} aria-hidden="true" />;
  }
}

function ConfirmWriteOffModal({ invoice, onClose, onConfirm, busy }) {
  if (!invoice) return null;
  return (
    <Modal title={`Confirm Write-Off — Invoice #${invoice.id}`} onClose={onClose} width={480}>
      <div className="write-off-modal-body">
        <div className="write-off-warning-box">
          <AlertCircle size={20} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div>
            <strong>Warning: This action cannot be reversed.</strong>
            <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Writing off this invoice will permanently adjust the balance to zero and mark the receivable as uncollectible.
            </p>
          </div>
        </div>
        <div className="handoff-row">
          <span className="handoff-label">Invoice number</span>
          <span className="num font-mono">#{invoice.id}</span>
        </div>
        <div className="handoff-row">
          <span className="handoff-label">Invoice amount</span>
          <span className="num font-bold" style={{ color: 'var(--danger-strong)' }}>{money(invoice.amount)}</span>
        </div>
        <div className="handoff-row">
          <span className="handoff-label">Due date</span>
          <span>{d(invoice.dueDate)}</span>
        </div>
        <div className="modal-actions" style={{ marginTop: 14 }}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Writing off…' : 'Confirm write-off'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LogNoteModal({ accountId, onClose, onSaved }) {
  const [type, setType] = useState('call');
  const [content, setContent] = useState('');
  const [minutes, setMinutes] = useState('1');
  const [seconds, setSeconds] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const m = parseInt(minutes, 10) || 0;
    const s = parseInt(seconds, 10) || 0;
    const totalSeconds = type === 'call' ? m * 60 + s : undefined;
    try {
      await api.logCommunication(accountId, {
        type,
        content,
        durationSeconds: totalSeconds,
      });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not log communication.'));
    } finally {
      setBusy(false);
    }
  }

  function handleSelectDisposition(d) {
    setType(d.type);
    setContent(d.text);
    if (d.duration != null) {
      const m = Math.floor(d.duration / 60);
      const s = d.duration % 60;
      setMinutes(String(m));
      setSeconds(String(s));
    }
  }

  return (
    <Modal title="Log call / communication" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label className="disposition-strip-label">1-Click Call Dispositions</label>
          <div className="disposition-chips">
            {CALL_DISPOSITIONS.map((d, i) => (
              <button
                key={i}
                type="button"
                className="disposition-chip"
                onClick={() => handleSelectDisposition(d)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {getDispositionIcon(d.id)}
                <span>{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field-row" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="comm-type">Type</label>
            <select id="comm-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="call">Call</option>
              <option value="note">Note</option>
              <option value="email">Email</option>
            </select>
          </div>
          {type === 'call' && (
            <div className="field" style={{ width: '190px' }}>
              <label htmlFor="comm-duration-min">Call Duration</label>
              <div className="duration-dual-inputs">
                <input
                  id="comm-duration-min"
                  type="number"
                  min="0"
                  max="999"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="0"
                  aria-label="Minutes"
                />
                <span className="duration-unit">min</span>
                <span className="duration-sep">:</span>
                <input
                  id="comm-duration-sec"
                  type="number"
                  min="0"
                  max="59"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  placeholder="0"
                  aria-label="Seconds"
                />
                <span className="duration-unit">sec</span>
              </div>
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="comm-content">Content & Summary</label>
          <textarea
            id="comm-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type notes or select a 1-click disposition above…"
            rows={4}
            required
          />
        </div>

        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save communication'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreatePtpModal({ accountId, openInvoices = [], onClose, onSaved }) {
  const [promisedAmount, setPromisedAmount] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isPastDate = promisedDate && promisedDate < todayStr;

  function handleInvoiceChange(e) {
    const invId = e.target.value;
    setSelectedInvoiceId(invId);
    if (invId) {
      const inv = openInvoices.find((i) => String(i.id) === String(invId));
      if (inv) {
        const rem = inv.remainingBalance ?? inv.remainingAmount ?? inv.amount;
        if (rem != null) {
          setPromisedAmount(String(rem));
        }
      }
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!promisedAmount || Number(promisedAmount) <= 0) {
      setError('Promised amount must be greater than zero.');
      return;
    }
    if (!promisedDate) {
      setError('Please select a promised payment date.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        promisedAmount: Number(promisedAmount),
        promisedDate,
        invoiceId: selectedInvoiceId ? Number(selectedInvoiceId) : null,
      };
      await api.createPtp(accountId, payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create promise-to-pay.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New promise-to-pay" onClose={onClose}>
      <form onSubmit={submit}>
        {openInvoices && openInvoices.length > 0 && (
          <div className="field">
            <label htmlFor="ptp-invoice">Link to invoice (optional)</label>
            <select id="ptp-invoice" value={selectedInvoiceId} onChange={handleInvoiceChange}>
              <option value="">Account level (no specific invoice)…</option>
              {openInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  Invoice #{inv.id} — {money(inv.remainingBalance ?? inv.amount)} balance ({d(inv.dueDate)})
                </option>
              ))}
            </select>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Selecting an invoice links the commitment and auto-fills the remaining balance.
            </span>
          </div>
        )}
        <div className="field">
          <label htmlFor="ptp-amount">Promised amount</label>
          <input
            id="ptp-amount"
            type="number"
            step="0.01"
            min="0.01"
            value={promisedAmount}
            onChange={(e) => setPromisedAmount(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="ptp-date">Promised date</label>
          <input
            id="ptp-date"
            type="date"
            value={promisedDate}
            onChange={(e) => setPromisedDate(e.target.value)}
            required
          />
          {isPastDate && (
            <p style={{ fontSize: '12px', color: 'var(--warning, #f59e0b)', marginTop: 4 }}>
              ⚠️ Past date selected — this PTP will be immediately eligible to mark as <strong>Broken</strong> from the Promises page.
            </p>
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateDisputeModal({ accountId, openInvoices = [], onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const [reasonCodeId, setReasonCodeId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [reasonCodes, setReasonCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getReasonCodes()
      .then((res) => setReasonCodes(res.data || []))
      .catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for the dispute.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        reason: reason.trim(),
        reasonCodeId: reasonCodeId ? Number(reasonCodeId) : null,
        invoiceId: selectedInvoiceId ? Number(selectedInvoiceId) : null,
      };
      await api.createDispute(accountId, payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not open dispute.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Open dispute" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="dispute-reason-code">Dispute reason code</label>
          <select
            id="dispute-reason-code"
            value={reasonCodeId}
            onChange={(e) => setReasonCodeId(e.target.value)}
          >
            <option value="">Select reason code (optional)…</option>
            {reasonCodes.map((rc) => (
              <option key={rc.id} value={rc.id}>
                {rc.label}
              </option>
            ))}
          </select>
        </div>
        {openInvoices && openInvoices.length > 0 && (
          <div className="field">
            <label htmlFor="dispute-invoice">Related invoice (optional)</label>
            <select
              id="dispute-invoice"
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
            >
              <option value="">Account level (no specific invoice)…</option>
              {openInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  Invoice #{inv.id} — {money(inv.remainingBalance ?? inv.amount)} balance ({d(inv.dueDate)})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="dispute-reason">Dispute description</label>
          <textarea
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain the customer dispute details…"
            rows={3}
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Open dispute'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateInvoiceModal({ accountId, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createInvoice(accountId, {
        amount: Number(amount),
        dueDate,
        issuedDate: issuedDate || undefined,
      });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create invoice.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add invoice" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="inv-amount">Amount</label>
          <input id="inv-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="inv-issued">Issued date</label>
          <input id="inv-issued" type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="inv-due">Due date</label>
          <input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Add invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RecordPaymentModal({ invoiceId, invoice, onClose, onSaved }) {
  const remainingBal = invoice?.remainingBalance ?? invoice?.remainingAmount ?? invoice?.amount;
  const [amount, setAmount] = useState(remainingBal != null ? String(remainingBal) : '');
  const [paidDate, setPaidDate] = useState('');
  const [method, setMethod] = useState('ach');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    const num = Number(amount);
    if (isNaN(num) || num <= 0) {
      setError('Payment amount must be greater than 0.');
      return;
    }
    if (remainingBal != null && num > Number(remainingBal)) {
      setError(`Payment cannot exceed the remaining invoice balance (${money(remainingBal)}).`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.recordPayment(invoiceId, {
        amount: num,
        paidDate: paidDate || undefined,
        method,
      });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not record payment.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Record payment — invoice #${invoiceId}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="pay-amount">
            Amount {remainingBal != null && <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>(Remaining: {money(remainingBal)})</span>}
          </label>
          <input
            id="pay-amount"
            type="number"
            step="0.01"
            min="0.01"
            max={remainingBal != null ? remainingBal : undefined}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pay-date">Paid date</label>
          <input id="pay-date" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pay-method">Method</label>
          <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="ach">ACH</option>
            <option value="card">Card</option>
            <option value="check">Check</option>
            <option value="wire">Wire</option>
          </select>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}