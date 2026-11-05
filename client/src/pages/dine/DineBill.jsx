import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDine } from '../../context/DineContext';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime, paymentLabel, peso } from '../../utils/format';

const KITCHEN_STEPS = {
  dine_in: ['preparing', 'ready', 'served'],
  takeout: ['awaiting_payment', 'preparing', 'ready', 'completed'],
};
const STEP_LABEL = { awaiting_payment: 'Paid', preparing: 'Cooking', ready: 'Ready', served: 'Served', completed: 'Picked up' };

function Tracker({ order }) {
  const steps = KITCHEN_STEPS[order.channel] || KITCHEN_STEPS.dine_in;
  const at = steps.indexOf(order.status);
  if (order.status === 'cancelled') return <p className="dine-cancelled">This order was cancelled.</p>;
  return (
    <ol className="dine-track" style={{ '--progress': Math.max(at, 0) / (steps.length - 1) }}>
      {steps.map((s, i) => (
        <li key={s} className={`${i <= at ? 'done' : ''} ${i === at ? 'current' : ''}`}>{STEP_LABEL[s]}</li>
      ))}
    </ol>
  );
}

// The table's running bill (dine in) or the take-out order's progress, plus the way to pay.
export default function DineBill() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { session, saved, forget, cancelPayment } = useDine();
  const takeout = session.kind === 'takeout';
  const orders = session.orders.filter((o) => o.status !== 'cancelled');
  const paid = session.status === 'paid';

  // Shared tablets go back to the welcome screen a while after the bill is settled.
  useEffect(() => {
    if (!paid || takeout) return undefined;
    const t = setTimeout(() => { const table = saved?.tableToken; forget(); navigate(`/t/${table}`, { replace: true }); }, 60000);
    return () => clearTimeout(t);
  }, [paid, takeout, saved, forget, navigate]);

  if (paid || session.status === 'cancelled') {
    const ready = orders.some((o) => o.status === 'ready');
    return (
      <section className="dine-panel dine-done fx-enter">
        <div className="success-check" aria-hidden="true">
          <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-15" /></svg>
        </div>
        <p className="fx-jp dine-done-jp">ありがとうございました</p>
        <h1>{session.status === 'cancelled' ? 'This bill was closed' : 'Payment received. Thank you!'}</h1>
        {takeout && session.status === 'paid' && orders[0] && (
          <>
            <p className="dine-done-sub">Order <strong>{session.code}</strong> for {session.guestName}</p>
            <Tracker order={orders[0]} />
            <p className="dine-done-sub">{ready ? 'Your order is ready. Please collect it at the counter.' : 'We will call your name when it is ready.'}</p>
          </>
        )}
        {!takeout && <p className="dine-done-sub">{paymentLabel(session.paymentMethod)} · {peso(session.totalAmount)}. We hope to see you again soon.</p>}
        {!(takeout && session.status === 'paid' && orders.some((o) => o.status !== 'completed')) && (
          <button type="button" className="dine-btn dine-btn-ghost" onClick={() => { const table = saved?.tableToken; forget(); navigate(`/t/${table}`, { replace: true }); }}>
            Done
          </button>
        )}
      </section>
    );
  }

  if (orders.length === 0) {
    return (
      <section className="dine-panel dine-empty fx-enter">
        <span className="fx-jp">空</span>
        <p>No orders yet. Your bill appears here once you send dishes to the kitchen.</p>
        <Link to="/dine" className="dine-btn dine-btn-primary">Browse the menu</Link>
      </section>
    );
  }

  const pending = session.status === 'payment_pending';

  return (
    <div className="dine-bill">
      {state?.justSent && (
        <div className="dine-sent fx-enter" role="status">
          <span className="dine-sent-dot" /> Sent to the kitchen. We will bring it to Table {session.tableLabel}.
        </div>
      )}

      <section className="dine-panel fx-enter">
        <div className="dine-panel-head">
          <h1>{takeout ? `Take-out ${session.code}` : `Table ${session.tableLabel} · Bill`}</h1>
          {takeout && <span className="dine-panel-meta">for {session.guestName}</span>}
        </div>

        {orders.map((o, i) => (
          <article key={o._id} className="dine-round" style={{ '--d': i }}>
            <header>
              <span className="fx-label">{takeout ? 'Your order' : `Round ${i + 1}`} · {formatDateTime(o.createdAt)}</span>
              <StatusBadge status={o.status} />
            </header>
            <Tracker order={o} />
            <ul className="dine-round-items">
              {o.items.map((l) => (
                <li key={l._id}>
                  <span>{l.quantity} × {l.menuItem?.name || 'Item'}</span>
                  <span>{peso(l.subtotal)}</span>
                </li>
              ))}
            </ul>
            {o.notes && <p className="dine-round-notes">“{o.notes}”</p>}
          </article>
        ))}

        <div className="dine-total">
          <span>Total</span>
          <strong key={session.totalAmount}>{peso(session.totalAmount)}</strong>
        </div>
      </section>

      <div className="dine-sticky-cta">
        {pending ? (
          <>
            <button type="button" className="dine-btn dine-btn-primary dine-btn-block" onClick={() => navigate('/dine/pay')}>
              Payment in progress · {paymentLabel(session.paymentMethod)}
            </button>
            <button type="button" className="dine-link" onClick={() => cancelPayment().catch(() => {})}>Cancel and order more</button>
          </>
        ) : (
          <>
            <button type="button" className="dine-btn dine-btn-primary dine-btn-block fx-shine" onClick={() => navigate('/dine/pay')}>
              {takeout ? 'Pay now' : 'Pay bill'} · {peso(session.totalAmount)}
            </button>
            {!takeout && <Link to="/dine" className="dine-link">Order more</Link>}
          </>
        )}
      </div>
    </div>
  );
}
