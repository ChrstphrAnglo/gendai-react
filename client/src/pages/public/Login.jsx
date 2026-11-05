import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { homeFor, useAuth } from '../../context/AuthContext';
import useForm from '../../hooks/useForm';
import AuthLayout from '../../components/auth/AuthLayout';
import PasswordInput from '../../components/auth/PasswordInput';

const validators = {
  email: (v) => {
    if (!v.trim()) return 'Email is required';
    return /^\S+@\S+\.\S+$/.test(v.trim()) ? '' : 'Enter a valid email';
  },
  password: (v) => (!v ? 'Password is required' : ''),
};

export default function Login() {
  const { user, login, error, setError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm({ email: '', password: '' }, validators);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setError(''); }, [setError]);

  if (user) return <Navigate to={location.state?.from || homeFor(user)} replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.validateAll() || submitting) return;
    setSubmitting(true);
    try {
      const signedIn = await login({ email: form.values.email.trim(), password: form.values.password });
      navigate(location.state?.from || homeFor(signedIn), { replace: true });
    } catch {
      /* the message is shown from AuthContext's `error` */
    } finally {
      setSubmitting(false);
    }
  };

  const onChange = (e) => {
    form.handleChange(e);
    setError('');
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to order your Gendai favorites, track your delivery, and see your past orders."
      footer={(
        <p>
          Don&apos;t have an account? <Link to="/signup" state={location.state} className="auth-link">Create account</Link>
        </p>
      )}
    >
      {error && <div className="auth-error" role="alert">{error}</div>}

      <form onSubmit={onSubmit} className="auth-form" noValidate>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="you@example.com"
            value={form.values.email}
            onChange={onChange}
            onBlur={form.handleBlur}
            className={form.errors.email ? 'error' : ''}
            autoComplete="email"
          />
          {form.errors.email && <span className="error-message">{form.errors.email}</span>}
        </div>

        <PasswordInput
          id="password"
          name="password"
          value={form.values.password}
          onChange={onChange}
          onBlur={form.handleBlur}
          error={form.errors.password}
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
        />

        <Link to="/forgot-password" className="auth-forgot">Forgot password?</Link>

        <button type="submit" className="auth-button" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="auth-note" style={{ marginTop: 18, textAlign: 'center' }}>
        Five failed attempts lock the account for 15 minutes. Staff log in here with their work email.
      </p>
    </AuthLayout>
  );
}
