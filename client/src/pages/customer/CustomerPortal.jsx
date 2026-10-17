import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  AlertTriangle,
  Mail,
  Phone,
  CalendarCheck,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  Lock,
  Plus,
  Search,
  X,
  Copy,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
} from 'lucide-react';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import StatusPill from '../../components/StatusPill';
import Modal from '../../components/Modal';
import './CustomerPortal.css';

const STRIPE_JS_SRC = 'https://js.stripe.com/v3/';
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

function loadStripeJs() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${STRIPE_JS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Stripe));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = STRIPE_JS_SRC;
    script.onload = () => resolve(window.Stripe);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

const money = (v) =>
  Number(v || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const d = (v) => (v ? new Date(v).toLocaleDateString() : '—');

const TABS = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'ptps', label: 'Promises to pay' },
  { key: 'payments', label: 'Payment history' },
  { key: 'disputes', label: 'Disputes' },
];

export default function CustomerPortal() {
  const { toast } = useToast();
  const [balance, setBalance] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [ptps, setPtps] = useState([]);
  const [reasonCodes, setReasonCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tab, setTab] = useState('invoices');
  const [invoiceFilter, setInvoiceFilter] = useState('all'); // 'all' | 'open' | 'overdue' | 'paid' | 'disputed'
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [pdfBusy, setPdfBusy] = useState('');

  // Modals
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeInvoiceId, setDisputeInvoiceId] = useState(null);
  const [showPtpModal, setShowPtpModal] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [showBatchPayModal, setShowBatchPayModal] = useState(false);

  // Multi-invoice selection & Sorting
  const [selectedInvoices, setSelectedInvoices] = useState(new Set());
  const [sortField, setSortField] = useState('dueDate');
  const [sortDir, setSortDir] = useState('asc');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [balanceRes, disputesRes, paymentsRes, ptpsRes, rcRes] = await Promise.all([
        api.getCustomerBalance(),
        api.getCustomerDisputes(),
        api.getCustomerPayments(),
        api.getCustomerPtps().catch(() => ({ data: [] })),
        api.getCustomerReasonCodes().catch(() => ({ data: [] })),
      ]);
      setBalance(balanceRes.data);
      setDisputes(disputesRes.data);
      setPayments(paymentsRes.data);
      setPtps(ptpsRes.data || []);
      setReasonCodes(rcRes.data || []);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your account information.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function copyToClipboard(text, key) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${key === 'email' ? 'billing email' : 'support phone'} to clipboard`);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  async function handleDownloadPdf(invoiceId) {
    setPdfBusy(invoiceId);
    try {
      const res = await api.downloadInvoicePdf(invoiceId);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not download this invoice statement.'));
    } finally {
      setPdfBusy('');
    }
  }

  function handleOpenDispute(invoiceId = null) {
    setDisputeInvoiceId(invoiceId);
    setShowDisputeModal(true);
  }

  function handleQuickPayOverdue() {
    const overdueList = balance?.invoices?.filter(
      (i) => i.isOverdue && i.status !== 'paid' && i.status !== 'written_off'
    ) || [];

    if (overdueList.length === 1) {
      setPayTarget(overdueList[0]);
    } else {
      setTab('invoices');
      setInvoiceFilter('overdue');
      if (overdueList.length > 1) {
        toast.info(`Showing ${overdueList.length} past due invoices. Select an invoice to pay.`);
      }
    }
  }

  // Sorting
  function handleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'id' || field === 'dueDate' ? 'asc' : 'desc');
    }
  }

  function renderSortIcon(field) {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.35, marginLeft: 4, verticalAlign: 'middle' }} />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp size={12} style={{ color: 'var(--accent)', marginLeft: 4, verticalAlign: 'middle' }} />
    ) : (
      <ArrowDown size={12} style={{ color: 'var(--accent)', marginLeft: 4, verticalAlign: 'middle' }} />
    );
  }

  // Statement of Account (SOA) CSV Export
  function handleExportStatement() {
    if (!balance) return;
    const lines = [];
    lines.push('STATEMENT OF ACCOUNT');
    lines.push(`Account Name,"${balance.accountName || ''}"`);
    lines.push(`Account ID,"#${balance.accountId || ''}"`);
    lines.push(`Creditor Organization,"${balance.orgName || 'Creditor Organization'}"`);
    lines.push(`Statement Date,"${new Date().toLocaleDateString()}"`);
    lines.push(`Payment Terms,"${balance.creditTerms || 'Standard Terms'}"`);
    lines.push('');
    lines.push('ACCOUNT SUMMARY');
    lines.push(`Total Open Balance,${balance.openBalance || 0}`);
    lines.push(`Past Due Balance,${balance.overdueAmount || 0}`);
    lines.push(`Current / Not Due,${balance.currentAmount || 0}`);
    lines.push(`Open Invoices Count,${balance.openCount || 0}`);
    lines.push('');
    lines.push('INVOICES LEDGER');
    lines.push('Invoice ID,Due Date,Status,Past Due,Total Amount,Total Paid,Remaining Balance');
    (balance.invoices || []).forEach((inv) => {
      const rem = Number(inv.remainingBalance ?? inv.remainingAmount ?? inv.amount ?? 0);
      const total = Number(inv.amount || 0);
      const paid = Math.max(0, total - rem);
      lines.push(`"${inv.id}","${inv.dueDate || ''}","${inv.status || ''}","${inv.isOverdue ? 'YES' : 'NO'}",${total},${paid},${rem}`);
    });
    lines.push('');
    lines.push('PAYMENT HISTORY');
    lines.push('Payment Date,Amount,Method,Reference');
    (payments || []).forEach((pay) => {
      lines.push(`"${pay.paidDate || ''}",${pay.amount || 0},"${pay.method || ''}","${pay.reference || ''}"`);
    });

    const csvContent = lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Statement-Account-${balance.accountId}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('Statement of Account exported (CSV).');
  }

  // Invoice status counts
  const invoiceCounts = useMemo(() => {
    if (!balance?.invoices) return { all: 0, open: 0, overdue: 0, paid: 0, disputed: 0 };
    return {
      all: balance.invoices.length,
      open: balance.invoices.filter((i) => i.status !== 'paid' && i.status !== 'written_off').length,
      overdue: balance.invoices.filter((i) => i.isOverdue && i.status !== 'paid' && i.status !== 'written_off').length,
      paid: balance.invoices.filter((i) => i.status === 'paid').length,
      disputed: balance.invoices.filter((i) => i.status === 'disputed').length,
    };
  }, [balance?.invoices]);

  // Filtered & searched invoices
  const filteredInvoices = useMemo(() => {
    if (!balance?.invoices) return [];
    let list = balance.invoices;

    if (invoiceFilter === 'open') {
      list = list.filter((i) => i.status !== 'paid' && i.status !== 'written_off');
    } else if (invoiceFilter === 'overdue') {
      list = list.filter((i) => i.isOverdue && i.status !== 'paid' && i.status !== 'written_off');
    } else if (invoiceFilter === 'paid') {
      list = list.filter((i) => i.status === 'paid');
    } else if (invoiceFilter === 'disputed') {
      list = list.filter((i) => i.status === 'disputed');
    }

    if (invoiceSearch.trim()) {
      const q = invoiceSearch.trim().toLowerCase();
      list = list.filter((i) =>
        String(i.id).toLowerCase().includes(q) ||
        String(i.amount).toLowerCase().includes(q) ||
        String(i.remainingAmount ?? i.remainingBalance ?? '').toLowerCase().includes(q) ||
        (i.status && i.status.toLowerCase().includes(q))
      );
    }

    return list;
  }, [balance?.invoices, invoiceFilter, invoiceSearch]);

  // Sorted invoices
  const sortedInvoices = useMemo(() => {
    let list = [...filteredInvoices];
    list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'dueDate') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else if (sortField === 'amount') {
        aVal = Number(a.remainingBalance ?? a.remainingAmount ?? a.amount ?? 0);
        bVal = Number(b.remainingBalance ?? b.remainingAmount ?? b.amount ?? 0);
      }
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
    return list;
  }, [filteredInvoices, sortField, sortDir]);

  // Selection calculations
  const unpaidInvoices = useMemo(
    () => sortedInvoices.filter((i) => i.status !== 'paid' && i.status !== 'written_off'),
    [sortedInvoices]
  );
  const isAllSelected = unpaidInvoices.length > 0 && unpaidInvoices.every((i) => selectedInvoices.has(i.id));
  const selectedInvoicesList = useMemo(
    () => (balance?.invoices || []).filter((i) => selectedInvoices.has(i.id)),
    [balance?.invoices, selectedInvoices]
  );
  const selectedTotal = useMemo(
    () =>
      selectedInvoicesList.reduce(
        (sum, i) => sum + Number(i.remainingAmount ?? i.remainingBalance ?? i.amount ?? 0),
        0
      ),
    [selectedInvoicesList]
  );

  if (loading) return <p className="empty-state">Loading customer billing portal…</p>;
  if (error && !balance) return <p className="error-text">{error}</p>;
  if (!balance) return null;

  return (
    <div>
      {/* Refined Credit Hold Banner */}
      {balance.creditHold && (
        <div className="portal-hold-banner" role="alert">
          <div className="portal-hold-main">
            <div className="portal-hold-icon-wrap" aria-hidden="true">
              <Lock size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div className="portal-hold-heading">Account on Credit Hold</div>
              <div className="portal-hold-sub">
                Order fulfillment and service deliveries are temporarily paused. Settle overdue balances or commit to a payment date to request release.
              </div>
            </div>
          </div>
          {balance.overdueAmount > 0 && (
            <button
              type="button"
              className="portal-hold-action-btn"
              onClick={handleQuickPayOverdue}
            >
              Pay {money(balance.overdueAmount)} Past Due
            </button>
          )}
        </div>
      )}

      {/* Account Hero Card (aligned with AccountDetail style) */}
      <div className="portal-hero-card" data-overdue={balance.overdueAmount > 0}>
        <div className="portal-hero-main">
          <div className="portal-hero-top">
            <div className="portal-hero-identity">
              <div className="portal-title-row">
                <h1 className="portal-account-title">{balance.accountName}</h1>
                <div className="portal-badges">
                  <span className="badge badge-accent">Account #{balance.accountId}</span>
                  {balance.creditTerms && (
                    <span className="badge badge-neutral">Terms: {balance.creditTerms}</span>
                  )}
                  {balance.creditHold && (
                    <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Lock size={12} aria-hidden="true" /> Credit Hold
                    </span>
                  )}
                </div>
              </div>
              <p className="portal-hero-issuer">
                Issued by <strong>{balance.orgName || 'Creditor Organization'}</strong>
              </p>
            </div>

            {/* Top-Right Account Actions */}
            <div className="portal-hero-actions">
              <button
                type="button"
                className="btn btn-action-item"
                onClick={handleExportStatement}
                title="Download comprehensive Statement of Account CSV"
              >
                <FileSpreadsheet size={14} strokeWidth={2} aria-hidden="true" />
                <span>Statement (CSV)</span>
              </button>
              {balance.overdueAmount > 0 && (
                <button
                  type="button"
                  className="btn btn-primary btn-action-item btn-action-danger"
                  onClick={handleQuickPayOverdue}
                >
                  <CreditCard size={14} strokeWidth={2} aria-hidden="true" />
                  <span>Pay Past Due ({money(balance.overdueAmount)})</span>
                </button>
              )}
              <button
                type="button"
                className={balance.overdueAmount > 0 ? 'btn btn-action-item' : 'btn btn-primary btn-action-item'}
                onClick={() => setShowPtpModal(true)}
              >
                <CalendarCheck size={14} strokeWidth={2} aria-hidden="true" />
                <span>Commit to pay (PTP)</span>
              </button>
            </div>
          </div>

          {/* Contact Bar with copyable chips */}
          <div className="portal-contact-bar">
            {balance.contactEmail && (
              <div className="contact-chip">
                <span className="contact-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Mail size={13} aria-hidden="true" />
                </span>
                <span>AR Billing: <a href={`mailto:${balance.contactEmail}`}>{balance.contactEmail}</a></span>
                <button
                  type="button"
                  className="contact-copy-btn"
                  onClick={() => copyToClipboard(balance.contactEmail, 'email')}
                  title="Copy email address"
                  aria-label="Copy email address"
                >
                  {copiedKey === 'email' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Check size={11} strokeWidth={2.5} color="var(--accent)" aria-hidden="true" />
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
            )}
            {balance.contactPhone && (
              <div className="contact-chip">
                <span className="contact-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Phone size={13} aria-hidden="true" />
                </span>
                <span>Support: <a href={`tel:${balance.contactPhone}`}>{balance.contactPhone}</a></span>
                <button
                  type="button"
                  className="contact-copy-btn"
                  onClick={() => copyToClipboard(balance.contactPhone, 'phone')}
                  title="Copy phone number"
                  aria-label="Copy phone number"
                >
                  {copiedKey === 'phone' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Check size={11} strokeWidth={2.5} color="var(--accent)" aria-hidden="true" />
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
            )}
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {/* Standardized 3-Card KPI Metrics Grid */}
      <div className="portal-kpi-grid">
        <div className="admin-stat-card">
          <span className="admin-stat-label">Total Open Balance</span>
          <div className="admin-stat-val-group">
            <span className="admin-stat-value num">{money(balance.openBalance)}</span>
          </div>
          <span className="portal-stat-sub">
            {balance.openCount || 0} open {balance.openCount === 1 ? 'invoice' : 'invoices'}
          </span>
        </div>

        <div className={`admin-stat-card ${balance.overdueAmount > 0 ? 'portal-stat-danger' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="admin-stat-label">Past Due</span>
            {balance.overdueAmount > 0 ? (
              <span className="admin-stat-tag tag-danger">Action Required</span>
            ) : (
              <span className="admin-stat-tag tag-good">Up to date</span>
            )}
          </div>
          <div className="admin-stat-val-group">
            <span
              className="admin-stat-value num"
              style={{ color: balance.overdueAmount > 0 ? 'var(--danger, #dc2626)' : 'inherit' }}
            >
              {money(balance.overdueAmount)}
            </span>
          </div>
          <span className="portal-stat-sub">
            {balance.overdueCount || 0} {balance.overdueCount === 1 ? 'invoice' : 'invoices'} past payment terms
          </span>
        </div>

        <div className="admin-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="admin-stat-label">Current / Not Due</span>
            <span className="admin-stat-tag tag-good">In Terms</span>
          </div>
          <div className="admin-stat-val-group">
            <span className="admin-stat-value num">{money(balance.currentAmount)}</span>
          </div>
          <span className="portal-stat-sub">
            Due according to agreed invoice schedules
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tab-row">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab-btn${tab === t.key ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'invoices' && invoiceCounts.open > 0 && ` (${invoiceCounts.open})`}
            {t.key === 'ptps' && ptps.length > 0 && ` (${ptps.length})`}
            {t.key === 'disputes' && disputes.length > 0 && ` (${disputes.length})`}
          </button>
        ))}
      </div>

      {/* INVOICES TAB */}
      {tab === 'invoices' && (
        <div className="panel">
          <div className="admin-filter-bar" style={{ marginBottom: 16 }}>
            <div className="admin-search-wrap">
              <Search size={14} className="search-icon" aria-hidden="true" />
              <input
                type="text"
                className="admin-search-input"
                placeholder="Search invoice # or amount…"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
              />
              {invoiceSearch && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setInvoiceSearch('')}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              )}
            </div>

            <div className="admin-filter-group">
              <label className="admin-filter-label">
                Status
                <select
                  className="admin-filter-select"
                  value={invoiceFilter}
                  onChange={(e) => setInvoiceFilter(e.target.value)}
                >
                  <option value="all">All invoices ({invoiceCounts.all})</option>
                  <option value="open">Open ({invoiceCounts.open})</option>
                  <option value="overdue">Past Due ({invoiceCounts.overdue})</option>
                  <option value="paid">Paid ({invoiceCounts.paid})</option>
                  <option value="disputed">Disputed ({invoiceCounts.disputed})</option>
                </select>
              </label>

              {(invoiceSearch || invoiceFilter !== 'all') && (
                <button
                  type="button"
                  className="btn btn-quiet"
                  style={{ height: '34px', fontSize: '12.5px' }}
                  onClick={() => {
                    setInvoiceSearch('');
                    setInvoiceFilter('all');
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Floating Bulk Action Toolbar (matches Worklist & app-wide style) */}
          {selectedInvoices.size > 0 && (
            <div className="bulk-toolbar">
              <span className="badge badge-accent">
                {selectedInvoices.size} invoice{selectedInvoices.size > 1 ? 's' : ''} selected
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                Total: {money(selectedTotal)}
              </span>
              <div className="bulk-toolbar-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowBatchPayModal(true)}
                >
                  <CreditCard size={13} strokeWidth={2} />
                  <span>Pay Selected ({money(selectedTotal)})</span>
                </button>
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => setSelectedInvoices(new Set())}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {sortedInvoices.length === 0 ? (
            <p className="empty-state">No invoices matching the selected criteria.</p>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      aria-label="Select all unpaid invoices"
                      checked={isAllSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInvoices(new Set(unpaidInvoices.map((i) => i.id)));
                        } else {
                          setSelectedInvoices(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="th-sortable" onClick={() => handleSort('id')} title="Sort by invoice number">
                    <span>Invoice</span>
                    {renderSortIcon('id')}
                  </th>
                  <th className="th-sortable" onClick={() => handleSort('dueDate')} title="Sort by due date">
                    <span>Due date</span>
                    {renderSortIcon('dueDate')}
                  </th>
                  <th className="th-sortable" onClick={() => handleSort('status')} title="Sort by status">
                    <span>Status</span>
                    {renderSortIcon('status')}
                  </th>
                  <th className="align-right th-sortable" onClick={() => handleSort('amount')} title="Sort by balance / amount">
                    <span>Balance / Amount</span>
                    {renderSortIcon('amount')}
                  </th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map((inv) => {
                  const isSelectable = inv.status !== 'paid' && inv.status !== 'written_off';
                  const isChecked = selectedInvoices.has(inv.id);
                  return (
                    <tr key={inv.id} className={isChecked ? 'row-selected' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          aria-label={`Select invoice #${inv.id}`}
                          disabled={!isSelectable}
                          checked={isChecked}
                          onChange={(e) => {
                            const next = new Set(selectedInvoices);
                            if (e.target.checked) next.add(inv.id);
                            else next.delete(inv.id);
                            setSelectedInvoices(next);
                          }}
                        />
                      </td>
                      <td className="num">
                        <strong>#{inv.id}</strong>
                      </td>
                      <td>
                        {d(inv.dueDate)}
                        {inv.isOverdue && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Past due</span>}
                      </td>
                      <td>
                        <StatusPill value={inv.status} />
                        {(inv.isPartiallyPaid || (Number(inv.remainingAmount ?? inv.remainingBalance ?? inv.amount) < Number(inv.amount) && Number(inv.remainingAmount ?? inv.remainingBalance ?? inv.amount) > 0 && inv.status !== 'paid' && inv.status !== 'written_off')) && (
                          <span className="badge-partial">Partially paid</span>
                        )}
                      </td>
                      <td className="align-right num">
                        {((inv.remainingAmount ?? inv.remainingBalance) != null && Number(inv.remainingAmount ?? inv.remainingBalance) < Number(inv.amount) && inv.status !== 'paid' && inv.status !== 'written_off') ? (
                          <div className="invoice-amount-cell">
                            <div className="invoice-remaining-val">
                              {money(inv.remainingAmount ?? inv.remainingBalance)}
                            </div>
                            <div className="invoice-original-sub">
                              Total: {money(inv.amount)} • Paid: {money(inv.totalPaid != null ? inv.totalPaid : Number(inv.amount) - Number(inv.remainingAmount ?? inv.remainingBalance))}
                            </div>
                          </div>
                        ) : (
                          <div>{money(inv.status === 'paid' ? inv.amount : (inv.remainingAmount ?? inv.remainingBalance ?? inv.amount))}</div>
                        )}
                      </td>
                      <td className="align-right">
                        <div className="portal-actions-cell">
                          {isSelectable && (
                            <>
                              <button
                                type="button"
                                className="tbl-btn tbl-btn-pay"
                                onClick={() => setPayTarget(inv)}
                              >
                                <CreditCard size={12} strokeWidth={2} />
                                <span>Pay now</span>
                              </button>
                              <button
                                type="button"
                                className="tbl-btn tbl-btn-secondary"
                                onClick={() => handleOpenDispute(inv.id)}
                                title="Open a dispute on this invoice"
                              >
                                <AlertCircle size={12} strokeWidth={2} />
                                <span>Dispute</span>
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="tbl-btn tbl-btn-secondary"
                            onClick={() => handleDownloadPdf(inv.id)}
                            disabled={pdfBusy === inv.id}
                            title="Download invoice statement PDF"
                          >
                            <Download size={12} strokeWidth={2} />
                            <span>{pdfBusy === inv.id ? 'Downloading…' : 'PDF'}</span>
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
      )}

      {/* PROMISES TO PAY TAB */}
      {tab === 'ptps' && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="panel-title" style={{ margin: 0 }}>Promises to pay</span>
            <button type="button" className="btn btn-primary" onClick={() => setShowPtpModal(true)}>
              <Plus size={14} strokeWidth={2.5} />
              <span>New payment commitment</span>
            </button>
          </div>

          {ptps.length === 0 ? (
            <div className="empty-state">
              <p>No payment commitments on file.</p>
              <p style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
                If you cannot pay today, committing to a specific payment date lets our collections team know and helps pause automated reminders.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 12 }}
                onClick={() => setShowPtpModal(true)}
              >
                Submit a promise to pay
              </button>
            </div>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Promised date</th>
                  <th className="align-right">Promised amount</th>
                  <th>Status</th>
                  <th>Committed on</th>
                </tr>
              </thead>
              <tbody>
                {ptps.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{d(p.promisedDate)}</strong></td>
                    <td className="align-right num">{money(p.promisedAmount)}</td>
                    <td>
                      <StatusPill value={p.status} />
                    </td>
                    <td>{d(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PAYMENT HISTORY TAB */}
      {tab === 'payments' && (
        <div className="panel">
          <span className="panel-title">Payment history</span>
          {payments.length === 0 ? (
            <p className="empty-state">No payments recorded yet.</p>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Paid date</th>
                  <th>Method</th>
                  <th className="align-right">Amount</th>
                  <th className="align-right">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.paymentId || p.id}>
                    <td className="num"><strong>#{p.invoiceId}</strong></td>
                    <td>{d(p.paidDate)}</td>
                    <td>
                      <span className="portal-payment-method">{p.method || 'payment'}</span>
                    </td>
                    <td className="align-right num">{money(p.amount)}</td>
                    <td className="align-right">
                      <button
                        type="button"
                        className="tbl-btn tbl-btn-secondary"
                        onClick={() => handleDownloadPdf(p.invoiceId)}
                        disabled={pdfBusy === p.invoiceId}
                        title="Download payment receipt / invoice record"
                      >
                        <Download size={12} strokeWidth={2} />
                        <span>{pdfBusy === p.invoiceId ? '…' : 'Receipt'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* DISPUTES TAB */}
      {tab === 'disputes' && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="panel-title" style={{ margin: 0 }}>Your disputes</span>
            <button type="button" className="btn btn-primary" onClick={() => handleOpenDispute(null)}>
              <Plus size={14} strokeWidth={2.5} />
              <span>Submit a dispute</span>
            </button>
          </div>

          {disputes.length === 0 ? (
            <p className="empty-state">No disputes submitted.</p>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Resolved</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((disp) => (
                  <tr key={disp.id}>
                    <td>
                      {disp.invoiceId ? (
                        <span className="num">#{disp.invoiceId}</span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>Account-wide</span>
                      )}
                    </td>
                    <td>
                      <div>{disp.reason}</div>
                    </td>
                    <td>
                      <StatusPill value={disp.status} />
                    </td>
                    <td>{d(disp.createdAt)}</td>
                    <td>{disp.resolvedAt ? d(disp.resolvedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* SUBMIT PTP MODAL */}
      {showPtpModal && (
        <SubmitPtpModal
          balance={balance}
          onClose={() => setShowPtpModal(false)}
          onSaved={() => {
            setShowPtpModal(false);
            toast.success('Promise to pay committed. Thank you.');
            load();
          }}
        />
      )}

      {/* SUBMIT DISPUTE MODAL */}
      {showDisputeModal && (
        <SubmitDisputeModal
          invoices={balance.invoices}
          preselectedInvoiceId={disputeInvoiceId}
          reasonCodes={reasonCodes}
          onClose={() => {
            setShowDisputeModal(false);
            setDisputeInvoiceId(null);
          }}
          onSaved={() => {
            setShowDisputeModal(false);
            setDisputeInvoiceId(null);
            toast.success('Dispute submitted for review.');
            load();
          }}
        />
      )}

      {/* PAY INVOICE MODAL */}
      {payTarget && (
        <PayInvoiceModal
          invoice={payTarget}
          onClose={() => setPayTarget(null)}
          onPaid={() => {
            const id = payTarget.id;
            setPayTarget(null);
            toast.success(`Payment for invoice #${id} processed.`);
            load();
          }}
        />
      )}

      {/* PAY BATCH MODAL */}
      {showBatchPayModal && (
        <PayBatchModal
          invoices={selectedInvoicesList}
          totalAmount={selectedTotal}
          onClose={() => setShowBatchPayModal(false)}
          onPaid={() => {
            setShowBatchPayModal(false);
            setSelectedInvoices(new Set());
            toast.success(`Batch payment for ${selectedInvoicesList.length} invoices processed.`);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ---------------- PROMISE TO PAY MODAL ---------------- */
function SubmitPtpModal({ balance, onClose, onSaved }) {
  const [promisedAmount, setPromisedAmount] = useState(balance?.openBalance || '');
  const [promisedDate, setPromisedDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const todayStr = new Date().toISOString().slice(0, 10);

  async function submit(e) {
    e.preventDefault();
    if (!promisedAmount || Number(promisedAmount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!promisedDate) {
      setError('Please select a promised payment date.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.submitCustomerPtp({
        promisedAmount: Number(promisedAmount),
        promisedDate,
      });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not submit your promise to pay.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Commit to a Payment Date (PTP)" onClose={onClose} width={460}>
      <form onSubmit={submit}>
        <p style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.4 }}>
          Enter the amount you plan to pay and the date by which payment will be made. This creates a recognized commitment in our system.
        </p>

        <div className="field">
          <label htmlFor="ptp-amount">Promised amount ($)</label>
          <input
            id="ptp-amount"
            type="number"
            step="0.01"
            min="1"
            value={promisedAmount}
            onChange={(e) => setPromisedAmount(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="ptp-date">Promised payment date</label>
          <input
            id="ptp-date"
            type="date"
            value={promisedDate}
            onChange={(e) => setPromisedDate(e.target.value)}
            required
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving commitment…' : 'Save Commitment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const FALLBACK_DISPUTE_REASONS = [
  { id: 'invoice_error', code: 'invoice_error', label: 'Invoice or Calculation Error' },
  { id: 'pricing_discrepancy', code: 'pricing_discrepancy', label: 'Incorrect Amount / Pricing Discrepancy' },
  { id: 'goods_not_received', code: 'goods_not_received', label: 'Goods or Services Not Received' },
  { id: 'damaged_defective', code: 'damaged_defective', label: 'Damaged or Defective Items' },
  { id: 'already_paid', code: 'already_paid', label: 'Payment Already Transferred' },
  { id: 'other_discrepancy', code: 'other', label: 'Other Discrepancy (Explained in Notes)' },
];

/* ---------------- SUBMIT DISPUTE MODAL ---------------- */
function SubmitDisputeModal({ invoices, preselectedInvoiceId, reasonCodes, onClose, onSaved }) {
  const [invoiceId, setInvoiceId] = useState(preselectedInvoiceId ? String(preselectedInvoiceId) : '');
  const [reasonCodeId, setReasonCodeId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const availableReasons = reasonCodes && reasonCodes.length > 0 ? reasonCodes : FALLBACK_DISPUTE_REASONS;
  const eligibleInvoices = (invoices || []).filter((i) => i.status !== 'paid' && i.status !== 'written_off');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const selectedRc = availableReasons.find((rc) => String(rc.id) === String(reasonCodeId));
      const reasonLabel = selectedRc ? (selectedRc.label || selectedRc.category || selectedRc.code) : 'Customer Dispute';
      const numericReasonCodeId = selectedRc && Number.isInteger(Number(selectedRc.id)) ? Number(selectedRc.id) : null;
      await api.submitCustomerDispute({
        invoiceId: invoiceId ? Number(invoiceId) : null,
        reasonCodeId: numericReasonCodeId,
        reason: reasonLabel,
        notes: notes.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not submit dispute.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Submit a Dispute" onClose={onClose} width={480}>
      <form onSubmit={submit}>
        <p style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.4 }}>
          Flag an invoice or account balance for review. Our accounts receivable team will be notified immediately to investigate.
        </p>

        <div className="field">
          <label htmlFor="dispute-invoice">Invoice (optional)</label>
          <select
            id="dispute-invoice"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
          >
            <option value="">Account-wide dispute (no specific invoice)</option>
            {eligibleInvoices.map((inv) => {
              const rem = Number(inv.remainingAmount ?? inv.remainingBalance ?? inv.amount);
              const isPart = rem < Number(inv.amount);
              return (
                <option key={inv.id} value={inv.id}>
                  Invoice #{inv.id} — {money(rem)} {isPart ? `balance (total ${money(inv.amount)})` : ''} (due {d(inv.dueDate)})
                </option>
              );
            })}
          </select>
        </div>

        <div className="field">
          <label htmlFor="dispute-reason">Reason for dispute</label>
          <select
            id="dispute-reason"
            value={reasonCodeId}
            onChange={(e) => setReasonCodeId(e.target.value)}
            required
          >
            <option value="">Select a reason…</option>
            {availableReasons.map((rc) => (
              <option key={rc.id} value={rc.id}>
                {rc.label || rc.code || rc.category}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="dispute-notes">Explanation / Notes</label>
          <textarea
            id="dispute-notes"
            rows={3}
            placeholder="Describe the issue, discrepancy, or reason for disputing this charge…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Submitting dispute…' : 'Submit Dispute'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- PAY INVOICE MODAL (PARTIAL PAYMENT SUPPORT) ---------------- */
function PayInvoiceModal({ invoice, onClose, onPaid }) {
  const [stripe, setStripe] = useState(null);
  const [cardReady, setCardReady] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const initialDue = Number(invoice.remainingAmount ?? invoice.remainingBalance ?? invoice.amount) || 0;
  const [paidAmount, setPaidAmount] = useState(0);
  const [amountInput, setAmountInput] = useState(String(initialDue));

  const cardElRef = useRef(null);
  const cardInstanceRef = useRef(null);

  const fullAmount = initialDue;
  const parsed = parseFloat(amountInput);
  const effectiveAmount = isNaN(parsed) || parsed <= 0 ? 0 : Math.min(fullAmount, Math.round(parsed * 100) / 100);
  const remainingAfterPayment = Math.max(0, Math.round((fullAmount - effectiveAmount) * 100) / 100);
  const isPartial = effectiveAmount > 0 && effectiveAmount < fullAmount;

  const hasStripeKey = Boolean(STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY !== 'pk_test_replace_me');

  useEffect(() => {
    let cancelled = false;
    if (!hasStripeKey) return;

    async function init() {
      try {
        const Stripe = await loadStripeJs();
        if (cancelled) return;
        const stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
        const elementsInstance = stripeInstance.elements();
        const card = elementsInstance.create('card');
        card.mount(cardElRef.current);
        card.on('ready', () => setCardReady(true));
        cardInstanceRef.current = card;
        setStripe(stripeInstance);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not initialize card input.'));
      }
    }

    init();
    return () => {
      cancelled = true;
      cardInstanceRef.current?.unmount();
    };
  }, [hasStripeKey]);

  async function handleStripePay(e) {
    e.preventDefault();
    if (!stripe || effectiveAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }
    if (effectiveAmount < 0.50) {
      setError('Payment amount must be at least $0.50 USD for card processing.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.payInvoice(invoice.id, effectiveAmount);
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card: cardInstanceRef.current },
      });
      if (result.error) {
        setError(result.error.message || 'Payment failed.');
      } else {
        setPaidAmount(effectiveAmount);
        setSucceeded(true);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Payment failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDemoPay() {
    if (effectiveAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.payInvoiceDemo(invoice.id, effectiveAmount);
      setPaidAmount(effectiveAmount);
      setSucceeded(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not process payment.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Pay invoice #${invoice.id}`} onClose={onClose} width={460}>
      {succeeded ? (
        <div>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <CheckCircle2 size={44} strokeWidth={2} color="var(--success, #10b981)" aria-hidden="true" />
            </div>
            <h3 style={{ margin: '0 0 8px' }}>Payment Succeeded</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: '14px', margin: 0 }}>
              Payment of <strong>{money(paidAmount)}</strong> for Invoice #{invoice.id} has been recorded.
            </p>
            {paidAmount < fullAmount && (
              <p style={{ fontSize: '13px', color: 'var(--amber, #f59e0b)', marginTop: 8 }}>
                Remaining balance on this invoice: <strong>{money(fullAmount - paidAmount)}</strong>
              </p>
            )}
          </div>
          <div className="modal-actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={onPaid}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Invoice Summary Breakdown if already partially paid */}
          {Number(invoice.amount) > initialDue && (
            <div className="invoice-modal-breakdown">
              <div className="modal-breakdown-item">
                <span className="modal-breakdown-label">Original Total</span>
                <span className="modal-breakdown-val">{money(invoice.amount)}</span>
              </div>
              <div className="modal-breakdown-item">
                <span className="modal-breakdown-label">Already Paid</span>
                <span className="modal-breakdown-val" style={{ color: 'var(--success, #10b981)' }}>
                  {money(Number(invoice.amount) - initialDue)}
                </span>
              </div>
              <div className="modal-breakdown-item">
                <span className="modal-breakdown-label">Balance Due</span>
                <span className="modal-breakdown-val" style={{ color: 'var(--amber, #f59e0b)' }}>
                  {money(initialDue)}
                </span>
              </div>
            </div>
          )}

          {/* Amount input field - pre-filled with full amount, directly editable */}
          <div className="field" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <label htmlFor="payment-amount-input" style={{ margin: 0, fontWeight: 600 }}>Payment Amount ($)</label>
              <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                Total Due: <strong>{money(fullAmount)}</strong>
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--ink-soft)' }}>
                $
              </span>
              <input
                id="payment-amount-input"
                type="number"
                step="0.01"
                min="0.01"
                max={fullAmount}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 28px',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--ink)',
                  background: 'var(--paper-subtle)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-s)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {isPartial && (
              <div style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 'var(--radius-s)',
                background: 'var(--paper-subtle)',
                border: '1px dashed var(--line)',
                fontSize: '12.5px',
                color: 'var(--ink-soft)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Remaining balance after payment:</span>
                <span className="num" style={{ fontWeight: 700, color: 'var(--amber, #f59e0b)' }}>
                  {money(remainingAfterPayment)}
                </span>
              </div>
            )}
          </div>

          {/* If Stripe is configured with a real key */}
          {hasStripeKey && (
            <form onSubmit={handleStripePay} style={{ marginBottom: 16 }}>
              <div className="field">
                <label>Card details</label>
                <div ref={cardElRef} className="stripe-card-element" />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 12 }}
                disabled={busy || !cardReady || !clientSecret || effectiveAmount <= 0}
              >
                {busy ? 'Processing Stripe…' : `Pay ${money(effectiveAmount)} via Stripe`}
              </button>
            </form>
          )}

          {/* Instant / Demo Payment */}
          {hasStripeKey ? (
            <div className="portal-demo-pay-box" style={{ marginTop: 12 }}>
              <div className="portal-demo-pay-title" style={{ marginBottom: 10 }}>
                Or test with Instant Demo Payment
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleDemoPay}
                disabled={busy || effectiveAmount <= 0}
              >
                {busy ? 'Processing payment…' : `Pay ${money(effectiveAmount)} Now`}
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleDemoPay}
                disabled={busy || effectiveAmount <= 0}
              >
                {busy ? 'Processing payment…' : `Pay ${money(effectiveAmount)} Now`}
              </button>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- BATCH PAYMENT MODAL ---------------- */
function PayBatchModal({ invoices, totalAmount, onClose, onPaid }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [succeeded, setSucceeded] = useState(false);

  async function handleConfirmBatchPay() {
    setBusy(true);
    setError('');
    try {
      await api.payBatchInvoices(invoices.map((i) => i.id));
      setSucceeded(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not process batch payment.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Batch Payment Checkout" onClose={onClose} width={500}>
      {succeeded ? (
        <div>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <CheckCircle2 size={44} strokeWidth={2} color="var(--success, #10b981)" aria-hidden="true" />
            </div>
            <h3 style={{ margin: '0 0 8px' }}>Batch Payment Succeeded</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: '14px', margin: 0 }}>
              Payment for <strong>{invoices.length} invoices</strong> totaling <strong>{money(totalAmount)}</strong> has been successfully recorded.
            </p>
          </div>
          <div className="modal-actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={onPaid}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: 14 }}>
            Review the {invoices.length} selected invoices below before confirming batch payment.
          </p>

          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--radius-s)', marginBottom: 16 }}>
            <table className="mini-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Due date</th>
                  <th className="align-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="num"><strong>#{inv.id}</strong></td>
                    <td>{d(inv.dueDate)}</td>
                    <td className="align-right num">{money(inv.remainingAmount ?? inv.remainingBalance ?? inv.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 14px', background: 'var(--paper-subtle)', borderRadius: 'var(--radius-s)', marginBottom: 16 }}>
            <span style={{ fontWeight: 600, fontSize: '13.5px' }}>Total to be paid ({invoices.length} invoices):</span>
            <span className="num" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent)' }}>{money(totalAmount)}</span>
          </div>

          {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmBatchPay}
              disabled={busy}
            >
              {busy ? 'Processing batch…' : `Confirm & Pay ${money(totalAmount)}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
