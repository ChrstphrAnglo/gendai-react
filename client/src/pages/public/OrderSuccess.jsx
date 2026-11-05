import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import StatusBadge from '../../components/common/StatusBadge';
import useBodyClass from '../../hooks/useBodyClass';
import { paymentLabel, peso, statusLabel } from '../../utils/format';
import '../../styles/success.css';

const STEPS = ['preparing', 'out_for_delivery', 'delivered'];

export default function OrderSuccess() {
  useBodyClass('success-page');
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  // Poll so the customer sees their order move from "preparing" to "out for delivery" to "delivered".
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const { data } = await api.get(`/orders/${id}`);
        if (stop) return;
        setOrder(data);
        if (data.status === 'delivered' || data.status === 'cancelled') clearInterval(timer);
      } catch (err) {
        if (!stop) setError(errorMessage(err, 'Could not load your order.'));
      }
    };
    const timer = setInterval(load, 10000);
    load();
    return () => { stop = true; clearInterval(timer); };
  }, [id]);

  if (error) {
    return (
      <div className="success-card">
        <h1>Order not found</h1>
        <p>{error}</p>
        <Link to="/menu" className="success-btn">Back to the menu</Link>
      </div>
    );
  }
  if (!order) return <div className="loading-container"><div className="loading-spinner" /></div>;

  const step = STEPS.indexOf(order.status);
  const address = order.deliveryAddress || {};
  const needsPayment = order.paymentMethod !== 'cash' && order.paymentStatus === 'unpaid' && order.status !== 'cancelled';
  const verifying = order.paymentStatus === 'verifying' && order.status !== 'cancelled';
  const payState = { paid: 'Paid', verifying: 'Checking payment', unpaid: 'Unpaid' }[order.paymentStatus] || 'Unpaid';

  return (
    <div className="success-card">
      <div className="success-check" aria-hidden="true">
        <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-15" /></svg>
      </div>
      <h1>Thank you, {order.customerName}!</h1>
      <p className="success-sub">Your order has been placed.</p>

      <div className="order-no">
        <span>Order number</span>
        <strong>{order.orderNo}</strong>
      </div>

      {order.status === 'cancelled' ? (
        <p className="success-cancelled">This order was cancelled. Please contact the restaurant.</p>
      ) : (
        <ol className="progress" style={{ '--progress': Math.max(step, 0) / (STEPS.length - 1) }}>
          {STEPS.map((s, i) => (
            <li key={s} className={`${i <= step ? 'done' : ''} ${i === step && order.status !== 'delivered' ? 'current' : ''}`}>{statusLabel(s)}</li>
          ))}
        </ol>
      )}

      <p className="success-meta">
        <StatusBadge status={order.status} />{' '}
        {order.paymentMethod === 'cash' ? 'Cash on Delivery' : paymentLabel(order.paymentMethod)} · {payState}
      </p>

      {verifying && (
        <p className="success-verifying">We are confirming your payment{order.paymentReference ? ` (ref. ${order.paymentReference})` : ''}. This page updates by itself.</p>
      )}
      {needsPayment && (
        <p className="success-pay-note">
          Payment pending. <Link to={`/pay/${order._id}`} className="auth-link">Complete payment</Link>
        </p>
      )}

      <div className="success-address">
        <strong>Delivering to</strong>
        <span>{order.customerName} · {order.contactPhone}</span>
        <span>{[address.street, address.barangay, address.city].filter(Boolean).join(', ')}</span>
        {address.notes && <span className="success-notes">{address.notes}</span>}
      </div>

      <ul className="success-items">
        {order.items.map((l) => (
          <li key={l._id}>
            <span>{l.quantity} × {l.menuItem?.name || 'Item'}</span>
            <span>{peso(l.subtotal)}</span>
          </li>
        ))}
        <li><span>Delivery fee</span><span>{peso(order.deliveryFee)}</span></li>
        <li className="success-total"><span>Total</span><span>{peso(order.totalAmount)}</span></li>
      </ul>

      <div className="success-actions">
        <Link to="/orders" className="success-btn secondary">My orders</Link>
        <Link to="/menu" className="success-btn">Order more</Link>
      </div>
    </div>
  );
}
