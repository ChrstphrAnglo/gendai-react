import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { errorMessage, fieldErrors, imageUrl } from '../../api/client';
import { useCart } from '../../context/CartContext';
import useForm from '../../hooks/useForm';
import useBodyClass from '../../hooks/useBodyClass';
import { peso } from '../../utils/format';
import '../../styles/cart.css';

const required = (message) => (v) => (v.trim() ? '' : message);

const validators = {
  customerName: (v) => {
    if (!v.trim()) return 'Please enter the recipient name';
    if (v.trim().length < 2) return 'Name is too short';
    return '';
  },
  contactPhone: (v) => {
    if (!v.trim()) return 'Enter a contact number for the rider';
    return /^[0-9+()\-\s]{7,20}$/.test(v.trim()) ? '' : 'Enter a valid phone number';
  },
  street: required('Enter your street address'),
  barangay: required('Enter your barangay'),
  city: required('Enter your city'),
  paymentMethod: (v) => (v ? '' : 'Choose a payment method'),
};

const PAYMENT_OPTIONS = [
  ['cash', 'Cash on Delivery', 'Pay the rider'],
  ['qrph', 'QR Ph', 'Any bank app'],
  ['gcash', 'GCash', 'E-wallet'],
  ['bank_transfer', 'Bank transfer', 'InstaPay'],
];

