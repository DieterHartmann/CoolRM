import { ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.js';
import LoginPage from './pages/LoginPage.js';
import SignUpPage from './pages/SignUpPage.js';
import DashboardPage from './pages/DashboardPage.js';
import AdminPage from './pages/AdminPage.js';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, color: '#64748b', fontFamily: 'system-ui' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, color: '#64748b', fontFamily: 'system-ui' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'superadmin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>}
        />
        <Route
          path="/signup"
          element={<RedirectIfAuthed><SignUpPage /></RedirectIfAuthed>}
        />
        <Route
          path="/admin"
          element={<RequireSuperAdmin><AdminPage /></RequireSuperAdmin>}
        />
        <Route
          path="/*"
          element={<RequireAuth><DashboardPage /></RequireAuth>}
        />
      </Routes>
    </AuthProvider>
  );
}
