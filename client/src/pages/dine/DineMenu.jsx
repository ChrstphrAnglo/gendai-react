import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api, { errorMessage, imageUrl } from '../../api/client';
import { useDine } from '../../context/DineContext';
import { peso } from '../../utils/format';

// The in-restaurant menu. Same dishes as the delivery menu, but adds go to the table's cart.
export default function DineMenu() {
  const navigate = useNavigate();
  const { session, quantityOf, changeQuantity, totalItems, totalAmount, cancelPayment } = useDine();
  const categoryBar = useRef(null);

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get('/menu'), api.get('/categories')])
      .then(([menuRes, catRes]) => {
        if (cancelled) return;
        setItems(menuRes.data);
        setCategories(catRes.data);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, 'Could not load the menu.')))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const visibleCategories = useMemo(
    () => ['All', ...categories.filter((c) => items.some((i) => i.category?._id === c._id)).map((c) => c.name)],
    [categories, items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (selected !== 'All' && i.category?.name !== selected) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q);
    });
  }, [items, selected, search]);

  // A take-out order is a single order: once placed, the guest follows it on the order page.
  if (session.kind === 'takeout' && session.orders.some((o) => o.status !== 'cancelled')) {
    return <Navigate to="/dine/bill" replace />;
  }

  const pending = session.status === 'payment_pending';

  return (
    <>
      {pending && (
        <div className="dine-notice">
          <span>Your bill is being settled, so new orders are paused.</span>
          <button type="button" className="dine-link" onClick={() => cancelPayment().catch(() => {})}>Order more instead</button>
        </div>
      )}

      <div className="menu-controls dine-controls">
        <div className="menu-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input type="search" placeholder="Search dishes…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search dishes" />
        </div>
        <div className="header-wrapper">
          <div className="category-bar" ref={categoryBar}>
            {visibleCategories.map((name) => (
              <button type="button" key={name} className={`category ${selected === name ? 'active' : ''}`} onClick={() => setSelected(name)}>
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="menu-container">
        {loading && (
          <div className="menu-grid">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="dish-card dish-skeleton" />)}
          </div>
        )}
        {error && <div className="no-items-message">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="no-items-message"><span className="fx-jp">空</span>No dishes match.</div>
        )}

        <div className="menu-grid" key={selected}>
          {filtered.map((item, i) => {
            const qty = quantityOf(item._id);
            return (
              <article key={item._id} className={`dish-card fx-enter ${item.available ? '' : 'item-soldout'} ${qty > 0 ? 'in-cart' : ''}`} style={{ '--d': Math.min(i, 12) }}>
                <div className="dish-stage">
                  <span className="dish-sun" aria-hidden="true" />
                  <img src={imageUrl(item.image)} alt={item.name} loading="lazy" />
                  {item.category?.name && <span className="dish-tag">{item.category.name}</span>}
                  {!item.available && <span className="soldout-tag">Currently unavailable</span>}
                </div>
                <div className="dish-body">
                  <h3>{item.name}</h3>
                  <p className="dish-desc">{item.description}</p>
                  <div className="dish-foot">
                    <span className="dish-price">{peso(item.price)}</span>
                    <div className="quantity-control">
                      <button type="button" className="qty-btn" onClick={() => changeQuantity(item, -1)} disabled={qty === 0} aria-label={`Remove one ${item.name}`}>−</button>
                      <span className="quantity" key={qty}>{qty}</span>
                      <button type="button" className="qty-btn qty-add" onClick={() => changeQuantity(item, 1)} disabled={!item.available || pending} aria-label={`Add one ${item.name}`}>+</button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className={`checkout-footer ${totalItems > 0 ? 'has-items' : ''}`}>
        <div className="checkout-bar">
          <div className="checkout-summary">
            <span className="checkout-count" key={totalItems}>{totalItems}</span>
            <span className="checkout-text">
              <span className="fx-label">This round</span>
              <strong>{peso(totalAmount)}</strong>
            </span>
          </div>
          <button type="button" className="checkout-button fx-shine" onClick={() => navigate('/dine/cart')} disabled={totalItems === 0 || pending}>
            {totalItems === 0 ? 'Add dishes' : 'Review order'}
            {totalItems > 0 && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
          </button>
        </div>
      </div>
    </>
  );
}