export default function Cart() {
  useBodyClass('cart-page');
  const navigate = useNavigate();
  const { cart, changeQuantity, clearCart, totalItems, totalAmount } = useCart();
  const { user, updateProfile } = useAuth();
  const saved = user?.address || {};
  const form = useForm({
    customerName: user?.fullName || '',
    contactPhone: user?.phone || '',
    street: saved.street || '',
    barangay: saved.barangay || '',
    city: saved.city || '',
    notes: saved.notes || '',
    paymentMethod: '',
    saveAddress: !saved.street,
  }, validators);
  const { values, errors } = form;
  const [deliveryFee, setDeliveryFee] = useState(null);

  const [addons, setAddons] = useState([]);
  const [pendingAddon, setPendingAddon] = useState(null);
  const [snackbar, setSnackbar] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [serverError, setServerError] = useState('');

  // "You might want to add" suggestions come from the Add-ons category.
  useEffect(() => {
    api.get('/menu', { params: { available: true } })
      .then(({ data }) => setAddons(data.filter((i) => i.category?.name === 'Add-ons')))
      .catch(() => setAddons([]));
  }, []);

  useEffect(() => {
    api.get('/settings').then(({ data }) => setDeliveryFee(data.deliveryFee)).catch(() => setDeliveryFee(null));
  }, []);

  const grandTotal = totalAmount + (deliveryFee || 0);

  const confirmAddon = () => {
    changeQuantity(pendingAddon, 1);
    setPendingAddon(null);
    setSnackbar(true);
    setTimeout(() => setSnackbar(false), 2500);
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    setServerError('');
    if (cart.length === 0) return setServerError('Your cart is empty.');
    if (!form.validateAll()) return;

    setPlacing(true);
    try {
      const address = {
        street: values.street.trim(),
        barangay: values.barangay.trim(),
        city: values.city.trim(),
        notes: values.notes.trim(),
      };
      const { data } = await api.post('/orders', {
        customerName: values.customerName.trim(),
        contactPhone: values.contactPhone.trim(),
        deliveryAddress: address,
        paymentMethod: values.paymentMethod,
        items: cart.map((l) => ({ menuItem: l.menuItem._id, quantity: l.quantity })),
      });
      if (values.saveAddress) {
        try {
          await updateProfile({ phone: values.contactPhone.trim(), address });
        } catch {
          /* the order is placed already; a failed profile save should not block it */
        }
      }
      clearCart();
      // Cash is paid to the rider; QR Ph, GCash and bank transfer show our account details next.
      navigate(values.paymentMethod === 'cash' ? `/order-success/${data._id}` : `/pay/${data._id}`, { replace: true });
    } catch (err) {
      const errs = fieldErrors(err);
      form.setErrors({
        customerName: errs.customerName,
        contactPhone: errs.contactPhone,
        street: errs['deliveryAddress.street'],
        barangay: errs['deliveryAddress.barangay'],
        city: errs['deliveryAddress.city'],
        paymentMethod: errs.paymentMethod,
      });
      setServerError(errorMessage(err, 'Could not place the order.'));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="pc-container">
      <header className="cart-topbar">
        <button type="button" className="previous-button" onClick={() => navigate('/menu')} aria-label="Back to menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        </button>
        <div className="cart-topbar-title">
          <span className="fx-label">Checkout</span>
          <h1 className="title">Cart <span className="fx-jp">ご注文</span></h1>
        </div>
        <Link to="/" className="cart-topbar-logo" aria-label="Gendai home"><img src="/new logo 1.png" alt="Gendai" /></Link>
      </header>

      <div className="cart-layout">
        <div className="cart-main">
          <section className="cart-card cart-container fx-enter" style={{ '--d': 1 }}>
            <div className="cart-card-head">
              <h2 className="checkout-title"><span className="step-no">01</span> Your items</h2>
              <span className="cart-card-meta">{totalItems} {totalItems === 1 ? 'item' : 'items'}</span>
            </div>
            <div className="cart-item-container">
              {cart.length === 0 ? (
                <p className="cart-empty">
                  <span className="fx-jp">空</span>
                  Your cart is empty. <Link to="/menu">Browse the menu</Link>
                </p>
              ) : (
                cart.map(({ menuItem, quantity }) => (
                  <div key={menuItem._id} className="cart-item-row">
                    <div className="item-image-wrap"><img src={imageUrl(menuItem.image)} alt={menuItem.name} className="item-image" /></div>
                    <div className="item-details">
                      <h4>{menuItem.name}</h4>
                      <p>{peso(menuItem.price)}</p>
                    </div>
                    <div className="quantity-control">
                      <button type="button" className="decrease-btn" onClick={() => changeQuantity(menuItem, -1)} aria-label={`Remove one ${menuItem.name}`}>−</button>
                      <span className="item-quantity" key={quantity}>{quantity}</span>
                      <button type="button" className="increase-btn" onClick={() => changeQuantity(menuItem, 1)} aria-label={`Add one ${menuItem.name}`}>+</button>
                    </div>
                    <div className="item-price">{peso(menuItem.price * quantity)}</div>
                  </div>
                ))
              )}
            </div>
            <button type="button" className="add-more-button" onClick={() => navigate('/menu')}>
              <span>+</span> Add more items
            </button>
          </section>

          {addons.length > 0 && (
            <section className="cart-card add-ons-container fx-enter" style={{ '--d': 2 }}>
              <h2 className="add-ons-title">You might want to add</h2>
              <ul className="add-ons-list">
                {addons.map((addon) => (
                  <li key={addon._id} className="add-ons-item">
                    <div className="add-ons-image">
                      <img src={imageUrl(addon.image)} alt={addon.name} />
                      <button type="button" className="add-to-cart-button" onClick={() => setPendingAddon(addon)} aria-label={`Add ${addon.name}`}>+</button>
                    </div>
                    <div className="add-ons-name">{addon.name}</div>
                    <div className="add-ons-price">{peso(addon.price)}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <form id="checkout-form" onSubmit={placeOrder} noValidate>
            <section className="cart-card checkout-section fx-enter" style={{ '--d': 3 }}>
              <h2 className="checkout-title"><span className="step-no">02</span> Delivery Details</h2>
              <div className="checkout-grid">
                <div className="checkout-field">
                  <input
                    type="text"
                    name="customerName"
                    className={`checkout-input ${errors.customerName ? 'has-error' : ''}`}
                    placeholder="Recipient name"
                    maxLength={60}
                    value={values.customerName}
                    onChange={form.handleChange}
                    onBlur={form.handleBlur}
                    autoComplete="name"
                  />
                  {errors.customerName && <span className="field-error" role="alert">{errors.customerName}</span>}
                </div>
                <div className="checkout-field">
                  <input
                    type="tel"
                    name="contactPhone"
                    className={`checkout-input ${errors.contactPhone ? 'has-error' : ''}`}
                    placeholder="Contact number"
                    maxLength={20}
                    value={values.contactPhone}
                    onChange={form.handleChange}
                    onBlur={form.handleBlur}
                    autoComplete="tel"
                  />
                  {errors.contactPhone && <span className="field-error" role="alert">{errors.contactPhone}</span>}
                </div>
              </div>
            </section>

            <section className="cart-card checkout-section fx-enter" style={{ '--d': 4 }}>
              <h2 className="checkout-title"><span className="step-no">03</span> Delivery Address</h2>
              <div className="checkout-grid">
                {[
                  ['street', 'Street address, building, unit', 120, 'address-line1'],
                  ['barangay', 'Barangay', 80, 'address-level3'],
                  ['city', 'City', 80, 'address-level2'],
                ].map(([name, placeholder, max, auto]) => (
                  <div className={`checkout-field ${name === 'street' ? 'span-2' : ''}`} key={name}>
                    <input
                      type="text"
                      name={name}
                      className={`checkout-input ${errors[name] ? 'has-error' : ''}`}
                      placeholder={placeholder}
                      maxLength={max}
                      value={values[name]}
                      onChange={form.handleChange}
                      onBlur={form.handleBlur}
                      autoComplete={auto}
                    />
                    {errors[name] && <span className="field-error" role="alert">{errors[name]}</span>}
                  </div>
                ))}
                <div className="checkout-field span-2">
                  <input
                    type="text"
                    name="notes"
                    className="checkout-input"
                    placeholder="Delivery notes (landmark, gate color, etc.), optional"
                    maxLength={200}
                    value={values.notes}
                    onChange={form.handleChange}
                  />
                </div>
              </div>
              <label className="checkout-check">
                <input type="checkbox" name="saveAddress" checked={values.saveAddress} onChange={form.handleChange} />
                <span className="check-box" aria-hidden="true" />
                <span>Save as my default address</span>
              </label>
            </section>

            <section className="cart-card payment-container fx-enter" style={{ '--d': 5 }}>
              <h2 className="checkout-title"><span className="step-no">04</span> Payment Method</h2>
              <div className="payment-options-container">
                {PAYMENT_OPTIONS.map(([value, label, hint]) => (
                  <label key={value} className={`payment-option ${values.paymentMethod === value ? 'selected' : ''}`}>
                    <input type="radio" name="paymentMethod" value={value} checked={values.paymentMethod === value} onChange={form.handleChange} />
                    <span className="payment-dot" aria-hidden="true" />
                    <span className="payment-label">{label}</span>
                    <span className="payment-hint">{hint}</span>
                  </label>
                ))}
              </div>
              {errors.paymentMethod && <span className="field-error" role="alert">{errors.paymentMethod}</span>}
              <p className="checkout-hint">QR Ph, GCash and bank transfer go straight to Gendai&apos;s account; we confirm your payment before dispatch. Card payments are not available yet.</p>
            </section>
          </form>
        </div>

        <aside className="cart-summary fx-enter" style={{ '--d': 2 }}>
          <section className="footer-container">
            {serverError && <div className="checkout-error" role="alert">{serverError}</div>}
            <div className="total-item-container">
              <h2 className="total-title"><span className="fx-label">Summary</span></h2>
              <div className="single-total-item">
                <span>Items ({totalItems})</span>
                <span>{peso(totalAmount)}</span>
              </div>
              <div className="single-total-item">
                <span>Delivery fee</span>
                <span>{deliveryFee === null ? '-' : peso(deliveryFee)}</span>
              </div>
              <div className="single-total-item grand-total">
                <span>Total</span>
                <span key={grandTotal}>{peso(grandTotal)}</span>
              </div>
            </div>
            <div className="button-container">
              <button type="submit" form="checkout-form" className="checkout-button fx-shine" disabled={placing || cart.length === 0}>
                {placing ? 'Placing Order…' : `Place Order · ${peso(grandTotal)}`}
              </button>
            </div>
          </section>
        </aside>
      </div>

      {pendingAddon && (
        <div className="myModal" onMouseDown={(e) => e.target === e.currentTarget && setPendingAddon(null)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-label="Add item">
            <img src={imageUrl(pendingAddon.image)} alt="" />
            <p>Add {pendingAddon.name} to cart?</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setPendingAddon(null)}>No</button>
              <button type="button" className="primary" onClick={confirmAddon}>Yes</button>
            </div>
          </div>
        </div>
      )}

      <div id="snackbar" className={snackbar ? 'show' : ''} role="status">Item Added!</div>
    </div>
  );
}
