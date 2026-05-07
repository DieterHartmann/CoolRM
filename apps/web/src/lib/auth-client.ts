export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  tenantId: string | null;
  role: string;
  companyName: string | null;
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch('/api/auth/get-session', { credentials: 'include' });
    if (!res.ok) return null;
    const json = await res.json() as { user?: SessionUser } | null;
    return json?.user ?? null;
  } catch {
    return null;
  }
}

export async function signUp(email: string, password: string, name: string): Promise<void> {
  const res = await fetch('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, companyName: name }),
    credentials: 'include',
  });
  if (!res.ok) {
    const json = await res.json() as { message?: string; error?: string };
    throw new Error(json.message ?? json.error ?? 'Sign up failed');
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, rememberMe: true }),
    credentials: 'include',
  });
  if (!res.ok) {
    const json = await res.json() as { message?: string; error?: string };
    throw new Error(json.message ?? json.error ?? 'Invalid credentials');
  }
}

export async function signOut(): Promise<void> {
  await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
}
