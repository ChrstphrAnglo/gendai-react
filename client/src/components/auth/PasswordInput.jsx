import { useState } from 'react';

// Props: id, name, value, onChange, onBlur, error, label, placeholder, autoComplete
export default function PasswordInput({ id, name, value, onChange, onBlur, error, placeholder, label, autoComplete }) {
  const [show, setShow] = useState(false);

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrapper">
        <input
          type={show ? 'text' : 'password'}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className={error ? 'error' : ''}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShow(!show)}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
            {show && <line x1="1" y1="1" x2="23" y2="23" />}
          </svg>
        </button>
      </div>
      {error && <span className="error-message">{error}</span>}
    </div>
  );
}
