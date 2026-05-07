import { CSSProperties, FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { signUp } from '../lib/auth-client.js';

type Stage = 'form' | 'verify';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>('form');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp(email, password, name);
      setStage('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  if (stage === 'verify') {
    return (
      <div style={outer}>
        <div style={card}>
          <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Check your email</h1>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
            We sent a verification link to <strong>{email}</strong>.
            Click it to activate your account, then come back to sign in.
          </p>
          <p style={{ marginTop: 20, fontSize: 13 }}>
            <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none' }}>Back to sign in →</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={outer}>
      <div style={card}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#1e293b' }}>CoolRM</h1>
        <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748b' }}>Create your account</p>

        <form onSubmit={handleSubmit}>
          <label style={labelS}>
            Company / Your name
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              placeholder="Acme Corp"
              style={inputS}
            />
          </label>

          <label style={{ ...labelS, marginTop: 16 }}>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              style={inputS}
            />
          </label>

          <label style={{ ...labelS, marginTop: 16 }}>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              style={inputS}
            />
          </label>

          {error && (
            <p style={{ margin: '12px 0 0', fontSize: 13, color: '#ef4444' }}>{error}</p>
          )}

          <button type="submit" disabled={loading} style={btnS}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 13, textAlign: 'center', color: '#64748b' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const outer: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f8fafc',
};

const card: CSSProperties = {
  width: 380,
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 4px 24px rgba(0,0,0,.08)',
  padding: '40px 36px',
};

const labelS: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
};

const inputS: CSSProperties = {
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 14,
  outline: 'none',
};

const btnS: CSSProperties = {
  marginTop: 24,
  width: '100%',
  padding: 11,
  background: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};
