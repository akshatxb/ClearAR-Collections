import { useState } from 'react';
import { Send, Mail, FileText, Paperclip, Sparkles, AlertCircle, Building2, Check } from 'lucide-react';
import Modal from './Modal';
import * as api from '../api/endpoints';
import { apiErrorMessage } from '../api/client';
import './ComposeEmailModal.css';

const TEMPLATES = [
  {
    id: 'reminder',
    name: 'Standard Reminder',
    tag: 'Friendly',
    subject: 'Statement Follow-Up & Balance Review',
    body: `Dear Accounts Payable Team,\n\nThis is a courtesy follow-up regarding open invoice balances on your account. We kindly request that you review the attached statement and confirm the expected remittance schedule.\n\nIf payment was already dispatched, please share the transaction reference so our accounts team can ensure prompt credit to your ledger.\n\nThank you for your partnership.\n\nSincerely,\nCredit & Accounts Receivable Department`,
  },
  {
    id: 'urgent',
    name: 'Urgent Overdue Notice',
    tag: 'Urgent',
    subject: 'Urgent Action Required: Outstanding Past-Due Balance',
    body: `Dear Financial Controller / Accounts Payable,\n\nOur records indicate that your account has invoices that remain past due despite prior notices. To ensure uninterrupted credit facilities and avoid administrative escalation or service holds, please arrange for immediate payment.\n\nIf you require assistance or wish to confirm an installment commitment, please contact our relationship manager immediately.\n\nRespectfully,\nCredit & Collections Department`,
  },
  {
    id: 'statement',
    name: 'Statement of Account',
    tag: 'Statement',
    subject: 'Official Statement of Account & Open Ledger Summary',
    body: `Dear Accounts Payable Team,\n\nPlease find attached the official statement of account reflecting open invoice positions, payments received to date, and current aging status.\n\nWe request your review of the statement schedule and remittance according to your commercial credit terms. Electronic payments and dispute inquiries may also be submitted via the customer self-service portal.\n\nKind regards,\nFinance Operations & Commercial Billing`,
  },
];

