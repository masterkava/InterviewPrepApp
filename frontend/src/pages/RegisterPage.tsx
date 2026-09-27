import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordsMatch = password === confirmPassword;
  const isValid = displayName.trim().length > 0 && emailValid && password.length >= 6 && passwordsMatch;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      const tokens = await registerUser({
        email: email.trim().toLowerCase(),
        password,
        display_name: displayName.trim(),
      });
      login(tokens);
      navigate(tokens.is_profile_complete ? '/' : '/profile-setup');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>InterviewPrep</h1>
        <p style={styles.subtitle}>Practice makes perfect</p>

        <h2 style={styles.title}>Create an account</h2>
        <p style={styles.desc}>Get started with your mock interviews</p>

        <form onSubmit={handleSubmit}>
          <input
            style={styles.input}
            type="text"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <input
            style={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />

          {confirmPassword && !passwordsMatch && (
            <p style={styles.error}>Passwords don't match</p>
          )}
          {error && <p style={styles.error}>{error}</p>}

          <button
            style={{ ...styles.button, ...((!isValid || loading) ? styles.buttonDisabled : {}) }}
            type="submit"
            disabled={!isValid || loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={styles.linkRow}>
          Already have an account?{' '}
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
