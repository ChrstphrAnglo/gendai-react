import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext(null);

export const useCart = () => useContext(CartContext);

const load = () => {
  try {
    return JSON.parse(localStorage.getItem('cart')) || [];
  } catch {
    return [];
  }
};

// cart = [{ menuItem: {_id, name, price, image, ...}, quantity }]
export function CartProvider({ children }) {
  const [cart, setCart] = useState(load);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Logging out empties the cart so the next account on this browser doesn't inherit it.
  useEffect(() => {
    const onLogout = () => setCart([]);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const quantityOf = (id) => cart.find((l) => l.menuItem._id === id)?.quantity || 0;

  // Adds `delta` (may be negative) of an item; lines that hit 0 are removed.
  const changeQuantity = (menuItem, delta) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItem._id === menuItem._id);
      if (!existing) return delta > 0 ? [...prev, { menuItem, quantity: delta }] : prev;
      return prev
        .map((l) => (l.menuItem._id === menuItem._id ? { ...l, quantity: Math.min(50, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0);
    });
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((n, l) => n + l.quantity, 0);
  const totalAmount = cart.reduce((n, l) => n + l.menuItem.price * l.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, quantityOf, changeQuantity, clearCart, totalItems, totalAmount }}>
      {children}
    </CartContext.Provider>
  );
}
