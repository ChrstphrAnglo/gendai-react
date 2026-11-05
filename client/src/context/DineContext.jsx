import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../api/client';

// Guest state for the table QR app: no login, just the table session this device joined.
// Kept apart from the delivery app's auth and cart so the two never mix.
const DineContext = createContext(null);
export const useDine = () => useContext(DineContext);

const SESSION_KEY = 'gendai:dine';
const CART_KEY = 'gendai:dine-cart';

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: state still works for this visit */
  }
};

export const guestApi = axios.create({ baseURL: `${API_URL}/dine` });

// Still worth showing (and polling): an unpaid bill, or a paid take-out the kitchen hasn't handed over yet.
export const isActive = (s) => Boolean(s) && (
  s.status === 'open'
  || s.status === 'payment_pending'
  || (s.kind === 'takeout' && s.status === 'paid' && s.orders.some((o) => !['completed', 'cancelled'].includes(o.status)))
);

export function DineProvider({ children }) {
  // { guestToken, tableToken, kind }
  const [saved, setSaved] = useState(() => read(SESSION_KEY, null));
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(saved));
  const [cart, setCart] = useState(() => read(CART_KEY, []));
  const [payment, setPayment] = useState(null);
  const savedRef = useRef(saved);
  useEffect(() => { savedRef.current = saved; }, [saved]);

  useEffect(() => { write(CART_KEY, cart); }, [cart]);

  const headers = useCallback(() => ({ 'X-Guest-Token': savedRef.current?.guestToken }), []);

  const forget = useCallback(() => {
    write(SESSION_KEY, null);
    savedRef.current = null;
    setSaved(null);
    setSession(null);
    setCart([]);
  }, []);

  const refresh = useCallback(async () => {
    if (!savedRef.current?.guestToken) {
      setLoading(false);
      return null;
    }
    try {
      const { data } = await guestApi.get('/session', { headers: headers() });
      setSession(data);
      return data;
    } catch (err) {
      if (err.response?.status === 401) forget();
      throw err;
    } finally {
      setLoading(false);
    }
  }, [headers, forget]);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  // Keep order statuses and payment confirmation fresh while a bill is live.
  const live = isActive(session);
  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => refresh().catch(() => {}), 6000);
    return () => clearInterval(timer);
  }, [live, refresh]);

  // Payment details (QR images, account numbers) for the pay screen.
  const loadPayment = useCallback(async () => {
    const { data } = await axios.get(`${API_URL}/settings`);
    setPayment(data.payment);
    return data.payment;
  }, []);

  const start = useCallback(async (tableToken, kind) => {
    const { data } = await guestApi.post('/sessions', { tableToken, kind });
    const next = { guestToken: data.guestToken, tableToken, kind };
    if (savedRef.current?.guestToken !== data.guestToken) setCart([]);
    write(SESSION_KEY, next);
    savedRef.current = next;
    setSaved(next);
    setSession(data.session);
    return data.session;
  }, []);

  const placeOrder = useCallback(async ({ notes, guestName }) => {
    const { data } = await guestApi.post('/session/orders', {
      items: cart.map((l) => ({ menuItem: l.menuItem._id, quantity: l.quantity })),
      notes,
      guestName,
    }, { headers: headers() });
    setSession(data);
    setCart([]);
    return data;
  }, [cart, headers]);

  const requestPayment = useCallback(async (method, reference) => {
    const { data } = await guestApi.post('/session/payment', { method, reference }, { headers: headers() });
    setSession(data);
    return data;
  }, [headers]);

  const cancelPayment = useCallback(async () => {
    const { data } = await guestApi.delete('/session/payment', { headers: headers() });
    setSession(data);
    return data;
  }, [headers]);

  // ---- cart ----
  const quantityOf = useCallback((id) => cart.find((l) => l.menuItem._id === id)?.quantity || 0, [cart]);
  const changeQuantity = useCallback((menuItem, delta) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItem._id === menuItem._id);
      if (!existing) return delta > 0 ? [...prev, { menuItem, quantity: delta }] : prev;
      return prev
        .map((l) => (l.menuItem._id === menuItem._id ? { ...l, quantity: Math.min(50, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0);
    });
  }, []);
  const totalItems = cart.reduce((n, l) => n + l.quantity, 0);
  const totalAmount = cart.reduce((n, l) => n + l.menuItem.price * l.quantity, 0);

  const value = useMemo(() => ({
    saved, session, loading, payment,
    start, refresh, forget, placeOrder, requestPayment, cancelPayment, loadPayment,
    cart, quantityOf, changeQuantity, totalItems, totalAmount,
  }), [saved, session, loading, payment, start, refresh, forget, placeOrder, requestPayment, cancelPayment, loadPayment,
    cart, quantityOf, changeQuantity, totalItems, totalAmount]);

  return <DineContext.Provider value={value}>{children}</DineContext.Provider>;
}
