export interface Applet {
  id: string;
  name: string;
  widgetKey: string;
  isActive: boolean;
  createdAt: string;
  embedCode: string;
}

export interface Contact {
  id: string;
  refNumber: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
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
};
