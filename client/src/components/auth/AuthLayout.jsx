import { Link } from 'react-router-dom';
import useBodyClass from '../../hooks/useBodyClass';
import '../../styles/auth.css';

// Split-screen shell shared by login, sign up and forgot password.
// Brand panel on the left (a header strip on phones), form on the right.
export default function AuthLayout({ title, subtitle, children, footer }) {
  useBodyClass('auth-page');

  return (
    <div className="auth-split">
      <aside className="auth-brand">
        <span className="auth-grid" aria-hidden="true" />
        <span className="auth-orbit" aria-hidden="true"><span /></span>
        <span className="auth-sun fx-sun" aria-hidden="true" />
        <span className="auth-kanji fx-jp" aria-hidden="true">現代</span>

        <Link to="/" className="auth-brand-top" aria-label="Gendai home">
          <img src="/new logo 1.png" alt="Gendai" className="auth-brand-logo" />
        </Link>

        <div className="auth-brand-copy">
          <p className="fx-label">Japanese kitchen · Delivery</p>
          <h1 className="auth-brand-name">Gendai</h1>
          <p className="auth-brand-tagline">Fresh Japanese favorites, delivered to your door.</p>
          <span className="auth-brand-rule" aria-hidden="true" />
        </div>
      </aside>

      <main className="auth-panel fx-grid">
        <div className="auth-panel-inner">
          <h2 className="auth-heading">{title}</h2>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          <hr className="auth-divider" />
          {children}
          <div className="auth-footer">
            {footer}
            <p><Link to="/" className="auth-back">← Back to Landing Page</Link></p>
          </div>
        </div>
      </main>
    </div>
  );
}
