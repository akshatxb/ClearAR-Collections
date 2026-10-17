const TONE_BY_VALUE = {
  paid: 'good', kept: 'good', resolved: 'good',
  broken: 'bad', open: 'neutral',
  disputed: 'warn', investigating: 'warn', pending: 'neutral',
  under_review: 'warn',
};

export default function StatusPill({ value }) {
  const tone = TONE_BY_VALUE[value] || 'neutral';
  return <span className={`status-pill tone-${tone}`}>{value}</span>;
}
