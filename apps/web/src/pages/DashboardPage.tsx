import { CSSProperties, FormEvent, useEffect, useState } from 'react';
import { api, Applet, Contact } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';

type Tab = 'contacts' | 'embed';

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const [applets, setApplets] = useState<Applet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tab, setTab] = useState<Tab>('contacts');
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const selected = applets.find(a => a.id === selectedId) ?? null;

  useEffect(() => {
    api.getApplets()
      .then(({ applets: list }) => {
        setApplets(list);
        if (list.length > 0) setSelectedId(list[0]!.id);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load applets'));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingContacts(true);
    setContacts([]);
    api.getContacts(selectedId)
      .then(({ contacts: list }) => setContacts(list))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load contacts'))
      .finally(() => setLoadingContacts(false));
  }, [selectedId]);

  function selectApplet(id: string) {
    setSelectedId(id);
    setTab('contacts');
    setError('');
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { applet } = await api.createApplet(newName.trim());
      setApplets(prev => [...prev, applet]);
      setSelectedId(applet.id);
      setTab('contacts');
      setNewName('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create applet');
    } finally {
      setCreating(false);
    }
  }

  function copyEmbed() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Sidebar ── */}
      <aside style={sidebar}>
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #334155' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>CoolRM</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
        </div>

        <div style={{ padding: '12px 12px 4px', fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Applets
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {applets.map(a => (
            <button
              key={a.id}
              onClick={() => selectApplet(a.id)}
              style={{
                ...navBtn,
                background: a.id === selectedId ? '#3b82f6' : 'transparent',
                color: a.id === selectedId ? '#fff' : '#cbd5e1',
              }}
            >
              {a.name}
            </button>
          ))}
        </nav>

        <div style={{ padding: '8px 8px 4px' }}>
          {showCreate ? (
            <form onSubmit={handleCreate} style={{ padding: '0 4px' }}>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Applet name"
                style={newNameInput}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button type="submit" disabled={creating} style={createBtn}>
                  {creating ? '…' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setNewName(''); }}
                  style={cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowCreate(true)} style={newAppletBtn}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Applet
            </button>
          )}
        </div>

        <button onClick={signOut} style={signOutBtn}>Sign out</button>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
        {!selected ? (
          <EmptyState hasApplets={applets.length > 0} />
        ) : (
          <>
            {/* Tab bar */}
            <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#1e293b', padding: '16px 0', marginRight: 20, flexShrink: 0 }}>
                {selected.name}
              </div>
              {(['contacts', 'embed'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '16px 12px 14px',
                    border: 'none',
                    background: 'transparent',
                    fontSize: 13,
                    fontWeight: tab === t ? 600 : 400,
                    color: tab === t ? '#3b82f6' : '#64748b',
                    borderBottom: `2px solid ${tab === t ? '#3b82f6' : 'transparent'}`,
                    cursor: 'pointer',
                  }}
                >
                  {t === 'embed' ? 'Embed Code' : 'Contacts'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              {error && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef2f2', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>
                  {error}
                </div>
              )}
              {tab === 'contacts' && (
                <ContactsPanel contacts={contacts} loading={loadingContacts} />
              )}
              {tab === 'embed' && (
                <EmbedPanel embedCode={selected.embedCode} copied={copied} onCopy={copyEmbed} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ hasApplets }: { hasApplets: boolean }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
      {hasApplets ? 'Select an applet from the sidebar.' : 'Create your first applet to get started.'}
    </div>
  );
}

function ContactsPanel({ contacts, loading }: { contacts: Contact[]; loading: boolean }) {
  if (loading) {
    return <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading contacts…</div>;
  }
  if (contacts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>
        No contacts yet. Embed the widget on your site to start collecting leads.
      </div>
    );
  }
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {['Ref', 'Name', 'Email', 'Phone', 'Status', 'Date'].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map((c, i) => (
            <tr key={c.id} style={{ borderBottom: i < contacts.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <td style={{ ...td, fontFamily: 'monospace', color: '#3b82f6', fontWeight: 600 }}>{c.refNumber}</td>
              <td style={td}>{c.name}</td>
              <td style={td}>{c.email}</td>
              <td style={{ ...td, color: '#64748b' }}>{c.phone ?? '—'}</td>
              <td style={td}><StatusBadge status={c.status} /></td>
              <td style={{ ...td, color: '#64748b', whiteSpace: 'nowrap' }}>{formatDate(c.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function statusStyle(status: Contact['status']): { bg: string; color: string; label: string } {
  if (status === 'new')  return { bg: '#eff6ff', color: '#1d4ed8', label: 'New' };
  if (status === 'open') return { bg: '#fefce8', color: '#a16207', label: 'Open' };
  return { bg: '#f0fdf4', color: '#166534', label: 'Resolved' };
}

function StatusBadge({ status }: { status: Contact['status'] }) {
  const s = statusStyle(status);
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
    }}>
      {s.label}
    </span>
  );
}

function EmbedPanel({ embedCode, copied, onCopy }: { embedCode: string; copied: boolean; onCopy: () => void }) {
  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Embed this widget</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
        Paste this snippet into your website's HTML, just before the closing <code>&lt;/body&gt;</code> tag.
      </p>
      <div style={{ position: 'relative' }}>
        <pre style={{
          background: '#1e293b',
          color: '#e2e8f0',
          borderRadius: 8,
          padding: '16px 20px',
          fontSize: 13,
          overflowX: 'auto',
          lineHeight: 1.6,
          margin: 0,
        }}>
          {embedCode}
        </pre>
        <button onClick={onCopy} style={{
          position: 'absolute',
          top: 10,
          right: 10,
          padding: '5px 12px',
          borderRadius: 6,
          border: 'none',
          background: copied ? '#22c55e' : '#3b82f6',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background .15s',
        }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p style={{ margin: '16px 0 0', fontSize: 12, color: '#94a3b8' }}>
        The widget loads as an iframe — no styles from your site will affect it.
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Styles ──────────────────────────────────────────────────────────────────

const sidebar: CSSProperties = {
  width: 240,
  background: '#1e293b',
  display: 'flex',
  flexDirection: 'column',
  borderRight: '1px solid #0f172a',
  flexShrink: 0,
};

const navBtn: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '9px 10px',
  borderRadius: 6,
  border: 'none',
  fontSize: 13,
  cursor: 'pointer',
  marginBottom: 2,
};

const newNameInput: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #475569',
  background: '#0f172a',
  color: '#f1f5f9',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

const createBtn: CSSProperties = {
  flex: 1,
  padding: 7,
  borderRadius: 6,
  border: 'none',
  background: '#3b82f6',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const cancelBtn: CSSProperties = {
  padding: '7px 10px',
  borderRadius: 6,
  border: 'none',
  background: '#334155',
  color: '#94a3b8',
  fontSize: 12,
  cursor: 'pointer',
};

const newAppletBtn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '9px 10px',
  borderRadius: 6,
  border: '1px dashed #475569',
  background: 'transparent',
  color: '#64748b',
  fontSize: 13,
  cursor: 'pointer',
};

const signOutBtn: CSSProperties = {
  margin: '4px 8px 12px',
  padding: '8px 10px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: '#475569',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
};

const th: CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const td: CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'middle',
};
