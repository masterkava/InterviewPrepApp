import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { verifyOTP, requestOTP } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function OTPVerificationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const email = (location.state as any)?.email as string | undefined;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!email) return <Navigate to="/login" replace />;

  function handleCodeChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) handleVerify(digits);
  }

  async function handleVerify(otpCode: string) {
    setLoading(true);
    setError('');
    try {
      const tokens = await verifyOTP(email!, otpCode);
      login(tokens);
      navigate(tokens.is_profile_complete ? '/' : '/profile-setup', { replace: true });
    } catch (err: any) {
      setCode('');
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await requestOTP(email!);
      setCooldown(60);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Enter verification code</h2>
        <p style={styles.desc}>
          We sent a 6-digit code to<br />
          <strong>{email}</strong>
        </p>

        <input
          ref={inputRef}
          style={styles.codeInput}
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          maxLength={6}
          disabled={loading}
          placeholder="000000"
          inputMode="numeric"
        />

        {loading && <p style={styles.verifying}>Verifying...</p>}
        {error && <p style={styles.error}>{error}</p>}

        <button
          style={{ ...styles.resendBtn, ...(cooldown > 0 ? styles.resendDisabled : {}) }}
          onClick={handleResend}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
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
    textAlign: 'center' as const,
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 8px',
  },
  desc: {
    fontSize: '14px',
    color: '#6B7280',
    margin: '0 0 24px',
    lineHeight: '1.5',
  },
  codeInput: {
    width: '100%',
    padding: '16px',
    fontSize: '32px',
    fontWeight: '700',
    textAlign: 'center' as const,
    letterSpacing: '12px',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    outline: 'none',
    marginBottom: '16px',
    boxSizing: 'border-box' as const,
  },
  verifying: {
    color: '#4F46E5',
    fontSize: '14px',
    margin: '0 0 12px',
  },
  error: {
    color: '#EF4444',
    fontSize: '14px',
    margin: '0 0 12px',
  },
  resendBtn: {
    background: 'none',
    border: 'none',
    color: '#4F46E5',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    padding: '8px',
  },
  resendDisabled: {
    color: '#9CA3AF',
    cursor: 'not-allowed',
  },
};
