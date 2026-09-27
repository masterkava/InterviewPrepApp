import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!emailValid) return;
    setLoading(true);
    setError('');
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: any) {
      if (err.status === 404) {
        setError('No account found with this email. Please register first.');
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>InterviewPrep</h1>
        <p style={styles.subtitle}>Practice makes perfect</p>

        <h2 style={styles.title}>Forgot password</h2>

        {sent ? (
          <>
            <p style={styles.success}>
              A password reset token has been sent!
              Check your backend console (dev mode) for the token.
            </p>
            <Link to="/reset-password" style={{ ...styles.button, display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '16px' }}>
              Enter Reset Token
            </Link>
          </>
        ) : (
          <>
            <p style={styles.desc}>Enter your email and we'll send you a reset token</p>
            <form onSubmit={handleSubmit}>
              <input
                style={styles.input}
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
              />

              {error && (
                <div style={{ marginBottom: '12px' }}>
                  <p style={styles.error}>{error}</p>
                  {error.includes('register') && (
                    <Link to="/register" style={{ ...styles.link, fontSize: '14px' }}>
                      Create an account
                    </Link>
                  )}
                </div>
              )}

              <button
                style={{ ...styles.button, ...((!emailValid || loading) ? styles.buttonDisabled : {}) }}
                type="submit"
                disabled={!emailValid || loading}
              >
                {loading ? 'Sending...' : 'Send Reset Token'}
              </button>
            </form>
          </>
        )}

        <p style={styles.linkRow}>
          Back to{' '}
          <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '70vh',
    padding: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '420px',
    width: '100%',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  logo: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#4F46E5',
    margin: '0 0 4px',
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: '16px',
    color: '#6B7280',
    margin: '0 0 32px',
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 4px',
  },
  desc: {
    fontSize: '14px',
    color: '#6B7280',
    margin: '0 0 24px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    outline: 'none',
    marginBottom: '16px',
    boxSizing: 'border-box' as const,
  },
  error: {
    color: '#EF4444',
    fontSize: '14px',
    margin: '0 0 12px',
  },
  success: {
    color: '#059669',
    fontSize: '14px',
    lineHeight: '1.5',
    margin: '0 0 8px',
  },
  button: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    background: '#4F46E5',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  linkRow: {
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#6B7280',
    marginTop: '20px',
  },
  link: {
    color: '#4F46E5',
    fontWeight: '600',
    textDecoration: 'none',
  },
};
