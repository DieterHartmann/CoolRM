import { CSSProperties, useEffect, useState } from 'react';
import { api, TenantAdmin, AppletAdmin } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';

export default function AdminPage() {
  const { user, signOut } = useAuth();
  const [tenants, setTenants] = useState<TenantAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAdminTenants()
      .then(({ tenants: list }) => setTenants(list))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load tenants'))
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(tenantId: string, applet: AppletAdmin) {
    const next = !applet.isActive;
    setTenants(prev => prev.map(t => t.id !== tenantId ? t : {
      ...t,
      applets: t.applets.map(a => a.id !== applet.id ? a : { ...a, isActive: next }),
    }));
    try {
      await api.setAppletActive(applet.id, next);
    } catch {
      setTenants(prev => prev.map(t => t.id !== tenantId ? t : {
        ...t,
        applets: t.applets.map(a => a.id !== applet.id ? a : { ...a, isActive: applet.isActive }),
      }));
    }
  }

  const totalApplets = tenants.reduce((sum, t) => sum + t.applets.length, 0);
  const totalContacts = tenants.reduce((sum, t) => sum + t.applets.reduce((s, a) => s + a.contactCount, 0), 0);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <header style={{ background: '#1e293b', color: '#f1f5f9', padding: '0 24px', display: 'flex', alignItems: 'center', height: 56, gap: 16, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>CoolRM</span>
        <span style={{ fontSize: 11, background: '#7c3aed', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>SUPERADMIN</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#64748b' }}>{user?.email}</span>
        <a href="/" style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none' }}>← Dashboard</a>
        <button onClick={signOut} style={{ fontSize: 12, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
          Sign out
        </button>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'auto', background: '#f8fafc', padding: 24 }}>
        {loading && <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading…</div>}

        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
              <StatCard label="Tenants" value={tenants.length} />
              <StatCard label="Applets" value={totalApplets} />
              <StatCard label="Contacts" value={totalContacts} />
            </div>

            {tenants.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: 14 }}>No tenants yet.</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {tenants.map(tenant => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  onToggle={(applet) => toggleActive(tenant.id, applet)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 20px', minWidth: 120 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function TenantCard({ tenant, onToggle }: { tenant: TenantAdmin; onToggle: (applet: AppletAdmin) => void }) {
  const totalContacts = tenant.applets.reduce((sum, a) => sum + a.contactCount, 0);

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
      {/* Tenant header */}
      <div style={{ padding: '12px 16px', borderBottom: tenant.applets.length > 0 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{tenant.companyName}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{tenant.ownerEmail}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#64748b' }}>{totalContacts} contact{totalContacts !== 1 ? 's' : ''}</span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatDate(tenant.createdAt)}</span>
      </div>

      {/* Applets */}
      {tenant.applets.length === 0 && (
        <div style={{ padding: '10px 16px', fontSize: 12, color: '#94a3b8' }}>No applets yet.</div>
      )}
      {tenant.applets.map((applet, i) => (
        <div
          key={applet.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            borderBottom: i < tenant.applets.length - 1 ? '1px solid #f8fafc' : 'none',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: '#334155', flex: 1 }}>{applet.name}</span>
          <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
            {applet.widgetKey.slice(0, 12)}…
          </span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{applet.contactCount} contacts</span>
          <ActiveBadge isActive={applet.isActive} onClick={() => onToggle(applet)} />
        </div>
      ))}
    </div>
  );
}

function ActiveBadge({ isActive, onClick }: { isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={isActive ? 'Click to suspend' : 'Click to activate'}
      style={{
        padding: '3px 10px',
        borderRadius: 999,
        border: 'none',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        userSelect: 'none',
        background: isActive ? '#f0fdf4' : '#fef2f2',
        color: isActive ? '#166534' : '#dc2626',
      }}
    >
      {isActive ? '● Active' : '○ Suspended'}
    </button>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}
