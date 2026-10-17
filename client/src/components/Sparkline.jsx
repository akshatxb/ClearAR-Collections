// P1 #37 -- small inline SVG sparkline for account_scores history with smooth gradient area fill
export default function Sparkline({ points, width = 240, height = 54 }) {
  if (!points || points.length < 2) {
    return <p className="empty-state">Not enough score history yet for a trend.</p>;
  }

  const values = points.map((p) => p.totalScore);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);

  const coords = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 12) - 6;
    return [x, y];
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [firstX] = coords[0];
  const [lastX, lastY] = coords[coords.length - 1];
  const areaPath = `${linePath} L${lastX.toFixed(1)},${height} L${firstX.toFixed(1)},${height} Z`;

  const diff = values[values.length - 1] - values[0];

  return (
    <div className="sparkline">
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        width="100%" 
        height={height} 
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkline-grad)" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastY} r="3.5" fill="var(--accent-strong)" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
      <div className="sparkline-meta">
        <span>Initial: {values[0].toFixed(1)}</span>
        <span className="sparkline-meta-now num">
          {values[values.length - 1].toFixed(1)} now 
          <span style={{ marginLeft: '4px', fontSize: '10.5px', color: diff >= 0 ? 'var(--warn)' : 'var(--success)' }}>
            ({diff >= 0 ? '+' : ''}{diff.toFixed(1)})
          </span>
        </span>
      </div>
    </div>
  );
}
