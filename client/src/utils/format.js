export const peso = (n) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDateTime = (d) =>
  new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

// yyyy-mm-dd in local time, for <input type="date">
export const toDateInput = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const daysAgo = (n) => toDateInput(new Date(Date.now() - n * 86400000));

export const titleCase = (s = '') => s.replace(/(^|[-_\s])(\w)/g, (m, sep, c) => (sep === '-' || sep === '_' ? ' ' : sep) + c.toUpperCase());

// "out_for_delivery" -> "Out for delivery"
export const statusLabel = (s = '') => {
  const text = s.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const PAYMENT_LABEL = {
  cash: 'Cash',
  qrph: 'QR Ph',
  gcash: 'GCash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
};
export const paymentLabel = (m) => PAYMENT_LABEL[m] || (m ? titleCase(m) : 'Not chosen yet');

export const CHANNEL_LABEL = { delivery: 'Delivery', dine_in: 'Dine in', takeout: 'Take out' };

// Minutes since a date, for kitchen tickets and payment alerts.
export const minutesAgo = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));
export const ago = (d) => {
  const m = minutesAgo(d);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ${m % 60} min ago`;
};
