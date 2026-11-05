import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../../context/AuthContext';
import useBodyClass from '../../hooks/useBodyClass';
import '../../styles/landing.css';

const STEPS = [
  ['01', '登録', 'Create an account', 'Sign up with your email and phone number in under a minute.'],
  ['02', '選ぶ', 'Pick your favorites', 'Browse ramen, sushi, maki rolls, rice bowls and more.'],
  ['03', '配達', 'We deliver', 'Set your address, pay, and track your order to your door.'],
];

const MARQUEE = [
  ['ラーメン', 'Ramen'], ['寿司', 'Sushi'], ['巻き寿司', 'Maki'], ['丼', 'Donburi'],
  ['餃子', 'Gyoza'], ['天ぷら', 'Tempura'], ['刺身', 'Sashimi'],
];

const TRACK = ['Preparing', 'Out for delivery', 'Delivered'];

export default function Landing() {
  useBodyClass('landing-page');
  const { user, isCustomer, logout } = useAuth();
  const navigate = useNavigate();
  const heroRef = useRef(null);

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Spotlight + parallax follow the pointer through CSS variables (no re-renders).
  const onPointerMove = (e) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    el.style.setProperty('--px', (x - 0.5).toFixed(3));
    el.style.setProperty('--py', (y - 0.5).toFixed(3));
  };

  return (
    <div className="landing">
      <header className="landing-header">
        <Link to="/" aria-label="Gendai home"><img src="/new logo 1.png" alt="Gendai" className="landing-logo" /></Link>
        <nav className="landing-nav">
          <Link to="/menu" className="landing-link">Menu</Link>
          {user ? (
            <>
              <Link to={isCustomer ? '/orders' : homeFor(user)} className="landing-link">
                {isCustomer ? 'My orders' : 'Admin'}
              </Link>
              <button type="button" className="landing-link landing-link-btn" onClick={onLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="landing-link">Log in</Link>
              <Link to="/signup" className="landing-cta-small fx-shine">Sign up</Link>
            </>
          )}
        </nav>
      </header>

      <section className="landing-hero fx-grid" ref={heroRef} onPointerMove={onPointerMove}>
        <span className="hero-spotlight" aria-hidden="true" />
        <span className="hero-vertical fx-jp" aria-hidden="true">現代日本料理</span>

        <div className="landing-hero-text">
          <p className="fx-label fx-enter" style={{ '--d': 1 }}>Gendai Japanese Restaurant</p>
          <h1>
            <span className="line"><span style={{ '--d': 2 }}>Authentic Japanese,</span></span>
            <span className="line"><span style={{ '--d': 3 }}>delivered <em>hot</em></span></span>
            <span className="line"><span style={{ '--d': 4 }}>to your door.</span></span>
          </h1>
          <p className="landing-sub fx-enter" style={{ '--d': 6 }}>
            Order ramen, sushi, rolls and rice bowls straight from our kitchen and follow your order from preparing to delivered.
          </p>
          <div className="landing-actions fx-enter" style={{ '--d': 7 }}>
            <Link to="/menu" className="landing-cta fx-shine">
              Order now
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
            {!user && <Link to="/login" className="landing-secondary">Log in</Link>}
          </div>
          <dl className="hero-meta fx-enter" style={{ '--d': 8 }}>
            <div><dt>Menu</dt><dd>Ramen to maki</dd></div>
            <div><dt>Payment</dt><dd>Cash · GCash · Card</dd></div>
            <div><dt>Tracking</dt><dd>Live status</dd></div>
          </dl>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <span className="hero-orbit"><span className="hero-orbit-dot" /></span>
          <span className="hero-orbit hero-orbit-2" />
          <span className="hero-sun fx-sun" />
          <div className="hero-plate">
            <img src="/gendai_display.png" alt="" />
          </div>
          <span className="hero-kanji fx-jp">現代</span>

          <div className="hero-track">
            <span className="fx-label">Live tracking</span>
            <ol>
              {TRACK.map((t, i) => <li key={t} style={{ '--i': i }}>{t}</li>)}
            </ol>
          </div>
        </div>
      </section>

      <div className="landing-marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div className="marquee-group" key={dup}>
              {MARQUEE.map(([jp, en]) => (
                <span key={en} className="marquee-item">
                  <span className="fx-jp">{jp}</span>
                  <span className="marquee-en">{en}</span>
                  <span className="marquee-dot" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="landing-steps" aria-label="How it works">
        <div className="steps-head" data-reveal>
          <p className="fx-label">How it works</p>
          <h2>Three steps, one <span className="accent">warm</span> bowl.</h2>
        </div>
        <ol>
          {STEPS.map(([n, jp, title, text], i) => (
            <li key={n} data-reveal style={{ '--d': i + 1 }}>
              <span className="step-kanji fx-jp" aria-hidden="true">{jp}</span>
              <span className="landing-step-no">{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="step-corner" aria-hidden="true" />
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-band" data-reveal="scale">
        <span className="band-sun fx-sun" aria-hidden="true" />
        <div className="band-inner">
          <p className="band-jp fx-jp">召し上がれ</p>
          <h2>Hungry? Your next bowl is a few taps away.</h2>
          <Link to="/menu" className="landing-cta fx-shine">Browse the menu</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <span className="fx-jp">現代</span>
        <span>Gendai Japanese Restaurant · Delivery ordering</span>
      </footer>
    </div>
  );
}
