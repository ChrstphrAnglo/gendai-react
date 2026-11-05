import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { chime } from '../../utils/chime';
import { paymentLabel, peso } from '../../utils/format';
import '../../styles/admin.css';
import '../../styles/staff.css';
import '../../styles/print.css';

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', roles: ['admin', 'staff'] },
  { to: '/admin/orders', label: 'Orders', roles: ['admin', 'staff'] },
  { to: '/admin/kitchen', label: 'Kitchen', roles: ['admin', 'staff'], badge: 'kitchen' },
  { to: '/admin/front-desk', label: 'Front Desk', roles: ['admin', 'staff'], badge: 'desk' },
  { to: '/admin/tables', label: 'Tables & QR', roles: ['admin'] },
  { to: '/admin/menu', label: 'Menu Items', roles: ['admin'] },
  { to: '/admin/categories', label: 'Categories', roles: ['admin'] },
  { to: '/admin/users', label: 'Users', roles: ['admin'] },
  { to: '/admin/customers', label: 'Customers', roles: ['admin'] },
  { to: '/admin/settings', label: 'Settings', roles: ['admin'] },
  { to: '/admin/reports/sales', label: 'Sales Report', roles: ['admin'] },
  { to: '/admin/reports/best-sellers', label: 'Best Sellers', roles: ['admin'] },
  { to: '/admin/activity', label: 'Activity Log', roles: ['admin'] },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const [counts, setCounts] = useState({ kitchen: 0, desk: 0 });
  const seenRequests = useRef(null);

  // Watch for guests asking to pay on every staff page: badge, toast and chime for each new request.
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const { data } = await api.get('/service/summary');
        if (stop) return;
        setCounts({ kitchen: data.kitchen, desk: data.paymentRequests.length });
        const fresh = seenRequests.current ? data.paymentRequests.filter((r) => !seenRequests.current.has(r._id)) : [];
        seenRequests.current = new Set(data.paymentRequests.map((r) => r._id));
        if (fresh.length) {
          const r = fresh[0];
          const where = r.kind === 'takeout' ? `Take-out ${r.guestName || r.code}` : `Table ${r.tableLabel}`;
          toast(r.paymentMethod === 'cash'
            ? `${where} will pay CASH · ${peso(r.totalAmount)}`
            : `${where} paid by ${paymentLabel(r.paymentMethod)} · ${peso(r.totalAmount)}. Please verify`);
          chime('payment');
        }
      } catch {
        /* the next poll retries */
      }
    };
    poll();
    const timer = setInterval(poll, 8000);
    return () => { stop = true; clearInterval(timer); };
  }, [toast]);

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/new logo 1.png" alt="Gendai" />
          <span>Control</span>
        </div>
        <nav onClick={() => setOpen(false)}>
          {NAV.filter((n) => n.roles.includes(user.role)).map((n, i) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ '--d': i }}>
              <span className="nav-index">{String(i + 1).padStart(2, '0')}</span>
              {n.label}
              {n.badge && counts[n.badge] > 0 && (
                <span className={`nav-badge ${n.badge === 'desk' ? 'is-alert' : ''}`}>{counts[n.badge]}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-avatar" aria-hidden="true">{user.username?.charAt(0).toUpperCase()}</span>
            <strong>{user.username}</strong>
            <span className={`role-pill role-${user.role}`}>{user.role}</span>
          </div>
          <NavLink to="/menu" className="nav-link nav-link-external" target="_blank">View customer menu ↗</NavLink>
          <button type="button" className="btn btn-ghost btn-block sidebar-logout" onClick={onLogout}>Log out</button>
        </div>
        <span className="sidebar-kanji fx-jp" aria-hidden="true">現代</span>
      </aside>

      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}

      <div className="admin-main">
        <header className="admin-topbar">
          <button type="button" className="hamburger" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <span className="topbar-title">Gendai Ordering System</span>
          {counts.desk > 0 && (
            <NavLink to="/admin/front-desk" className="topbar-alert">{counts.desk} payment{counts.desk > 1 ? 's' : ''}</NavLink>
          )}
        </header>
        <main className="admin-content" key={pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
