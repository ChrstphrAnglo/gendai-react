import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import SearchBar from '../../components/common/SearchBar';
import DateRangeFilter from '../../components/common/DateRangeFilter';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { CHANNEL_LABEL, peso, formatDateTime, paymentLabel } from '../../utils/format';

const TABS = [
  { value: '', label: 'All' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'served', label: 'Served' },
  { value: 'completed', label: 'Picked up' },
  { value: 'cancelled', label: 'Cancelled' },
];
const TYPES = [
  { value: '', label: 'All types' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'dine_in', label: 'Dine in' },
  { value: 'takeout', label: 'Take out' },
];
const STATUS_LABEL = Object.fromEntries(TABS.map((t) => [t.value, t.label]));
// Statuses staff can pick for each kind of order (mirrors the server's rules).
const STATUS_OPTIONS = {
  delivery: ['preparing', 'out_for_delivery', 'delivered', 'cancelled'],
  dine_in: ['preparing', 'ready', 'served', 'cancelled'],
  takeout: ['preparing', 'ready', 'completed', 'cancelled'],
};

const addressLine = (a = {}) => [a.street, a.barangay, a.city].filter(Boolean).join(', ');
const whereLine = (o) => {
  if (o.channel === 'dine_in') return `Table ${o.tableLabel}`;
  if (o.channel === 'takeout') return `Pickup (${o.tableLabel})`;
  return addressLine(o.deliveryAddress) || '—';
};

