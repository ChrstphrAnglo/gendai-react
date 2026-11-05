import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDine } from '../../context/DineContext';
import useBodyClass from '../../hooks/useBodyClass';
import { peso } from '../../utils/format';
import '../../styles/menu.css';
import '../../styles/dine.css';

// Shell for the guest app: table chip, Menu / Bill tabs. Deliberately no login or account links.
export default function DineLayout() {
  useBodyClass('dine-page');
  useBodyClass('menu-page'); // reuse the delivery menu's dish cards and controls
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { saved, session, loading } = useDine();

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner" /><p>Loading your table…</p></div>;
  }
  if (!session) {
    return (
      <main className="dine-start">
        <span className="dine-start-sun fx-sun" aria-hidden="true" />
        <div className="dine-start-inner">
          <img src="/new logo 1.png" alt="Gendai" className="dine-start-logo" />
          <h1>Scan the QR code on your table</h1>
          <p className="dine-start-ask">Your session has ended or this device has not joined a table yet.</p>
          {saved?.tableToken && (
            <button type="button" className="dine-btn dine-btn-primary" onClick={() => navigate(`/t/${saved.tableToken}`)}>Back to start</button>
          )}
        </div>
      </main>
    );
  }

  const takeout = session.kind === 'takeout';
  const ordered = session.orders.some((o) => o.status !== 'cancelled');
  const billCount = session.orders.filter((o) => o.status !== 'cancelled').length;

  return (
    <div className="dine-shell">
      <header className="dine-header">
        <button type="button" className="dine-logo-btn" onClick={() => navigate(`/t/${saved.tableToken}`)} aria-label="Back to start">
          <img src="/new logo 1.png" alt="Gendai" />
        </button>
        <div className="dine-header-meta">
          <span className={`dine-mode ${takeout ? 'takeout' : ''}`}>{takeout ? 'Take out' : 'Dine in'}</span>
          <span className="dine-table">Table {session.tableLabel}</span>
        </div>
      </header>

      <nav className="dine-tabs" aria-label="Sections">
        {!(takeout && ordered) && (
          <NavLink end to="/dine" className={({ isActive }) => `dine-tab ${isActive ? 'active' : ''}`}>
            <span className="fx-jp">品</span> Menu
          </NavLink>
        )}
        <NavLink to="/dine/bill" className={({ isActive }) => `dine-tab ${isActive ? 'active' : ''}`}>
          <span className="fx-jp">会計</span> {takeout ? 'My order' : 'Bill'}
          {billCount > 0 && <span className="dine-tab-badge">{peso(session.totalAmount)}</span>}
        </NavLink>
      </nav>

      <main className="dine-main route-fx" key={pathname}>
        <Outlet />
      </main>
    </div>
  );
}
