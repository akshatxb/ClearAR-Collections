import { useState, useEffect, useCallback } from 'react';
import { Mail, X, Search, Paperclip, Check, ArrowUpRight, Calendar, Clock } from 'lucide-react';
import * as api from '../api/endpoints';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/useAuth';
import Modal from './Modal';
import './EmailDrawer.css';

export default function EmailDrawer({ onClose }) {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === 'platform_admin';

  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedEmail, setSelectedEmail] = useState(null);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = isPlatformAdmin
        ? await api.listPlatformEmails()
        : await api.listEmails();
      setEmails(data || []);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load emails.'));
    } finally {
      setLoading(false);
    }
  }, [isPlatformAdmin]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const filteredEmails = emails.filter((e) => {
    if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (e.toEmail && e.toEmail.toLowerCase().includes(q)) ||
        (e.subject && e.subject.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <>
      <div className="email-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="email-drawer">
        <div className="email-drawer-header">
          <div className="email-drawer-title-group">
            <Mail size={18} strokeWidth={2} className="email-drawer-header-icon" aria-hidden="true" />
            <span className="email-drawer-title">Email Center</span>
            <span className="email-drawer-badge">{emails.length} dispatched</span>
          </div>
          <button
            type="button"
            className="email-drawer-close-btn"
            onClick={onClose}
            aria-label="Close email drawer"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="email-drawer-filter">
          <div className="email-drawer-search-wrap">
            <Search size={14} className="email-drawer-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="email-search-input"
              placeholder="Search recipient or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="email-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>
          <div className="email-category-chips">
            {(isPlatformAdmin
              ? ['ALL', 'INVITE', 'AUTH', 'ONBOARDING']
              : ['ALL', 'REMINDER', 'INVITE', 'PAYMENT_RECEIPT', 'ESCALATION', 'MANUAL']
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                className={`email-chip-btn ${categoryFilter === cat ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === 'ALL' ? 'All'
                  : cat === 'PAYMENT_RECEIPT' ? 'Receipt'
                  : cat === 'AUTH' ? 'Password reset'
                  : cat === 'ONBOARDING' ? 'Onboarding'
                  : cat.charAt(0) + cat.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="email-drawer-list">
          {loading && (
            <div className="email-drawer-state">
              <div className="email-drawer-state-spinner" />
              <span>Loading emails…</span>
            </div>
          )}
          {error && <p className="error-text" style={{ padding: '16px 20px' }}>{error}</p>}
          {!loading && filteredEmails.length === 0 && (
            <div className="email-drawer-state">
              <Mail size={28} strokeWidth={1.5} style={{ opacity: 0.3 }} />
              <span style={{ opacity: 0.5, fontSize: '13px' }}>
                {emails.length === 0 ? 'No emails dispatched yet.' : 'No results match your filters.'}
              </span>
            </div>
          )}

          {filteredEmails.map((email) => (
            <div
              key={email.id}
              className="email-card"
              onClick={() => setSelectedEmail(email)}
              title="Click to view email"
            >
              <div className="email-card-header">
                <span className="email-card-recipient">
                  <ArrowUpRight size={12} strokeWidth={2} className="recipient-arrow" aria-hidden="true" />
                  {email.toEmail}
                </span>
                <span className="email-card-time">
                  {email.createdAt
                    ? new Date(email.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </div>
              <div className="email-card-subject">{email.subject}</div>
              <div className="email-card-date">
                {email.createdAt ? new Date(email.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
              </div>
              <div className="email-card-footer">
                <span className={`email-cat-tag ${email.category || 'MANUAL'}`}>
                  {email.category || 'MANUAL'}
                </span>
                {email.hasAttachment && (
                  <span className="email-card-attachment">
                    <Paperclip size={11} strokeWidth={2} aria-hidden="true" />
                    <span>{email.attachmentName || 'PDF'}</span>
                  </span>
                )}
                <span className="email-card-status">
                  <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                  <span>{email.status || 'SENT'}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {selectedEmail && (
        <Modal
          title="Email Message Details"
          onClose={() => setSelectedEmail(null)}
          width={640}
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setSelectedEmail(null)}
            >
              Close Preview
            </button>
          }
        >
          <div className="email-view-container">
            {/* Header / Subject & Metadata Card */}
            <div className="email-view-header-card">
              <h3 className="email-view-subject">{selectedEmail.subject || '(No Subject)'}</h3>
              <div className="email-view-meta-grid">
                <div className="email-view-meta-item">
                  <span className="email-view-meta-label">To:</span>
                  <span className="email-view-meta-value email-view-recipient">
                    <Mail size={13} aria-hidden="true" />
                    <strong>{selectedEmail.toEmail}</strong>
                  </span>
                </div>

                <div className="email-view-meta-item">
                  <span className="email-view-meta-label">Dispatched:</span>
                  <span className="email-view-meta-value">
                    <Calendar size={13} aria-hidden="true" />
                    <span>
                      {selectedEmail.createdAt
                        ? new Date(selectedEmail.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : 'Just now'}
                    </span>
                  </span>
                </div>

                <div className="email-view-meta-item">
                  <span className="email-view-meta-label">Category:</span>
                  <span className="email-view-meta-value">
                    <span className={`email-cat-tag ${selectedEmail.category || 'MANUAL'}`}>
                      {selectedEmail.category || 'MANUAL'}
                    </span>
                  </span>
                </div>

                <div className="email-view-meta-item">
                  <span className="email-view-meta-label">Status:</span>
                  <span className="email-view-meta-value">
                    <span className="email-status-pill">
                      <Check size={12} strokeWidth={2.5} />
                      <span>{selectedEmail.status || 'SENT'}</span>
                    </span>
                  </span>
                </div>

                {selectedEmail.hasAttachment && (
                  <div className="email-view-attachment-row">
                    <span className="email-view-meta-label">Attachment:</span>
                    <span className="email-view-attachment-badge">
                      <Paperclip size={12} strokeWidth={2} />
                      <span>{selectedEmail.attachmentName || 'Invoice Statement.pdf'}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Email HTML Body Section */}
            <div className="email-view-body-section">
              <span className="email-view-body-label">Email Content</span>
              <div
                className="email-view-html-frame"
                dangerouslySetInnerHTML={{
                  __html: selectedEmail.bodyHtml || '<p style="color: var(--ink-faint);">No content preview available</p>',
                }}
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
