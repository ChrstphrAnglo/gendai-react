import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import StatusBadge from '../../components/common/StatusBadge';
import SoundToggle from '../../components/admin/SoundToggle';
import { ago, formatDateTime, paymentLabel, peso } from '../../utils/format';

const who = (s) => (s.kind === 'takeout' ? `Take out · ${s.guestName || s.code}` : `Table ${s.tableLabel}`);

function BillItems({ session }) {
  return (
    <table className="data-table compact">
      <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Subtotal</th></tr></thead>
      <tbody>
        {session.orders.flatMap((o) => o.items.map((l) => (
          <tr key={l._id} className={o.status === 'cancelled' ? 'is-cancelled' : ''}>
            <td>{l.menuItem?.name || 'Item'}</td>
            <td className="num">{l.quantity}</td>
            <td className="num">{peso(l.subtotal)}</td>
          </tr>
        )))}
      </tbody>
      <tfoot><tr><td colSpan={2}>Total</td><td className="num">{peso(session.totalAmount)}</td></tr></tfoot>
    </table>
  );
}

// Payment requests from tables (cash to collect, QR / bank transfers to verify) and every open bill.
export default function FrontDesk() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState('');
  // New payment requests chime from AdminLayout, which watches them on every staff page.
  const load = useCallback(async () => {
    try {
      const { data: next } = await api.get('/service/front-desk');
      setData(next);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load the front desk.'));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const confirm = async (session) => {
    setBusy(session._id);
    try {
      await api.post(`/service/sessions/${session._id}/confirm`);
      toast(`${who(session)} paid · ${peso(session.totalAmount)}`);
      setViewing(null);
      await load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy('');
    }
  };

  const cancel = async () => {
    setBusy(cancelling._id);
    try {
      await api.post(`/service/sessions/${cancelling._id}/cancel`);
      toast(`${who(cancelling)} closed without payment`);
      setCancelling(null);
      setViewing(null);
      await load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy('');
    }
  };

  const sessions = data?.sessions || [];
  const requests = sessions.filter((s) => s.status === 'payment_pending');
  const open = sessions.filter((s) => s.status === 'open');

  return (
    <>
      <div className="page-head">
        <h1>Front desk</h1>
        <div className="page-head-tools">
          <span className="live-dot">Live</span>
          <SoundToggle />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!data && !error && <div className="loading-container"><div className="loading-spinner" /></div>}

      {data && (
        <>
          <section className="desk-section">
            <h2 className="kitchen-col-title">Needs attention <span>{requests.length}</span></h2>
            {requests.length === 0 && <div className="card empty-state">No payment requests right now.</div>}
            <div className="desk-grid">
              {requests.map((s) => {
                const cash = s.paymentMethod === 'cash';
                return (
                  <article key={s._id} className={`desk-alert ${cash ? 'is-cash' : 'is-online'}`}>
                    <div className="desk-alert-top">
                      <span className={`desk-method m-${s.paymentMethod}`}>{paymentLabel(s.paymentMethod)}</span>
                      <span className="muted">{ago(s.paymentRequestedAt)}</span>
                    </div>
                    <h3>{who(s)}</h3>
                    <strong className="desk-amount">{peso(s.totalAmount)}</strong>
                    <p className="desk-instruction">
                      {cash
                        ? (s.kind === 'takeout' ? 'Guest will pay cash at the counter.' : `Go to Table ${s.tableLabel} and collect the cash.`)
                        : <>Check the restaurant&apos;s {paymentLabel(s.paymentMethod)} account for this amount{s.paymentReference ? <> · ref. <b>{s.paymentReference}</b></> : ' (no reference given)'}.</>}
                    </p>
                    <div className="desk-actions">
                      <button type="button" className="btn btn-primary" disabled={busy === s._id} onClick={() => confirm(s)}>
                        {cash ? 'Cash received' : 'Payment received'}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setViewing(s)}>View bill</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="desk-section">
            <h2 className="kitchen-col-title">Open bills <span>{open.length}</span></h2>
            {open.length === 0 && <div className="card empty-state">No open tables.</div>}
            <div className="desk-grid">
              {open.map((s) => {
                const live = s.orders.filter((o) => o.status !== 'cancelled');
                return (
                  <article key={s._id} className="desk-bill" onClick={() => setViewing(s)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setViewing(s)}>
                    <div className="desk-alert-top">
                      <span className="ticket-kind">{s.kind === 'takeout' ? 'Take out · awaiting payment' : 'Dine in'}</span>
                      <span className="muted">{s.code}</span>
                    </div>
                    <h3>{who(s)}</h3>
                    <strong className="desk-amount">{peso(s.totalAmount)}</strong>
                    <div className="desk-statuses">
                      {live.map((o) => <StatusBadge key={o._id} status={o.status} />)}
                    </div>
                    <span className="muted">{live.length} {live.length === 1 ? 'order' : 'orders'} · since {formatDateTime(s.createdAt)}</span>
                  </article>
                );
              })}
            </div>
          </section>

          {data.recent.length > 0 && (
            <section className="desk-section">
              <h2 className="kitchen-col-title">Paid today</h2>
              <div className="card flush">
                <table className="data-table">
                  <thead><tr><th>Bill</th><th>Where</th><th>Method</th><th>Reference</th><th className="num">Amount</th><th>Paid</th><th>By</th></tr></thead>
                  <tbody>
                    {data.recent.map((s) => (
                      <tr key={s._id}>
                        <td data-label="Bill"><strong>{s.code}</strong></td>
                        <td data-label="Where">{who(s)}</td>
                        <td data-label="Method">{paymentLabel(s.paymentMethod)}</td>
                        <td data-label="Reference">{s.paymentReference || '—'}</td>
                        <td data-label="Amount" className="num">{peso(s.totalAmount)}</td>
                        <td data-label="Paid">{formatDateTime(s.paidAt)}</td>
                        <td data-label="By">{s.handledBy?.username || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {viewing && (
        <Modal
          title={`${who(viewing)} · ${viewing.code}`}
          onClose={() => setViewing(null)}
          footer={(
            <>
              <button type="button" className="btn btn-danger-ghost" onClick={() => setCancelling(viewing)}>Close without payment</button>
              <button type="button" className="btn btn-primary" disabled={busy === viewing._id} onClick={() => confirm(viewing)}>
                Mark paid{viewing.paymentMethod ? ` (${paymentLabel(viewing.paymentMethod)})` : ' (cash)'}
              </button>
            </>
          )}
        >
          <dl className="detail-list">
            <div><dt>Status</dt><dd>{viewing.status === 'payment_pending' ? 'Payment requested' : 'Open'}</dd></div>
            <div><dt>Payment</dt><dd>{viewing.paymentMethod ? paymentLabel(viewing.paymentMethod) : 'Not chosen yet'}</dd></div>
            {viewing.paymentReference && <div><dt>Reference</dt><dd>{viewing.paymentReference}</dd></div>}
            <div><dt>Opened</dt><dd>{formatDateTime(viewing.createdAt)}</dd></div>
          </dl>
          <BillItems session={viewing} />
        </Modal>
      )}

      {cancelling && (
        <ConfirmDialog
          title="Close this bill without payment?"
          message={`${who(cancelling)} (${peso(cancelling.totalAmount)}) will be closed and its orders cancelled. Use this for walk-outs, mistakes or abandoned take-outs.`}
          confirmLabel="Close bill"
          danger
          busy={busy === cancelling._id}
          onConfirm={cancel}
          onCancel={() => setCancelling(null)}
        />
      )}
    </>
  );
}
