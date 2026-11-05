import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errorMessage, imageUrl } from '../../api/client';
import { useCart } from '../../context/CartContext';
import { homeFor, useAuth } from '../../context/AuthContext';
import useBodyClass from '../../hooks/useBodyClass';
import { peso } from '../../utils/format';
import '../../styles/menu.css';

export default function Menu() {
  useBodyClass('menu-page');
  const navigate = useNavigate();
  const { quantityOf, changeQuantity, totalItems, totalAmount } = useCart();
  const { user, isCustomer, logout } = useAuth();
  const categoryBar = useRef(null);

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [menuRes, catRes] = await Promise.all([api.get('/menu'), api.get('/categories')]);
        if (cancelled) return;
        setItems(menuRes.data);
        setCategories(catRes.data);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load the menu.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Only show categories that actually contain something orderable.
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

  const scrollCategories = (offset) => {
    categoryBar.current?.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <div className="menu-page-container">
      <header className="header">
        <div className="header-container">
          <Link to="/" aria-label="Gendai home"><img src="/new logo 1.png" alt="Gendai Logo" className="logo" /></Link>
          <nav className="account-nav">
            {!user && (
              <>
                <Link to="/login" className="account-link">Log in</Link>
                <Link to="/signup" className="account-link account-link-strong">Sign up</Link>
              </>
            )}
            {isCustomer && (
              <>
                <Link to="/orders" className="account-link">My orders</Link>
                <button type="button" className="account-link account-link-btn" onClick={onLogout}>Log out</button>
              </>
            )}
            {user && !isCustomer && <Link to={homeFor(user)} className="account-link account-link-strong">Admin</Link>}
          </nav>
        </div>
      </header>

      <section className="menu-hero">
        <img src="/gendai_display.png" alt="" className="menu-hero-img" />
        <div className="menu-hero-shade" />
        <div className="menu-hero-copy">
          <p className="fx-label fx-enter" style={{ '--d': 1 }}>Today&apos;s menu</p>
          <h1 className="fx-enter" style={{ '--d': 2 }}>
            <span className="fx-jp menu-hero-jp">お品書き</span>
            The Menu
          </h1>
        </div>
        <span className="menu-hero-sun fx-sun" aria-hidden="true" />
      </section>

      <div className="menu-controls">
        <div className="menu-search fx-enter" style={{ '--d': 3 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Search dishes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search dishes"
          />
        </div>

        <div className="header-wrapper fx-enter" style={{ '--d': 4 }}>
          <button type="button" className="arrow-btn" onClick={() => scrollCategories(-200)} aria-label="Scroll categories left">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>

          <div className="category-bar" ref={categoryBar}>
            {visibleCategories.map((name) => (
              <button
                type="button"
                key={name}
                className={`category ${selected === name ? 'active' : ''}`}
                onClick={() => setSelected(name)}
              >
                {name}
              </button>
            ))}
          </div>

          <button type="button" className="arrow-btn" onClick={() => scrollCategories(200)} aria-label="Scroll categories right">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>

      <div className="menu-container">
        <div className="menu-meta">
          <span className="fx-label">{selected === 'All' ? 'All dishes' : selected}</span>
          {!loading && !error && <span className="menu-count">{String(filtered.length).padStart(2, '0')} items</span>}
        </div>

        {loading && (
          <div className="menu-grid">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="dish-card dish-skeleton" />)}
          </div>
        )}
        {error && <div className="no-items-message">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="no-items-message">
            <span className="fx-jp">空</span>
            {search ? `No dishes match “${search}”.` : `No items found in “${selected}” category.`}
          </div>
        )}

        <div className="menu-grid" key={selected}>
          {filtered.map((item, i) => {
            const qty = quantityOf(item._id);
            return (
              <article
                key={item._id}
                className={`dish-card fx-enter ${item.available ? '' : 'item-soldout'} ${qty > 0 ? 'in-cart' : ''}`}
                style={{ '--d': Math.min(i, 12) }}
              >
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
                      <button type="button" className="qty-btn qty-add" onClick={() => changeQuantity(item, 1)} disabled={!item.available} aria-label={`Add one ${item.name}`}>+</button>
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
              <span className="fx-label">Your order</span>
              <strong>{peso(totalAmount)}</strong>
            </span>
          </div>
          <button
            type="button"
            className="checkout-button fx-shine"
            onClick={() => navigate('/cart')}
            disabled={totalItems === 0}
          >
            {totalItems === 0 ? 'Add items to order' : `Check Order (${totalItems})`}
            {totalItems > 0 && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
