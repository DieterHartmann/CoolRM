export type FieldType = 'text' | 'email' | 'tel' | 'textarea';

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
}

export const DEFAULT_FIELDS: FieldDef[] = [
  { id: 'name',    label: 'Name',    type: 'text',     required: true,  placeholder: 'Your name' },
  { id: 'email',   label: 'Email',   type: 'email',    required: true,  placeholder: 'you@example.com' },
  { id: 'phone',   label: 'Phone',   type: 'tel',      required: false, placeholder: 'Optional' },
  { id: 'message', label: 'Message', type: 'textarea', required: true,  placeholder: 'How can we help?' },
];

export interface Applet {
  id: string;
  name: string;
  widgetKey: string;
  isActive: boolean;
  createdAt: string;
  embedCode: string;
  fieldConfig: FieldDef[] | null;
}

export interface SmtpAccount {
  id?: string;
  fromName: string;
  fromEmail: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  passwordSet: boolean;
}

export interface SmtpAccountInput {
  fromName: string;
  fromEmail: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string; // blank = keep existing
}

export interface AppletAdmin {
  id: string;
  name: string;
  widgetKey: string;
  isActive: boolean;
  contactCount: number;
  createdAt: string;
}

export interface TenantAdmin {
  id: string;
  companyName: string;
  ownerEmail: string;
  createdAt: string;
  applets: AppletAdmin[];
}

export interface Contact {
  id: string;
  refNumber: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: 'new' | 'open' | 'resolved';
  createdAt: string;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'include' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(path, init);
  const json = await res.json() as { success: boolean; data: T; error?: string };
  if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data;
}

export const api = {
  getApplets: () =>
    req<{ applets: Applet[] }>('GET', '/api/v1/applets'),
  createApplet: (name: string) =>
    req<{ applet: Applet }>('POST', '/api/v1/applets', { name }),
  getContacts: (appletId: string) =>
    req<{ contacts: Contact[] }>('GET', `/api/v1/applets/${appletId}/contacts`),
  updateContactStatus: (appletId: string, contactId: string, status: Contact['status']) =>
    req<{ contact: { id: string; status: Contact['status'] } }>(
      'PATCH', `/api/v1/applets/${appletId}/contacts/${contactId}/status`, { status },
    ),
  updateAppletFields: (appletId: string, fields: FieldDef[]) =>
    req<{ fields: FieldDef[] }>('PUT', `/api/v1/applets/${appletId}/fields`, { fields }),
  getAdminTenants: () =>
    req<{ tenants: TenantAdmin[] }>('GET', '/api/v1/admin/tenants'),
  setAppletActive: (appletId: string, isActive: boolean) =>
    req<{ applet: { id: string; isActive: boolean } }>('PATCH', `/api/v1/admin/applets/${appletId}/active`, { isActive }),
  getEmailAccount: (appletId: string) =>
    req<{ account: SmtpAccount | null }>('GET', `/api/v1/applets/${appletId}/email-account`),
  saveEmailAccount: (appletId: string, data: SmtpAccountInput) =>
    req<{ account: SmtpAccount }>('PUT', `/api/v1/applets/${appletId}/email-account`, data),
  deleteEmailAccount: (appletId: string) =>
    req<Record<string, never>>('DELETE', `/api/v1/applets/${appletId}/email-account`),
  testEmailAccount: (appletId: string, data: SmtpAccountInput) =>
    req<{ ok: boolean }>('POST', `/api/v1/applets/${appletId}/email-account/test`, data),
};
