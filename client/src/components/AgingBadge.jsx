const HEAT_KEY = {
  current: 'current',
  '0-30': '0-30',
  '31-60': '31-60',
  '61-90': '61-90',
  '90+': '90plus',
};

export default function AgingBadge({ bucket, large = false, className = '' }) {
  const key = HEAT_KEY[bucket] || 'current';
  return (
    <span
      className={`aging-badge ${large ? 'aging-badge-lg' : ''} ${className}`.trim()}
      style={{
        color: `var(--heat-${key})`,
        background: `var(--heat-${key}-tint)`,
        borderColor: `var(--heat-${key}-border)`,
      }}
    >
      <span
        style={{
          width: large ? '7px' : '5px',
          height: large ? '7px' : '5px',
          borderRadius: '50%',
          backgroundColor: `var(--heat-${key})`,
          display: 'inline-block',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      {bucket}
    </span>
  );
}
