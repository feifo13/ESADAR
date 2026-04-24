import StatusBadge from './StatusBadge.jsx';

const STATUS_LABELS = {
  RESERVED: 'Reservada',
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  SHIPPED: 'Enviada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
};

export default function OrderStatusBadge({ status }) {
  return <StatusBadge status={status} labels={STATUS_LABELS} />;
}
