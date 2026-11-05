// Tiny in-memory fixed-window limiter, enough to slow down credential stuffing on a single node.
module.exports = ({ windowMs = 15 * 60 * 1000, max = 30 } = {}) => {
  const hits = new Map();
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const now = Date.now();
    const entry = hits.get(req.ip);
    if (!entry || entry.reset <= now) {
      hits.set(req.ip, { count: 1, reset: now + windowMs });
    } else if (++entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ message: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' });
    }
    if (hits.size > 5000) {
      for (const [key, value] of hits) if (value.reset <= now) hits.delete(key);
    }
    return next();
  };
};
