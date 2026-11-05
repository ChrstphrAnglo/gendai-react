const LABEL = { awaiting_payment: 'awaiting payment', completed: 'picked up' };

// Props: status, e.g. 'preparing' | 'ready' | 'out_for_delivery' | 'served' | 'cancelled'
export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{LABEL[status] || status.replace(/_/g, ' ')}</span>;
}
