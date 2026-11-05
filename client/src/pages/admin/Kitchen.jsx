import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { chime } from '../../utils/chime';
import { minutesAgo } from '../../utils/format';
import SoundToggle from '../../components/admin/SoundToggle';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'dine_in', label: 'Dine in' },
  { value: 'takeout', label: 'Take out' },
  { value: 'delivery', label: 'Delivery' },
];

// What the next tap does for each kind of order.
const NEXT = {
  preparing: { dine_in: ['ready', 'Ready'], takeout: ['ready', 'Ready'], delivery: ['out_for_delivery', 'Out for delivery'] },
  ready: { dine_in: ['served', 'Served'], takeout: ['completed', 'Picked up'] },
};

function Ticket({ order, onAdvance, busy }) {
  const channel = order.channel || 'delivery';
  const next = NEXT[order.status]?.[channel];
  const mins = minutesAgo(order.createdAt);
  const late = order.status === 'preparing' && mins >= 20;
  const title = channel === 'dine_in' ? `Table ${order.tableLabel}`
    : channel === 'takeout' ? `Take out · ${order.customerName}`
      : 'Delivery';

  return (
    <article className={`ticket ticket-${channel} ${order.status === 'ready' ? 'is-ready' : ''} ${late ? 'is-late' : ''}`}>
      <header className="ticket-head">
        <div>
          <span className="ticket-kind">{channel === 'dine_in' ? 'Dine in' : channel === 'takeout' ? 'Take out' : 'Delivery'}</span>
          <h3>{title}</h3>
        </div>
        <span className="ticket-time" title={new Date(order.createdAt).toLocaleTimeString()}>{mins}′</span>
      </header>
      <ul className="ticket-items">
        {order.items.map((l) => (
          <li key={l._id}><strong>{l.quantity}×</strong> {l.menuItem?.name || 'Item'}</li>
        ))}
      </ul>
      {order.notes && <p className="ticket-notes">{order.notes}</p>}
      <footer className="ticket-foot">
        <span className="ticket-no">{order.orderNo}</span>
        {next && (
          <button type="button" className={`btn ${order.status === 'ready' ? 'btn-ghost' : 'btn-primary'}`} disabled={busy} onClick={() => onAdvance(order, next[0])}>
            {next[1]}
          </button>
        )}
      </footer>
    </article>
  );
}

// Live ticket board. Paid take-outs, dine-in rounds and delivery orders all show up here.
export default function Kitchen() {
  const toast = useToast();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState('');
  const seen = useRef(null);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/service/kitchen');
      const ids = new Set(data.map((o) => o._id));
      if (seen.current && data.some((o) => o.status === 'preparing' && !seen.current.has(o._id))) chime('order');
      seen.current = ids;
      setOrders(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load the kitchen board.'));
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    const clock = setInterval(() => tick((n) => n + 1), 30000); // refresh the minute counters
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  const advance = async (order, status) => {
    setBusyId(order._id);
    try {
      await api.put(`/orders/${order._id}/status`, { status });
      await load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId('');
    }
  };

  const shown = (orders || []).filter((o) => !filter || (o.channel || 'delivery') === filter);
  const cooking = shown.filter((o) => o.status === 'preparing');
  const ready = shown.filter((o) => o.status === 'ready');

  return (
    <>
      <div className="page-head">
        <h1>Kitchen</h1>
        <div className="page-head-tools">
          <span className="live-dot">Live</span>
          <SoundToggle />
        </div>
      </div>

      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" role="tab" aria-selected={filter === f.value} className={`tab ${filter === f.value ? 'active' : ''}`} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!orders && !error && <div className="loading-container"><div className="loading-spinner" /></div>}

      {orders && (
        <div className="kitchen-board">
          <section className="kitchen-col">
            <h2 className="kitchen-col-title">Cooking <span>{cooking.length}</span></h2>
            {cooking.length === 0 && <div className="empty-state">Nothing to cook. 🍵</div>}
            <div className="ticket-grid">
              {cooking.map((o) => <Ticket key={o._id} order={o} onAdvance={advance} busy={busyId === o._id} />)}
            </div>
          </section>
          <section className="kitchen-col">
            <h2 className="kitchen-col-title">Ready to hand over <span>{ready.length}</span></h2>
            {ready.length === 0 && <div className="empty-state">No orders waiting.</div>}
            <div className="ticket-grid">
              {ready.map((o) => <Ticket key={o._id} order={o} onAdvance={advance} busy={busyId === o._id} />)}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