export default function ComposeEmailModal({
  accountId,
  accountName = '',
  defaultRecipient = '',
  invoices = [],
  onClose,
  onSent,
}) {
  const [activeTemplateId, setActiveTemplateId] = useState(TEMPLATES[0].id);
  const [toEmail, setToEmail] = useState(defaultRecipient || '');
  const [subject, setSubject] = useState(
    accountName ? `${TEMPLATES[0].subject} - ${accountName}` : TEMPLATES[0].subject
  );
  const [bodyText, setBodyText] = useState(TEMPLATES[0].body);
  const [attachInvoiceId, setAttachInvoiceId] = useState(invoices.length > 0 ? String(invoices[0].id) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function handleApplyTemplate(template) {
    setActiveTemplateId(template.id);
    setSubject(accountName ? `${template.subject} - ${accountName}` : template.subject);
    setBodyText(template.body);
  }

  const selectedInvoice = invoices.find((inv) => String(inv.id) === String(attachInvoiceId));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!toEmail.trim()) {
      setError('Please enter a recipient email address.');
      return;
    }
    if (!subject.trim()) {
      setError('Please enter an email subject.');
      return;
    }
    if (!bodyText.trim()) {
      setError('Please write email message content.');
      return;
    }
    setBusy(true);
    setError('');

    try {
      const formattedHtml = bodyText
        .split('\n\n')
        .map((p) => `<p style="margin: 0 0 14px; line-height: 1.65; color: #334155; font-size: 14.5px;">${p.replace(/\n/g, '<br/>')}</p>`)
        .join('');

      await api.sendCustomEmail({
        accountId,
        toEmail: toEmail.trim(),
        subject: subject.trim(),
        bodyHtml: formattedHtml,
        attachInvoiceId: attachInvoiceId ? Number(attachInvoiceId) : null,
      });

      if (onSent) onSent();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to send email.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Compose & Send Email" onClose={onClose} width={620}>
      <form onSubmit={handleSubmit} className="compose-email-form">
        {/* Account context pill banner */}
        {(accountName || accountId) && (
          <div className="compose-account-banner">
            <div className="compose-account-meta">
              <Building2 size={15} className="compose-account-icon" aria-hidden="true" />
              <span>
                Account: <strong>{accountName || `Account #${accountId}`}</strong>
              </span>
            </div>
            {accountId && <span className="compose-account-id-badge">ID #{accountId}</span>}
          </div>
        )}

        {/* Template Selector Strip */}
        <div className="compose-template-section">
          <div className="compose-template-header">
            <Sparkles size={13} className="compose-template-icon" aria-hidden="true" />
            <span>Quick Templates:</span>
          </div>
          <div className="compose-template-pills">
            {TEMPLATES.map((t) => {
              const isActive = activeTemplateId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`compose-template-pill${isActive ? ' is-active' : ''}`}
                  onClick={() => handleApplyTemplate(t)}
                  title={`Apply "${t.name}" template`}
                >
                  {isActive && <Check size={12} strokeWidth={2.5} />}
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recipient Field */}
        <div className="field">
          <label htmlFor="compose-to" className="compose-field-label">
            <span>Recipient Email</span>
            <span className="field-required">*</span>
          </label>
          <div className="compose-input-wrapper">
            <Mail size={15} className="compose-input-icon" aria-hidden="true" />
            <input
              id="compose-to"
              type="email"
              className="compose-input with-icon"
              placeholder="e.g. ap@customer.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Subject Field */}
        <div className="field">
          <label htmlFor="compose-subject" className="compose-field-label">
            <span>Subject Line</span>
            <span className="field-required">*</span>
          </label>
          <div className="compose-input-wrapper">
            <FileText size={15} className="compose-input-icon" aria-hidden="true" />
            <input
              id="compose-subject"
              type="text"
              className="compose-input with-icon"
              placeholder="Enter email subject line…"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                if (activeTemplateId) setActiveTemplateId(null);
              }}
              required
            />
          </div>
        </div>

        {/* Message Body Field */}
        <div className="field">
          <div className="compose-body-label-row">
            <label htmlFor="compose-body" className="compose-field-label">
              <span>Message Body</span>
              <span className="field-required">*</span>
            </label>
            <span className="compose-body-hint">
              Supports paragraph breaks. Plain text is formatted cleanly.
            </span>
          </div>
          <textarea
            id="compose-body"
            className="compose-textarea"
            rows={7}
            placeholder="Write your email message here…"
            value={bodyText}
            onChange={(e) => {
              setBodyText(e.target.value);
              if (activeTemplateId) setActiveTemplateId(null);
            }}
            required
          />
        </div>

        {/* Attachment Selector */}
        {invoices.length > 0 && (
          <div className="field">
            <label htmlFor="compose-attachment" className="compose-field-label">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Paperclip size={13} aria-hidden="true" />
                <span>Attach Invoice PDF Statement (Optional)</span>
              </span>
            </label>
            <select
              id="compose-attachment"
              className="compose-select"
              value={attachInvoiceId}
              onChange={(e) => setAttachInvoiceId(e.target.value)}
            >
              <option value="">No invoice attachment</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={String(inv.id)}>
                  Invoice #{inv.id} — ${Number(inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} (Due: {inv.dueDate || 'N/A'})
                </option>
              ))}
            </select>

            {selectedInvoice && (
              <div className="compose-attachment-badge">
                <Paperclip size={12} strokeWidth={2} />
                <span>
                  Attached: <strong>Invoice #{selectedInvoice.id}</strong> (${Number(selectedInvoice.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="error-text compose-error-box">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="modal-actions compose-actions">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy}
          >
            {busy ? (
              'Sending…'
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Send size={13} strokeWidth={2.2} aria-hidden="true" />
                <span>Send Email</span>
              </span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