export default function Orders() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const q = useDebounce(search);
  const rangeInvalid = range.from && range.to && range.from > range.to;

  const load = useCallback(async () => {
    if (rangeInvalid) return;
    try {
      const { data } = await api.get('/orders', {
        params: { status: status || undefined, channel: channel || undefined, search: q || undefined, from: range.from || undefined, to: range.to || undefined },
      });
      setOrders(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load orders.'));
    } finally {
      setLoading(false);
    }
  }, [status, channel, q, range.from, range.to, rangeInvalid]);

  // Reload when filters change, and poll so new customer orders appear on their own.
  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const changeStatus = async (order, next) => {
    try {
      const { data } = await api.put(`/orders/${order._id}/status`, { status: next });
      setOrders((prev) => prev.map((o) => (o._id === data._id ? { ...o, ...data, handledBy: { username: user.username } } : o)));
      if (viewing?._id === data._id) setViewing(data);
      toast(`${order.orderNo} marked ${next.replace(/_/g, ' ')}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const markPaid = async (order) => {
    try {
      const { data } = await api.put(`/orders/${order._id}/paid`);
      setOrders((prev) => prev.map((o) => (o._id === data._id ? { ...o, ...data, handledBy: { username: user.username } } : o)));
      if (viewing?._id === data._id) setViewing(data);
      toast(order.session ? `${order.orderNo}: bill marked as paid` : `${order.orderNo} marked as paid`);
      if (order.session) load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/orders/${deleting._id}`);
      setOrders((prev) => prev.filter((o) => o._id !== deleting._id));
      toast(`${deleting.orderNo} deleted`);
      setDeleting(null);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'orderNo', header: 'Order', render: (o) => <strong>{o.orderNo}</strong> },
    { key: 'channel', header: 'Type', render: (o) => <span className={`type-pill type-${o.channel || 'delivery'}`}>{CHANNEL_LABEL[o.channel || 'delivery']}</span> },
    {
      key: 'customerName',
      header: 'Customer',
      render: (o) => (
        <>
          {o.customerName}
          {o.contactPhone && <div className="muted small">{o.contactPhone}</div>}
        </>
      ),
    },
    { key: 'address', header: 'Where', render: whereLine },
    { key: 'items', header: 'Items', render: (o) => o.items.reduce((n, i) => n + i.quantity, 0) },
    {
      key: 'payment',
      header: 'Payment',
      render: (o) => (
        <>
          {o.paymentMethod ? paymentLabel(o.paymentMethod) : <span className="muted">{o.channel === 'dine_in' ? 'At end of meal' : 'Not chosen'}</span>}
          <div><span className={`status-badge status-${o.paymentStatus || 'unpaid'}`}>{o.paymentStatus || 'unpaid'}</span></div>
        </>
      ),
    },
    { key: 'totalAmount', header: 'Total', className: 'num', render: (o) => peso(o.totalAmount) },
    { key: 'createdAt', header: 'Placed', render: (o) => formatDateTime(o.createdAt) },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      className: 'actions',
      render: (o) => (
        <div className="row-actions">
          <select
            value={o.status}
            onChange={(e) => changeStatus(o, e.target.value)}
            aria-label={`Change status of ${o.orderNo}`}
            disabled={o.status === 'awaiting_payment'}
          >
            {o.status === 'awaiting_payment' && <option value="awaiting_payment">Awaiting payment</option>}
            {STATUS_OPTIONS[o.channel || 'delivery'].map((v) => <option key={v} value={v}>{STATUS_LABEL[v]}</option>)}
          </select>
          {o.paymentStatus !== 'paid' && o.status !== 'cancelled' && (
            <button type="button" className={`btn btn-sm ${o.paymentStatus === 'verifying' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => markPaid(o)}>
              {o.paymentStatus === 'verifying' ? 'Confirm payment' : 'Mark paid'}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewing(o)}>View</button>
          {isAdmin && <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setDeleting(o)}>Delete</button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <h1>Orders</h1>
        <span className="muted">{orders.length} shown</span>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={status === t.value}
            className={`tab ${status === t.value ? 'active' : ''}`}
            onClick={() => setStatus(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search customer, table or order no…" />
        <label className="filter-select">
          Type
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card flush">
        <DataTable columns={columns} rows={orders} loading={loading} emptyMessage="No orders match these filters." />
      </div>

      {viewing && (
        <Modal title={`Order ${viewing.orderNo}`} onClose={() => setViewing(null)}>
          <dl className="detail-list">
            <div><dt>Customer</dt><dd>{viewing.customerName}</dd></div>
            <div><dt>Phone</dt><dd>{viewing.contactPhone || '—'}</dd></div>
            <div><dt>Type</dt><dd>{CHANNEL_LABEL[viewing.channel || 'delivery']}</dd></div>
            <div><dt>{viewing.channel === 'delivery' || !viewing.channel ? 'Deliver to' : 'Where'}</dt><dd>{whereLine(viewing)}</dd></div>
            {viewing.deliveryAddress?.notes && <div><dt>Delivery notes</dt><dd>{viewing.deliveryAddress.notes}</dd></div>}
            {viewing.notes && <div><dt>Kitchen notes</dt><dd>{viewing.notes}</dd></div>}
            <div><dt>Payment</dt><dd>{viewing.paymentMethod ? paymentLabel(viewing.paymentMethod) : 'Not chosen yet'} · {viewing.paymentStatus || 'unpaid'}</dd></div>
            {viewing.paymentReference && <div><dt>Reference no.</dt><dd>{viewing.paymentReference}</dd></div>}
            <div><dt>Placed</dt><dd>{formatDateTime(viewing.createdAt)}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={viewing.status} /></dd></div>
            <div><dt>Handled by</dt><dd>{viewing.handledBy?.username || '—'}</dd></div>
          </dl>
          <table className="data-table compact">
            <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Subtotal</th></tr></thead>
            <tbody>
              {viewing.items.map((i) => (
                <tr key={i._id}>
                  <td>{i.menuItem?.name || 'Removed item'}</td>
                  <td className="num">{i.quantity}</td>
                  <td className="num">{peso(i.unitPrice)}</td>
                  <td className="num">{peso(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {viewing.deliveryFee > 0 && <tr><td colSpan={3}>Delivery fee</td><td className="num">{peso(viewing.deliveryFee)}</td></tr>}
              <tr><td colSpan={3}>Total</td><td className="num">{peso(viewing.totalAmount)}</td></tr>
            </tfoot>
          </table>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete order?"
          message={`Permanently delete ${deleting.orderNo}? This removes it from sales reports.`}
          confirmLabel="Delete"
          danger
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
