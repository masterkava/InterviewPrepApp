import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginUser } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const successMessage = (location.state as any)?.message || '';

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 6;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      const tokens = await loginUser({ email: email.trim().toLowerCase(), password });
      login(tokens);
      navigate(tokens.is_profile_complete ? '/' : '/profile-setup');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>InterviewPrep</h1>
        <p style={styles.subtitle}>Practice makes perfect</p>

        <h2 style={styles.title}>Sign in</h2>
        <p style={styles.desc}>Enter your email and password</p>

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
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          {successMessage && <p style={styles.success}>{successMessage}</p>}
          {error && <p style={styles.error}>{error}</p>}

          <p style={styles.forgotRow}>
            <Link to="/forgot-password" style={styles.link}>Forgot password?</Link>
          </p>

          <button
            style={{ ...styles.button, ...((!isValid || loading) ? styles.buttonDisabled : {}) }}
            type="submit"
            disabled={!isValid || loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={styles.linkRow}>
          Don't have an account?{' '}
          <Link to="/register" style={styles.link}>Register</Link>
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
    margin: '0 0 12px',
  },
  forgotRow: {
    textAlign: 'right' as const,
    fontSize: '14px',
    margin: '-8px 0 16px',
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
