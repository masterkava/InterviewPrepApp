import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserType } from '../types/auth';

const USER_TYPES: { value: UserType; label: string; desc: string }[] = [
  { value: 'student', label: 'Student', desc: 'Currently in college or studying' },
  { value: 'fresher', label: 'Fresher', desc: 'Graduated, less than 1 year experience' },
  { value: 'experienced', label: 'Experienced', desc: '1+ years of professional experience' },
];

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const { updateProfile, user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [userType, setUserType] = useState<UserType | null>(user?.user_type ?? null);
  const [targetRole, setTargetRole] = useState(user?.target_role ?? '');
  const [yearsExp, setYearsExp] = useState(
    user?.years_of_experience != null ? String(user.years_of_experience) : '',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid =
    displayName.trim().length > 0 &&
    userType !== null &&
    targetRole.trim().length > 0 &&
    (userType !== 'experienced' || (yearsExp.length > 0 && Number(yearsExp) >= 1));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid || !userType) return;
    setLoading(true);
    setError('');
    try {
      await updateProfile({
        display_name: displayName.trim(),
        user_type: userType,
        target_role: targetRole.trim(),
        years_of_experience: userType === 'experienced' ? Number(yearsExp) : undefined,
      });
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Complete Your Profile</h1>
        <p style={styles.subtitle}>Help us personalize your experience</p>

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Your Name</label>
          <input
            style={styles.input}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            disabled={loading}
            autoFocus
          />

          <label style={styles.label}>I am a...</label>
          <div style={styles.chipContainer}>
            {USER_TYPES.map((ut) => (
              <button
                key={ut.value}
                type="button"
                style={{
                  ...styles.chip,
                  ...(userType === ut.value ? styles.chipActive : {}),
                }}
                onClick={() => setUserType(ut.value)}
                disabled={loading}
              >
                <div style={{
                  ...styles.chipLabel,
                  ...(userType === ut.value ? styles.chipLabelActive : {}),
                }}>{ut.label}</div>
                <div style={{
                  ...styles.chipDesc,
                  ...(userType === ut.value ? styles.chipDescActive : {}),
                }}>{ut.desc}</div>
              </button>
            ))}
          </div>

          <label style={styles.label}>Target Role</label>
          <input
            style={styles.input}
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g., Backend Developer, Full Stack"
            disabled={loading}
          />

          {userType === 'experienced' && (
            <>
              <label style={styles.label}>Years of Experience</label>
              <input
                style={styles.input}
                value={yearsExp}
                onChange={(e) => setYearsExp(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g., 3"
                inputMode="numeric"
                disabled={loading}
              />
            </>
          )}

          {error && <p style={styles.error}>{error}</p>}

          <button
            style={{ ...styles.button, ...((!isValid || loading) ? styles.buttonDisabled : {}) }}
            type="submit"
            disabled={!isValid || loading}
          >
            {loading ? 'Saving...' : 'Get Started'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    padding: '48px 24px',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '520px',
    width: '100%',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 4px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#6B7280',
    margin: '0 0 32px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '8px',
    marginTop: '20px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  chipContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  chip: {
    textAlign: 'left' as const,
    padding: '16px',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    background: '#fff',
    cursor: 'pointer',
    width: '100%',
  },
  chipActive: {
    borderColor: '#4F46E5',
    background: '#EEF2FF',
  },
  chipLabel: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '2px',
  },
  chipLabelActive: {
    color: '#4F46E5',
  },
  chipDesc: {
    fontSize: '12px',
    color: '#6B7280',
  },
  chipDescActive: {
    color: '#4338CA',
  },
  error: {
    color: '#EF4444',
    fontSize: '14px',
    margin: '12px 0 0',
  },
  button: {
    width: '100%',
    padding: '16px',
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    background: '#4F46E5',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginTop: '24px',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
