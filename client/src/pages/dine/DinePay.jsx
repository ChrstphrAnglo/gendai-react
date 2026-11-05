import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { useDine } from '../../context/DineContext';
import PaymentDetails from '../../components/common/PaymentDetails';
import { paymentLabel, peso } from '../../utils/format';

const METHODS = [
  { value: 'qrph', title: 'QR Ph', sub: 'Any bank or e-wallet app', icon: 'QR' },
  { value: 'gcash', title: 'GCash', sub: 'Scan or send to our number', icon: 'G' },
  { value: 'bank_transfer', title: 'Bank transfer', sub: 'InstaPay / PESONet', icon: '₱' },
  { value: 'cash', title: 'Cash', sub: 'Our staff will come to you', icon: '円' },
];

// Settle the bill: QR Ph, GCash and bank transfer go straight to the restaurant's account (the guest
// then taps "I've paid"); cash alerts the front desk. Staff confirm either way.
export default function DinePay() {
  const navigate = useNavigate();
  const { session, payment, loadPayment, requestPayment, cancelPayment } = useDine();
  const [method, setMethod] = useState(session.status === 'payment_pending' ? session.paymentMethod : '');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadPayment().catch(() => setError('Could not load payment details.')); }, [loadPayment]);

  const orders = session.orders.filter((o) => o.status !== 'cancelled');
  if (session.status === 'paid' || session.status === 'cancelled') return <Navigate to="/dine/bill" replace />;
  if (orders.length === 0) return <Navigate to="/dine" replace />;

  const pending = session.status === 'payment_pending';
  const takeout = session.kind === 'takeout';

  const submit = async (chosen) => {
    setBusy(true);
    setError('');
    try {
      await requestPayment(chosen, chosen === 'cash' ? undefined : reference.trim() || undefined);
    } catch (err) {
      setError(errorMessage(err, 'Could not send your payment. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const change = async () => {
    setBusy(true);
    try {
      await cancelPayment();
      setMethod('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // ---- Waiting for staff to confirm ----
  if (pending) {
    const cash = session.paymentMethod === 'cash';
    return (
      <section className="dine-panel dine-waiting fx-enter">
        <div className="dine-pulse" aria-hidden="true"><span /><span /><span className="fx-sun" /></div>
        <p className="fx-label">{paymentLabel(session.paymentMethod)}</p>
        <h1>{cash ? 'A staff member is on the way' : 'Checking your payment'}</h1>
        <p className="dine-waiting-sub">
          {cash
            ? <>Please have <strong>{peso(session.totalAmount)}</strong> ready{takeout ? ' at the counter' : ` at Table ${session.tableLabel}`}.</>
            : <>We are confirming <strong>{peso(session.totalAmount)}</strong> arrived in our account{session.paymentReference ? <> (ref. {session.paymentReference})</> : null}. This screen updates by itself.</>}
        </p>
        {!cash && <PaymentDetails method={session.paymentMethod} amount={session.totalAmount} payment={payment || {}} />}
        {error && <p className="dine-error" role="alert">{error}</p>}
        <button type="button" className="dine-link" onClick={change} disabled={busy}>Use a different payment method</button>
      </section>
    );
  }

  return (
    <div className="dine-pay">
      <section className="dine-panel fx-enter">
        <div className="dine-panel-head">
          <h1>{takeout ? 'Pay for your order' : 'Pay your bill'}</h1>
          <button type="button" className="dine-link" onClick={() => navigate('/dine/bill')}>View items</button>
        </div>
        <div className="dine-pay-total">
          <span>Total due</span>
          <strong>{peso(session.totalAmount)}</strong>
        </div>

        <div className="dine-methods" role="radiogroup" aria-label="Payment method">
          {METHODS.map((m, i) => (
            <button
              type="button"
              role="radio"
              aria-checked={method === m.value}
              key={m.value}
              className={`dine-method fx-enter ${method === m.value ? 'selected' : ''}`}
              style={{ '--d': i + 1 }}
              onClick={() => { setMethod(m.value); setError(''); }}
            >
              <span className={`dine-method-icon m-${m.value}`}>{m.icon}</span>
              <span className="dine-method-title">{m.title}</span>
              <span className="dine-method-sub">{m.value === 'cash' && takeout ? 'Pay at the counter' : m.sub}</span>
            </button>
          ))}
        </div>
        <p className="dine-hint">Card payments are not available yet.</p>
      </section>

      {method && method !== 'cash' && (
        <section className="dine-panel fx-enter" key={method}>
          <h2 className="dine-step-title"><span>1</span> Send {peso(session.totalAmount)} with {paymentLabel(method)}</h2>
          {payment ? <PaymentDetails method={method} amount={session.totalAmount} payment={payment} /> : <div className="loading-spinner" />}
          <h2 className="dine-step-title"><span>2</span> Tell us you have paid</h2>
          <label className="dine-field">
            <span>Reference number <em>(from your receipt, helps us find it)</em></span>
            <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} placeholder="e.g. 1029 384 756" inputMode="text" />
          </label>
          {error && <p className="dine-error" role="alert">{error}</p>}
          <button type="button" className="dine-btn dine-btn-primary dine-btn-block fx-shine" onClick={() => submit(method)} disabled={busy}>
            {busy ? 'Sending…' : "I've paid"}
          </button>
        </section>
      )}

      {method === 'cash' && (
        <section className="dine-panel fx-enter" key="cash">
          <h2 className="dine-step-title"><span>円</span> Pay {peso(session.totalAmount)} in cash</h2>
          <p className="dine-hint">{takeout ? 'Pay at the counter. We start cooking once it is paid.' : 'We will let the front desk know. A staff member will come to your table to collect it.'}</p>
          {error && <p className="dine-error" role="alert">{error}</p>}
          <button type="button" className="dine-btn dine-btn-primary dine-btn-block fx-shine" onClick={() => submit('cash')} disabled={busy}>
            {busy ? 'Notifying…' : takeout ? 'I will pay at the counter' : 'Call staff to pay cash'}
          </button>
        </section>
      )}
    </div>
  );
}
