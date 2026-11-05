import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { homeFor, useAuth } from '../../context/AuthContext';
import { fieldErrors } from '../../api/client';
import useForm from '../../hooks/useForm';
import AuthLayout from '../../components/auth/AuthLayout';
import PasswordInput from '../../components/auth/PasswordInput';

const validators = {
  fullName: (v) => {
    if (!v.trim()) return 'Full name is required';
    return v.trim().length < 2 ? 'Name is too short' : '';
  },
  email: (v) => {
    if (!v.trim()) return 'Email is required';
    return /^\S+@\S+\.\S+$/.test(v.trim()) ? '' : 'Enter a valid email';
  },
  phone: (v) => {
    if (!v.trim()) return 'Phone number is required';
    return /^[0-9+()\-\s]{7,20}$/.test(v.trim()) ? '' : 'Enter a valid phone number';
  },
  password: (v) => {
    if (!v) return 'Password is required';
    if (v.length < 8) return 'Use at least 8 characters';
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Include a letter and a number';
    return '';
  },
  confirmPassword: (v, all) => (v !== all.password ? 'Passwords do not match' : ''),
};

export default function Signup() {
  const { user, register, error, setError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' }, validators);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setError(''); }, [setError]);

  if (user) return <Navigate to={location.state?.from || homeFor(user)} replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.validateAll() || submitting) return;
    setSubmitting(true);
    try {
      const { fullName, email, phone, password } = form.values;
      const created = await register({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), password });
      navigate(location.state?.from || homeFor(created), { replace: true });
    } catch (err) {
      form.setErrors(fieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onChange = (e) => {
    form.handleChange(e);
    setError('');
  };

  const field = (name, label, props = {}) => (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        value={form.values[name]}
        onChange={onChange}
        onBlur={form.handleBlur}
        className={form.errors[name] ? 'error' : ''}
        {...props}
      />
      {form.errors[name] && <span className="error-message">{form.errors[name]}</span>}
    </div>
  );

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Sign up to order Gendai for delivery and track every order."
      footer={<p>Already have an account? <Link to="/login" state={location.state} className="auth-link">Log in</Link></p>}
    >
      {error && <div className="auth-error" role="alert">{error}</div>}

      <form onSubmit={onSubmit} className="auth-form" noValidate>
        {field('fullName', 'Full name', { type: 'text', placeholder: 'Juan Dela Cruz', autoComplete: 'name', maxLength: 60 })}
        {field('email', 'Email', { type: 'email', placeholder: 'you@example.com', autoComplete: 'email' })}
        {field('phone', 'Phone number', { type: 'tel', placeholder: '0917 123 4567', autoComplete: 'tel', maxLength: 20 })}

        <PasswordInput
          id="password"
          name="password"
          value={form.values.password}
          onChange={onChange}
          onBlur={form.handleBlur}
          error={form.errors.password}
          label="Password"
          placeholder="At least 8 characters, with a number"
          autoComplete="new-password"
        />
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          value={form.values.confirmPassword}
          onChange={onChange}
          onBlur={form.handleBlur}
          error={form.errors.confirmPassword}
          label="Confirm password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
        />

        <button type="submit" className="auth-button" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
