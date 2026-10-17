// Renders the explainable-scoring factor breakdown as one horizontal bar per
// factor, per spec P0.3 #9: "React panel renders as horizontal bar chart, one
// bar per factor." Enhanced with bidirectional penalty vs relief bars and urgency bands.

const FACTOR_NAMES = {
  overdue_days: 'Days Overdue (Weighted DPD)',
  invoice_value: 'Open Balance ($k)',
  broken_ptp_count: 'Broken Promises-to-Pay',
  dispute_count: 'Open Disputes',
  active_ptp_grace: 'Active PTP Grace (Relief)',
  ptp_kept_ratio: 'PTP Kept Ratio (Reliability)',
  recent_payment_value: 'Recent Payments ($k)',
};

export default function ScoreBreakdown({ factors, totalScore }) {
  if (!factors || factors.length === 0) {
    return <p className="empty-state">No score computed yet for this account.</p>;
  }
  const maxContribution = Math.max(...factors.map((f) => Math.abs(f.contribution)), 1);

  const score = Number(totalScore || 0);
  const band = getScoreBand(score);

  return (
    <div className="score-breakdown">
      <div className="score-breakdown-total">
        <span className="score-breakdown-total-value num">{score.toFixed(1)}</span>
        <span className="score-breakdown-total-label">priority score</span>
        <span className={`score-breakdown-band ${band.className}`}>
          {band.label} Priority
        </span>
      </div>
      <div className="score-breakdown-bars">
        {factors.map((f) => {
          const contrib = Number(f.contribution || 0);
          const isRelief = contrib < 0 || f.direction < 0 || (
            f.factor === 'active_ptp_grace' || f.factor === 'ptp_kept_ratio' || f.factor === 'recent_payment_value'
          );
          const pct = Math.max(4, (Math.abs(contrib) / maxContribution) * 100);
          const sign = contrib > 0 ? '+' : '';

          return (
            <div className="score-bar-row" key={f.factor}>
              <div className="score-bar-row-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="score-bar-label">{formatFactorName(f.factor)}</span>
                  {isRelief ? (
                    <span style={{ fontSize: '10px', color: '#059669', fontWeight: 600 }}>[Relief]</span>
                  ) : (
                    <span style={{ fontSize: '10px', color: '#d96f20', fontWeight: 600 }}>[Risk]</span>
                  )}
                </div>
                <span
                  className="score-bar-value num"
                  style={{ color: isRelief && contrib < 0 ? '#059669' : undefined }}
                >
                  {sign}{contrib.toFixed(1)}
                </span>
              </div>
              <div className="score-bar-track">
                <div
                  className={`score-bar-fill ${isRelief ? 'score-bar-fill-relief' : 'score-bar-fill-penalty'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="score-bar-raw num">
                <span>raw: {formatRaw(f.rawValue, f.factor)}</span>
                <span style={{ color: isRelief ? '#059669' : 'var(--ink-faint)' }}>
                  {isRelief ? '− urgency' : '+ urgency'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getScoreBand(score) {
  if (score >= 8.0) return { label: 'Critical', className: 'score-band-critical' };
  if (score >= 5.5) return { label: 'High', className: 'score-band-high' };
  if (score >= 3.0) return { label: 'Medium', className: 'score-band-medium' };
  return { label: 'Low', className: 'score-band-low' };
}

function formatFactorName(key) {
  return FACTOR_NAMES[key] || key.replace(/_/g, ' ');
}

function formatRaw(v, key) {
  if (key === 'ptp_kept_ratio') {
    return `${Math.round(Number(v) * 100)}%`;
  }
  return Number.isInteger(v) ? v : Number(v).toFixed(1);
}
