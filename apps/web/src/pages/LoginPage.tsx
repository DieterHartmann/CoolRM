import { CSSProperties, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '../lib/auth-client.js';
import { useAuth } from '../lib/auth.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      await refresh();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={outer}>
      <div style={card}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#1e293b' }}>CoolRM</h1>
        <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748b' }}>Sign in to your account</p>

        <form onSubmit={handleSubmit}>
          <label style={labelS}>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
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
              placeholder="••••••••"
              style={inputS}
            />
          </label>

          {error && (
            <p style={{ margin: '12px 0 0', fontSize: 13, color: '#ef4444' }}>{error}</p>
          )}

          <button type="submit" disabled={loading} style={btnS}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
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
  width: 360,
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
