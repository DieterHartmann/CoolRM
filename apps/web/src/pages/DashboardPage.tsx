import { CSSProperties, FormEvent, useEffect, useRef, useState } from 'react';
import { api, Applet, Contact, FieldDef, FieldType, DEFAULT_FIELDS, SmtpAccount, SmtpAccountInput, ThreadMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';

type Tab = 'contacts' | 'fields' | 'email' | 'embed';

const LOCKED_IDS = new Set(['name', 'email']);

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

  function handleFieldsSaved(appletId: string, fields: FieldDef[]) {
    setApplets(prev => prev.map(a => a.id === appletId ? { ...a, fieldConfig: fields } : a));
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

        {error && (
          <div style={{ margin: '0 8px 4px', padding: '8px 10px', background: '#7f1d1d', borderRadius: 6, fontSize: 12, color: '#fca5a5' }}>
            {error}
          </div>
        )}

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

        {user?.role === 'superadmin' && (
          <a href="/admin" style={{ margin: '0 8px 4px', padding: '8px 10px', borderRadius: 6, display: 'block', fontSize: 12, color: '#7c3aed', textDecoration: 'none' }}>
            ⚙ Admin panel
          </a>
        )}
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
              {(['contacts', 'fields', 'email', 'embed'] as Tab[]).map(t => (
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
                  {t === 'embed' ? 'Embed Code' : t === 'fields' ? 'Form Fields' : t === 'email' ? 'Email' : 'Contacts'}
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
                <ContactsPanel contacts={contacts} loading={loadingContacts} appletId={selected.id} fieldConfig={selected.fieldConfig ?? []} />
              )}
              {tab === 'fields' && (
                <FieldsPanel
                  applet={selected}
                  onSaved={(fields) => handleFieldsSaved(selected.id, fields)}
                />
              )}
              {tab === 'email' && (
                <EmailPanel appletId={selected.id} />
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

function ContactsPanel({ contacts: initial, loading, appletId, fieldConfig }: { contacts: Contact[]; loading: boolean; appletId: string; fieldConfig: FieldDef[] }) {
  const [contacts, setContacts] = useState(initial);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  useEffect(() => {
    setContacts(initial);
    setSelectedContact(null);
  }, [initial]);

  async function cycleStatus(e: React.MouseEvent, c: Contact) {
    e.stopPropagation();
    const next: Contact['status'] = c.status === 'new' ? 'open' : c.status === 'open' ? 'resolved' : 'new';
    setContacts(prev => prev.map(x => x.id === c.id ? { ...x, status: next } : x));
    if (selectedContact?.id === c.id) setSelectedContact(prev => prev ? { ...prev, status: next } : null);
    try {
      await api.updateContactStatus(appletId, c.id, next);
    } catch {
      setContacts(prev => prev.map(x => x.id === c.id ? { ...x, status: c.status } : x));
    }
  }

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading contacts…</div>;
  if (contacts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>
        No contacts yet. Embed the widget on your site to start collecting leads.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Ref', 'Name', 'Email', 'Phone', 'Status', 'Date', ''].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c, i) => {
              const isSelected = selectedContact?.id === c.id;
              return (
                <tr
                  key={c.id}
                  onClick={() => setSelectedContact(isSelected ? null : c)}
                  style={{
                    borderBottom: i < contacts.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ ...td, fontFamily: 'monospace', color: '#3b82f6', fontWeight: 600 }}>{c.refNumber}</td>
                  <td style={td}>{c.name}</td>
                  <td style={td}>{c.email}</td>
                  <td style={{ ...td, color: '#64748b' }}>{c.phone ?? '—'}</td>
                  <td style={td}><StatusBadge status={c.status} onClick={(e) => cycleStatus(e, c)} /></td>
                  <td style={{ ...td, color: '#64748b', whiteSpace: 'nowrap' }}>{formatDate(c.createdAt)}</td>
                  <td style={{ ...td, color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {c.threadCount > 0 && (
                      <span style={{ color: '#3b82f6' }} title="Has messages">💬 {c.threadCount}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedContact && (
        <div style={{ width: 380, flexShrink: 0 }}>
          <ThreadPanel
            contact={selectedContact}
            appletId={appletId}
            fieldConfig={fieldConfig}
            onClose={() => setSelectedContact(null)}
          />
        </div>
      )}
    </div>
  );
}

function ContactField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function ThreadPanel({ contact, appletId, fieldConfig, onClose }: { contact: Contact; appletId: string; fieldConfig: FieldDef[]; onClose: () => void }) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    api.getContactMessages(appletId, contact.id)
      .then(({ messages: msgs }) => {
        setMessages(msgs);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [appletId, contact.id]);

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 180px)' }}>
      {/* Contact details header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{contact.name}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{contact.refNumber}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px' }}>
          <ContactField label="Email" value={contact.email} />
          {contact.phone && <ContactField label="Phone" value={contact.phone} />}
          {contact.customFields && fieldConfig
            .filter(f => f.id.startsWith('cf_') && contact.customFields![f.id])
            .map(f => (
              <ContactField key={f.id} label={f.label} value={contact.customFields![f.id]!} />
            ))
          }
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {loading ? (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '32px 8px', lineHeight: 1.7 }}>
            No messages yet.<br />
            <span style={{ fontSize: 12 }}>Replies with <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>{contact.refNumber}</code> in the subject will appear here.</span>
          </div>
        ) : (
          <>
            {messages.map(m => (
              <div key={m.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3, gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {m.direction === 'inbound' ? '← ' : '→ '}{m.fromAddress}
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatDateTime(m.sentAt)}</span>
                </div>
                <div style={{
                  padding: '8px 11px',
                  borderRadius: 8,
                  background: m.direction === 'inbound' ? '#f0f9ff' : '#f5f3ff',
                  border: `1px solid ${m.direction === 'inbound' ? '#bae6fd' : '#ede9fe'}`,
                  fontSize: 13,
                  color: '#1e293b',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {m.bodyText?.trim() || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No text content</span>}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}

function FieldsPanel({ applet, onSaved }: { applet: Applet; onSaved: (fields: FieldDef[]) => void }) {
  const [fields, setFields] = useState<FieldDef[]>(applet.fieldConfig ?? DEFAULT_FIELDS);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedOk, setSavedOk] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<FieldType>('text');
  const [newPlaceholder, setNewPlaceholder] = useState('');

  useEffect(() => {
    setFields(applet.fieldConfig ?? DEFAULT_FIELDS);
    setShowAdd(false);
    setSaveError('');
  }, [applet.id]);

  function updateField(id: string, patch: Partial<FieldDef>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id));
  }

  function addField(e: FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    const id = 'cf_' + Date.now().toString(36);
    setFields(prev => [...prev, {
      id,
      label: newLabel.trim(),
      type: newType,
      required: false,
      ...(newPlaceholder.trim() ? { placeholder: newPlaceholder.trim() } : {}),
    }]);
    setNewLabel('');
    setNewType('text');
    setNewPlaceholder('');
    setShowAdd(false);
  }

  async function save() {
    setSaving(true);
    setSaveError('');
    try {
      const { fields: saved } = await api.updateAppletFields(applet.id, fields);
      onSaved(saved);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Form Fields</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>
        Customize which fields appear in your widget. Name and email are always required.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {fields.map((field) => {
          const locked = LOCKED_IDS.has(field.id);
          return (
            <div key={field.id} style={fieldCard}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', width: 52, flexShrink: 0 }}>
                    {field.type}
                  </span>
                  <input
                    value={field.label}
                    onChange={e => updateField(field.id, { label: e.target.value })}
                    placeholder="Label"
                    style={{ ...inlineInput, fontWeight: 500 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 60, flexShrink: 0 }} />
                  <input
                    value={field.placeholder ?? ''}
                    onChange={e => updateField(field.id, { placeholder: e.target.value })}
                    placeholder="Placeholder (optional)"
                    style={{ ...inlineInput, color: '#64748b', fontSize: 12 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: locked ? '#94a3b8' : '#475569', cursor: locked ? 'default' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={field.required}
                    disabled={locked}
                    onChange={e => updateField(field.id, { required: e.target.checked })}
                  />
                  Required
                </label>
                {!locked && (
                  <button
                    onClick={() => removeField(field.id)}
                    style={removeBtnStyle}
                    title="Remove field"
                  >
                    ✕
                  </button>
                )}
                {locked && (
                  <span style={{ fontSize: 12, color: '#94a3b8', width: 28, textAlign: 'center' }} title="Required field">🔒</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAdd ? (
        <form onSubmit={addField} style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              autoFocus
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Field label *"
              required
              style={{ ...inlineInput, flex: 1 }}
            />
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as FieldType)}
              style={selectStyle}
            >
              <option value="text">Text</option>
              <option value="tel">Phone / Tel</option>
              <option value="textarea">Multi-line</option>
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <input
              value={newPlaceholder}
              onChange={e => setNewPlaceholder(e.target.value)}
              placeholder="Placeholder (optional)"
              style={{ ...inlineInput, width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={createBtn}>Add field</button>
            <button type="button" onClick={() => { setShowAdd(false); setNewLabel(''); setNewType('text'); setNewPlaceholder(''); }} style={cancelBtn}>Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowAdd(true)} style={{ ...newAppletBtn, marginBottom: 16 }}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Add custom field
        </button>
      )}

      {saveError && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>
          {saveError}
        </div>
      )}

      <button onClick={save} disabled={saving} style={saveBtn}>
        {saving ? 'Saving…' : savedOk ? '✓ Saved' : 'Save changes'}
      </button>
    </div>
  );
}

function suggestImapHost(smtpHost: string): string {
  return smtpHost.replace(/^smtp\./, 'imap.');
}

function EmailPanel({ appletId }: { appletId: string }) {
  const [account, setAccount] = useState<SmtpAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<SmtpAccountInput>({
    fromName: '', fromEmail: '', host: '', port: 587, secure: false, user: '', password: '',
    imapHost: '', imapPort: 993, imapTls: true,
  });
  const [status, setStatus] = useState<'idle' | 'testing' | 'saving' | 'ok' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setStatus('idle');
    setStatusMsg('');
    api.getEmailAccount(appletId)
      .then(({ account: a }) => {
        setAccount(a);
        if (a) {
          setForm({
            fromName: a.fromName, fromEmail: a.fromEmail,
            host: a.host, port: a.port, secure: a.secure,
            user: a.user, password: '',
            imapHost: a.imapHost ?? '', imapPort: a.imapPort ?? 993, imapTls: a.imapTls ?? true,
          });
        } else {
          setForm({ fromName: '', fromEmail: '', host: '', port: 587, secure: false, user: '', password: '', imapHost: '', imapPort: 993, imapTls: true });
        }
      })
      .catch(() => setStatusMsg('Failed to load email account'))
      .finally(() => setLoading(false));
  }, [appletId]);

  function set(patch: Partial<SmtpAccountInput>) {
    setForm(prev => ({ ...prev, ...patch }));
  }

  function handleSmtpHostChange(host: string) {
    const suggested = suggestImapHost(host);
    set({ host, ...(form.imapHost === suggestImapHost(form.host) ? { imapHost: suggested } : {}) });
  }

  async function test() {
    if (!form.password && !account?.passwordSet) { setStatus('error'); setStatusMsg('Enter a password to test.'); return; }
    setStatus('testing'); setStatusMsg('');
    try {
      const payload = { ...form, ...(form.password ? {} : { password: '(unchanged)' }) };
      await api.testEmailAccount(appletId, payload);
      setStatus('ok'); setStatusMsg('SMTP connection successful!');
    } catch (err) {
      setStatus('error'); setStatusMsg(err instanceof Error ? err.message : 'Connection failed');
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.password && !account?.passwordSet) { setStatus('error'); setStatusMsg('Password is required.'); return; }
    setStatus('saving'); setStatusMsg('');
    try {
      const { account: saved } = await api.saveEmailAccount(appletId, form);
      setAccount(saved);
      setForm(prev => ({ ...prev, password: '' }));
      setStatus('ok'); setStatusMsg('Saved successfully!');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error'); setStatusMsg(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await api.deleteEmailAccount(appletId);
      setAccount(null);
      setForm({ fromName: '', fromEmail: '', host: '', port: 587, secure: false, user: '', password: '', imapHost: '', imapPort: 993, imapTls: true });
      setStatus('idle'); setStatusMsg('');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading…</div>;

  const hasImap = !!(account?.imapHost);

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Email Account</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>
        Send notifications from your own address and poll for customer replies. Falls back to platform email if not configured.
      </p>

      {/* Status bar — sync health */}
      {account && (
        <div style={{ marginBottom: 16 }}>
          {account.lastError ? (
            <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
                ✕ Mailbox connection broken
              </div>
              <div style={{ fontSize: 12, color: '#b91c1c', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 6 }}>
                {account.lastError}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                {account.lastErrorAt ? `Since ${new Date(account.lastErrorAt).toLocaleString()}` : ''}
                {' · '}
                <span>Update credentials below and save to retry.</span>
              </div>
            </div>
          ) : hasImap ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13 }}>
              <span style={{ color: '#16a34a' }}>✓</span>
              <span style={{ color: '#166534', flex: 1 }}>
                Connected — <strong>{account.fromEmail}</strong>
                {account.lastSyncAt && (
                  <span style={{ color: '#64748b', fontWeight: 400 }}> · last synced {new Date(account.lastSyncAt).toLocaleString()}</span>
                )}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13 }}>
              <span style={{ color: '#16a34a' }}>✓</span>
              <span style={{ color: '#166534', flex: 1 }}>Connected — <strong>{account.fromEmail}</strong> (SMTP only)</span>
            </div>
          )}
        </div>
      )}

      <form onSubmit={save}>
        {/* ── SMTP section ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          SMTP (outgoing)
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>From name</label>
            <input value={form.fromName} onChange={e => set({ fromName: e.target.value })} placeholder="Acme Support" style={inputStyle} required />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>From email</label>
            <input value={form.fromEmail} onChange={e => set({ fromEmail: e.target.value })} placeholder="support@acme.com" type="email" style={inputStyle} required />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>SMTP host</label>
          <input value={form.host} onChange={e => handleSmtpHostChange(e.target.value)} placeholder="smtp.gmail.com" style={inputStyle} required />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-end' }}>
          <div style={{ width: 100 }}>
            <label style={labelStyle}>Port</label>
            <input
              value={form.port}
              onChange={e => { const p = parseInt(e.target.value, 10); set({ port: isNaN(p) ? 587 : p, secure: p === 465 }); }}
              type="number" min={1} max={65535} style={inputStyle} required
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', marginBottom: 1, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.secure} onChange={e => set({ secure: e.target.checked })} />
            Use TLS
          </label>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Username</label>
          <input value={form.user} onChange={e => set({ user: e.target.value })} placeholder="support@acme.com" style={inputStyle} required />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Password{account?.passwordSet ? ' (leave blank to keep existing)' : ''}</label>
          <input value={form.password} onChange={e => set({ password: e.target.value })} type="password" placeholder={account?.passwordSet ? '••••••••' : 'App password or SMTP password'} style={inputStyle} />
        </div>

        {/* ── IMAP section ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          IMAP (incoming — optional)
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8' }}>
          When configured, CoolRM polls this mailbox every 5 minutes and threads customer replies into their contact record.
        </p>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>IMAP host</label>
          <input value={form.imapHost} onChange={e => set({ imapHost: e.target.value })} placeholder="imap.gmail.com" style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-end' }}>
          <div style={{ width: 100 }}>
            <label style={labelStyle}>Port</label>
            <input
              value={form.imapPort}
              onChange={e => { const p = parseInt(e.target.value, 10); set({ imapPort: isNaN(p) ? 993 : p }); }}
              type="number" min={1} max={65535} style={inputStyle}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', marginBottom: 1, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.imapTls} onChange={e => set({ imapTls: e.target.checked })} />
            Use TLS
          </label>
        </div>

        {statusMsg && (
          <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, fontSize: 13, background: status === 'error' ? '#fef2f2' : '#f0fdf4', color: status === 'error' ? '#dc2626' : '#166534' }}>
            {statusMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={test} disabled={status === 'testing' || status === 'saving'} style={{ ...cancelBtn, color: '#475569' }}>
            {status === 'testing' ? 'Testing…' : 'Test SMTP'}
          </button>
          <button type="submit" disabled={status === 'saving' || status === 'testing'} style={saveBtn}>
            {status === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {account && (
            <button type="button" onClick={disconnect} disabled={disconnecting} style={{ marginLeft: 'auto', fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function statusStyle(status: Contact['status']): { bg: string; color: string; label: string } {
  if (status === 'new')  return { bg: '#eff6ff', color: '#1d4ed8', label: 'New' };
  if (status === 'open') return { bg: '#fefce8', color: '#a16207', label: 'Open' };
  return { bg: '#f0fdf4', color: '#166534', label: 'Resolved' };
}

function StatusBadge({ status, onClick }: { status: Contact['status']; onClick?: (e: React.MouseEvent) => void }) {
  const s = statusStyle(status);
  return (
    <span
      onClick={onClick}
      title="Click to advance status"
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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

const fieldCard: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '10px 14px',
};

const inlineInput: CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  border: '1px solid #e2e8f0',
  borderRadius: 5,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  background: '#f8fafc',
  color: '#1e293b',
  width: '100%',
};

const selectStyle: CSSProperties = {
  padding: '5px 8px',
  border: '1px solid #e2e8f0',
  borderRadius: 5,
  fontSize: 13,
  fontFamily: 'inherit',
  background: '#f8fafc',
  color: '#1e293b',
  outline: 'none',
};

const removeBtnStyle: CSSProperties = {
  padding: '3px 7px',
  borderRadius: 4,
  border: 'none',
  background: '#fef2f2',
  color: '#ef4444',
  fontSize: 11,
  cursor: 'pointer',
};

const saveBtn: CSSProperties = {
  padding: '10px 20px',
  borderRadius: 6,
  border: 'none',
  background: '#3b82f6',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#475569',
  marginBottom: 4,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  color: '#1e293b',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};
