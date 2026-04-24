import { cn } from '../lib/format.js';

export default function StatusBadge({ status, labels = {} }) {
  const normalized = String(status || '').toUpperCase();
  return (
    <span className={cn('status-badge', `status-${String(status || '').toLowerCase()}`)}>
      {labels[normalized] || normalized}
    </span>
  );
}
