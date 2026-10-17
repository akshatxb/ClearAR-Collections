import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/endpoints';
import './NotificationBell.css';

const POLL_MS = 30000;

const LABEL_BY_TYPE = {
  escalation: 'Escalation',
  co_actor_task: 'Outreach request',
  outreach_completed: 'Outreach completed',
};

function describe(n) {
  let payload;
  try {
    payload = n.payload ? JSON.parse(n.payload) : {};
  } catch {
    payload = {};
  }
  const label = LABEL_BY_TYPE[n.type] || n.type;
  if (n.type === 'escalation') {
    return { label, detail: payload.reason || `Account #${payload.accountId}`, accountId: payload.accountId };
  }
  if (n.type === 'co_actor_task') {
    return { label, detail: `New outreach task for account #${payload.accountId}`, accountId: payload.accountId };
  }
  if (n.type === 'outreach_completed') {
    return {
      label,
      detail: `${payload.completedByName || 'Relationship owner'} completed outreach for ${payload.accountName || `account #${payload.accountId}`}`,
      accountId: payload.accountId,
    };
  }
  return { label, detail: '', accountId: payload.accountId };
}

// P1 #51 -- notification system (in-app). Polls every 30s, no WebSockets needed at this scale.
export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  const load = useCallback((unreadOnly = false) => {
    setLoading(true);
    api
      .getNotifications(unreadOnly)
      .then((res) => setItems(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(false);
    const t = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unreadCount = items.filter((n) => !n.read).length;

  async function handleOpen(n) {
    const { accountId } = describe(n);
    if (!n.read) {
      try {
        await api.markNotificationRead(n.id);
        setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      } catch {
        /* non-fatal */
      }
    }
    setOpen(false);
    if (accountId) navigate(`/accounts/${accountId}`);
  }

  return (
    <div className="notif-bell" ref={boxRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown" role="menu">
          <div className="notif-dropdown-head">
            <span>Notifications</span>
            {loading && <span className="notif-dropdown-loading">Refreshing…</span>}
          </div>
          {items.length === 0 ? (
            <p className="empty-state" style={{ padding: '18px 12px' }}>
              You're all caught up.
            </p>
          ) : (
            <ul className="notif-list">
              {items.map((n) => {
                const { label, detail } = describe(n);
                return (
                  <li key={n.id}>
                    <button type="button" className={`notif-item${n.read ? '' : ' is-unread'}`} onClick={() => handleOpen(n)}>
                      <span className="notif-item-dot" aria-hidden="true" />
                      <span className="notif-item-body">
                        <span className="notif-item-label">{label}</span>
                        <span className="notif-item-detail">{detail}</span>
                        <span className="notif-item-time">{new Date(n.createdAt).toLocaleString()}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
