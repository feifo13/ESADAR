import { cn } from '../lib/format.js';

export default function OrderStatusBadge({ status }) {
  return <span className={cn('status-badge', `status-${String(status || '').toLowerCase()}`)}>{status}</span>;
}
