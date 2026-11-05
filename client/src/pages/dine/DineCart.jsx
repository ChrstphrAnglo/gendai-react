import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage, imageUrl } from '../../api/client';
import { useDine } from '../../context/DineContext';
import { peso } from '../../utils/format';

// Review this round, then send it to the kitchen (dine in) or place it and go pay (take out).
export default function DineCart() {
  const navigate = useNavigate();
  const { session, cart, changeQuantity, totalItems, totalAmount, placeOrder } = useDine();
  const takeout = session.kind === 'takeout';
  const [notes, setNotes] = useState('');
  const [name, setName] = useState(session.guestName || '');
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (takeout && name.trim().length < 2) {
      setNameError('Enter a name so we can call you when it is ready');
      return;
    }
    setSending(true);
    try {
      await placeOrder({ notes: notes.trim(), guestName: name.trim() || undefined });
      navigate(takeout ? '/dine/pay' : '/dine/bill', { replace: true, state: { justSent: !takeout } });
    } catch (err) {
      setError(errorMessage(err, 'Could not send your order. Please try again.'));
      setSending(false);
    }
  };

  if (cart.length === 0) {
    return (
      <section className="dine-panel dine-empty fx-enter">
        <span className="fx-jp">空</span>
        <p>Nothing in this round yet.</p>
        <Link to="/dine" className="dine-btn dine-btn-primary">Browse the menu</Link>
      </section>
    );
  }

  return (
    <form className="dine-review" onSubmit={submit} noValidate>
      <section className="dine-panel fx-enter">
        <div className="dine-panel-head">
          <h1>{takeout ? 'Your take-out order' : 'Review this round'}</h1>
          <span className="dine-panel-meta">{totalItems} {totalItems === 1 ? 'item' : 'items'}</span>
        </div>
        <ul className="dine-lines">
          {cart.map(({ menuItem, quantity }) => (
            <li key={menuItem._id}>
              <span className="dine-line-img"><img src={imageUrl(menuItem.image)} alt="" /></span>
              <span className="dine-line-name">
                <strong>{menuItem.name}</strong>
                <span>{peso(menuItem.price)}</span>
              </span>
              <span className="dine-qty">
                <button type="button" onClick={() => changeQuantity(menuItem, -1)} aria-label={`Remove one ${menuItem.name}`}>−</button>
                <span key={quantity}>{quantity}</span>
                <button type="button" onClick={() => changeQuantity(menuItem, 1)} aria-label={`Add one ${menuItem.name}`}>+</button>
              </span>
              <span className="dine-line-total">{peso(menuItem.price * quantity)}</span>
            </li>
          ))}
        </ul>
        <Link to="/dine" className="dine-add-more">+ Add more dishes</Link>
      </section>

      <section className="dine-panel fx-enter" style={{ '--d': 1 }}>
        {takeout && (
          <label className="dine-field">
            <span>Name for pickup</span>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              placeholder="We will call this name"
              maxLength={60}
              autoComplete="given-name"
              className={nameError ? 'has-error' : ''}
            />
            {nameError && <span className="field-error" role="alert">{nameError}</span>}
          </label>
        )}
        <label className="dine-field">
          <span>Notes for the kitchen <em>(optional)</em></span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} rows={2} placeholder="No spring onions, less spicy, allergies…" />
        </label>
      </section>

      <div className="dine-sticky-cta">
        {error && <p className="dine-error" role="alert">{error}</p>}
        <button type="submit" className="dine-btn dine-btn-primary dine-btn-block fx-shine" disabled={sending}>
          {sending ? 'Sending…' : takeout ? `Place order & pay · ${peso(totalAmount)}` : `Send to kitchen · ${peso(totalAmount)}`}
        </button>
        <p className="dine-hint">{takeout ? 'The kitchen starts cooking once your payment is confirmed.' : 'You pay once at the end, for everything your table ordered.'}</p>
      </div>
    </form>
  );
}
