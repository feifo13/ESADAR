import { cn } from '../lib/format.js';

const STATUS_LABELS = {
  RESERVED: 'Reservada',
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  SHIPPED: 'Enviada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
};

export default function OrderStatusBadge({ status }) {
  const normalized = String(status || '').toUpperCase();
  return <span className={cn('status-badge', `status-${String(status || '').toLowerCase()}`)}>{STATUS_LABELS[normalized] || normalized}</span>;
}
