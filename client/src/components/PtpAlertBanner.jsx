import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/endpoints';

// P1 #35 -- PTPs due within 24h, surfaced as a dashboard banner/notification.
export default function PtpAlertBanner({ orgId }) {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    api
      .getPtpAlerts(orgId)
      .then((res) => setAlerts(res.data))
      .catch(() => setAlerts([]));
  }, [orgId]);

  if (dismissed || alerts.length === 0) return null;

  return (
    <div className="warn-banner" role="alert">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span>
          <strong>Action Required:</strong> {alerts.length} promise-to-pay{alerts.length === 1 ? '' : 's'} due within 24h —{' '}
          <Link to={`/accounts/${alerts[0].accountId}`}>view account #{alerts[0].accountId}</Link>
          {alerts.length > 1 ? ` and ${alerts.length - 1} more` : ''}.
        </span>
      </div>
      <button 
        type="button" 
        className="btn-quiet" 
        onClick={() => setDismissed(true)}
        style={{ fontSize: '12.5px', padding: '4px 8px' }}
      >
        Dismiss
      </button>
    </div>
  );
}
