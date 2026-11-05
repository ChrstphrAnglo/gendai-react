import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import PaymentDetails from '../../components/common/PaymentDetails';
import useBodyClass from '../../hooks/useBodyClass';
import { paymentLabel } from '../../utils/format';
import '../../styles/success.css';

// Delivery payment by QR Ph, GCash or bank transfer: the money goes straight to the restaurant's
// account, the customer tells us it is sent, and staff confirm it before the order goes out.
export default function Pay() {
  useBodyClass('success-page');
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => setOrder(data))
      .catch((err) => setError(errorMessage(err, 'Could not load your order.')));
    api.get('/settings').then(({ data }) => setPayment(data.payment)).catch(() => setPayment({}));
  }, [id]);

  const pay = async () => {
    setPaying(true);
    setError('');
    try {
      await api.post(`/orders/${id}/pay`, { reference: reference.trim() || undefined });
      navigate(`/order-success/${id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not send your payment. Please try again.'));
      setPaying(false);
    }
  };

  if (!order && !error) return <div className="loading-container"><div className="loading-spinner" /></div>;
  if (!order) {
    return (
      <div className="success-card">
        <h1>Order not found</h1>
        <p>{error}</p>
        <Link to="/menu" className="success-btn">Back to the menu</Link>
      </div>
    );
  }
  if (order.paymentMethod === 'cash' || order.paymentStatus !== 'unpaid' || order.status === 'cancelled') {
    return <Navigate to={`/order-success/${id}`} replace />;
  }

  return (
    <div className="success-card pay-card">
      <h1>Pay for your order</h1>
      <p className="success-sub">{paymentLabel(order.paymentMethod)} · Order {order.orderNo}</p>

      <h2 className="pay-step"><span>1</span> Send the exact amount</h2>
      {payment ? <PaymentDetails method={order.paymentMethod} amount={order.totalAmount} payment={payment} /> : <div className="loading-spinner" />}

      <h2 className="pay-step"><span>2</span> Tell us it is sent</h2>
      <label className="pay-ref">
        <span>Reference number (optional)</span>
        <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} placeholder="From your payment receipt" />
      </label>

      {error && <p className="success-cancelled" role="alert">{error}</p>}

      <div className="success-actions">
        <Link to={`/order-success/${id}`} className="success-btn secondary">Pay later</Link>
        <button type="button" className="success-btn" onClick={pay} disabled={paying}>
          {paying ? 'Sending…' : "I've paid"}
        </button>
      </div>
      <p className="pay-demo">We check that the payment arrived before your order is dispatched.</p>
    </div>
  );
}
