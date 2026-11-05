import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import StatCard from '../../components/common/StatCard';
import { peso } from '../../utils/format';

const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short' });

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  // Initial load, then refresh every 30s so the numbers stay current on a kitchen screen.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await api.get('/reports/dashboard');
        if (!cancelled) { setStats(data); setError(''); }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load dashboard.'));
      }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  if (error && !stats) return <div className="alert alert-error">{error}</div>;
  if (!stats) return <div className="loading-container"><div className="loading-spinner" /></div>;

  const { today, statusCounts, revenueSeries, topItems, menu } = stats;
  const maxRevenue = Math.max(...revenueSeries.map((d) => d.revenue), 1);
  const weekTotal = revenueSeries.reduce((s, d) => s + d.revenue, 0);

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <span className="muted">Auto-refreshes every 30 seconds</span>
      </div>

      <div className="stats-grid">
        <StatCard label="Today's revenue" value={peso(today.revenue)} tone="ok" />
        <StatCard label="Today's orders" value={today.orders} />
        <StatCard label="Preparing" value={statusCounts.preparing || 0} tone="warn" hint="needs attention" />
        <StatCard label="Out for delivery" value={statusCounts.out_for_delivery || 0} tone="info" />
        <StatCard label="Delivered" hint="all time" value={statusCounts.delivered || 0} />
        <StatCard label="Menu items" value={menu.total} hint={menu.unavailable ? `${menu.unavailable} unavailable` : 'all available'} />
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="card-head">
            <h2>Revenue, last 7 days</h2>
            <strong>{peso(weekTotal)}</strong>
          </div>
          <div className="bar-chart" role="img" aria-label="Bar chart of revenue for the last 7 days">
            {revenueSeries.map((d) => (
              <div key={d.date} className="bar-col" title={`${d.date}: ${peso(d.revenue)} (${d.orders} orders)`}>
                <span className="bar-value">{d.revenue ? Math.round(d.revenue) : ''}</span>
                <div className="bar" style={{ height: `${(d.revenue / maxRevenue) * 100}%` }} />
                <span className="bar-label">{dayLabel(d.date)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Top sellers</h2>
            <Link to="/admin/reports/best-sellers" className="link">Full report →</Link>
          </div>
          {topItems.length === 0 ? (
            <div className="empty-state">No sales yet.</div>
          ) : (
            <ol className="top-list">
              {topItems.map((t) => (
                <li key={t._id}>
                  <span>{t.name}</span>
                  <span className="muted">{t.quantity} sold · {peso(t.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
