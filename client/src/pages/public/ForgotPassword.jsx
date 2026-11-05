import { Link } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';

// Placeholder: sending reset emails needs an email service, which isn't set up yet.
export default function ForgotPassword() {
  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Online password reset isn't available yet."
      footer={<p><Link to="/login" className="auth-link">← Back to log in</Link></p>}
    >
      <div className="auth-success" role="status" style={{ background: '#fef3c7', color: '#92400e', borderLeftColor: '#b45309' }}>
        Please ask a Gendai staff member or administrator to reset your password for you.
      </div>
      <p className="auth-note">Once your password is reset you can log in again with your email address.</p>
    </AuthLayout>
  );
}
