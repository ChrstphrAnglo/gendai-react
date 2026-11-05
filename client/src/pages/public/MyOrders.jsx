import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import StatusBadge from '../../components/common/StatusBadge';
import useBodyClass from '../../hooks/useBodyClass';
import { formatDateTime, peso } from '../../utils/format';
import '../../styles/success.css';

export default function MyOrders() {
  useBodyClass('success-page');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/orders/mine')
      .then(({ data }) => setOrders(data))
      .catch((err) => setError(errorMessage(err, 'Could not load your orders.')));
  }, []);

  return (
    <div className="success-card orders-card">
      <h1>My orders</h1>

      {error && <p className="success-cancelled" role="alert">{error}</p>}
      {!orders && !error && <div className="loading-spinner" />}

      {orders && orders.length === 0 && (
        <p className="success-sub">You have not placed any orders yet.</p>
      )}

      {orders && orders.length > 0 && (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o._id}>
              <Link to={`/order-success/${o._id}`} className="order-row">
                <span className="order-row-main">
                  <strong>{o.orderNo}</strong>
                  <span className="order-row-sub">
                    {formatDateTime(o.createdAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)} items
                  </span>
                </span>
                <span className="order-row-side">
                  <StatusBadge status={o.status} />
                  <strong>{peso(o.totalAmount)}</strong>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="success-actions">
        <Link to="/menu" className="success-btn">Order food</Link>
      </div>
    </div>
  );
}
