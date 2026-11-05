import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { guestApi, isActive, useDine } from '../../context/DineContext';
import { errorMessage } from '../../api/client';
import useBodyClass from '../../hooks/useBodyClass';
import { peso } from '../../utils/format';
import '../../styles/dine.css';

// Landing page of a table QR code: choose Dine in or Take out. No login, no links to the delivery app.
// Scanning again later shows the open bill so guests can pay.
export default function DineStart() {
  useBodyClass('dine-page');
  const { tableToken } = useParams();
  const navigate = useNavigate();
  const { saved, session, loading, start, forget } = useDine();
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    guestApi.get(`/tables/${encodeURIComponent(tableToken)}`)
      .then(({ data }) => setLabel(data.label))
      .catch((err) => setError(errorMessage(err, 'This QR code could not be read.')));
  }, [tableToken]);

  // A finished bill on this device is forgotten so the next guest starts clean (shared tablets too).
  useEffect(() => {
    if (session && !isActive(session)) forget();
  }, [session, forget]);

  const sameTable = saved?.tableToken === tableToken;
  const open = sameTable && isActive(session) ? session : null;
  const hasOrders = open && open.orders.length > 0;

  const choose = async (kind) => {
    setBusy(kind);
    setError('');
    try {
      // Re-joining the same dine-in bill keeps the cart; anything else starts a new session.
      if (!(open && open.kind === 'dine_in' && kind === 'dine_in' && open.status !== 'paid')) await start(tableToken, kind);
      navigate('/dine');
    } catch (err) {
      setError(errorMessage(err, 'Could not start your order. Please try again.'));
      setBusy('');
    }
  };

  return (
    <main className="dine-start">
      <span className="dine-start-sun fx-sun" aria-hidden="true" />
      <span className="dine-start-kanji fx-jp" aria-hidden="true">現代</span>

      <div className="dine-start-inner">
        <img src="/new logo 1.png" alt="Gendai Japanese Restaurant" className="dine-start-logo fx-enter" />

        {error && !label ? (
          <div className="dine-start-error fx-enter" role="alert">
            <span className="fx-jp">✕</span>
            <h1>QR code not recognised</h1>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <p className="fx-label fx-enter" style={{ '--d': 1 }}>いらっしゃいませ · Welcome</p>
            <h1 className="fx-enter" style={{ '--d': 2 }}>
              {label ? <>Table <span className="dine-table-chip">{label}</span></> : <span className="dine-skel" />}
            </h1>

            {hasOrders && (
              <div className="dine-open-bill fx-enter" style={{ '--d': 3 }}>
                <div>
                  <span className="fx-label">{open.kind === 'takeout' ? `Take-out ${open.code}` : 'Your open bill'}</span>
                  <strong>{peso(open.totalAmount)}</strong>
                </div>
                <button type="button" className="dine-btn dine-btn-primary fx-shine" onClick={() => navigate('/dine/bill')}>
                  {open.kind === 'takeout' ? 'View order' : 'View bill & pay'}
                </button>
              </div>
            )}

            <p className="dine-start-ask fx-enter" style={{ '--d': 4 }}>
              {hasOrders ? 'Or start something new:' : 'How are you eating today?'}
            </p>
            <div className="dine-choice">
              <button
                type="button"
                className="dine-choice-btn fx-enter"
                style={{ '--d': 5 }}
                onClick={() => choose('dine_in')}
                disabled={!label || Boolean(busy) || loading}
              >
                <span className="dine-choice-jp fx-jp">店内</span>
                <span className="dine-choice-title">{open?.kind === 'dine_in' ? 'Order more' : 'Dine in'}</span>
                <span className="dine-choice-sub">Eat here · we serve it to your table</span>
                {busy === 'dine_in' && <span className="dine-choice-busy" />}
              </button>
              <button
                type="button"
                className="dine-choice-btn fx-enter"
                style={{ '--d': 6 }}
                onClick={() => choose('takeout')}
                disabled={!label || Boolean(busy) || loading}
              >
                <span className="dine-choice-jp fx-jp">持帰</span>
                <span className="dine-choice-title">Take out</span>
                <span className="dine-choice-sub">Pay first · we pack it for you</span>
                {busy === 'takeout' && <span className="dine-choice-busy" />}
              </button>
            </div>
            {error && <p className="dine-error" role="alert">{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}
