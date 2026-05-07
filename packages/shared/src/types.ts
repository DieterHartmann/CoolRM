// API response envelope — used on every endpoint
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// Domain enums shared between API and frontend
export type ContactStatus = 'new' | 'open' | 'resolved';
export type UserRole = 'owner' | 'member';
export type EmailProvider = 'gmail' | 'outlook' | 'imap';
export type MessageDirection = 'inbound' | 'outbound';

// Ref number format: CRM-00001 through CRM-99999 (per-tenant sequential)
export const CRM_REF_PATTERN = /^CRM-\d{5}$/;
// Used to detect ref# in email subjects during threading
export const EMAIL_SUBJECT_REF_PATTERN = /\[CRM-\d{5}\]/;

export function extractRefFromSubject(subject: string): string | null {
  const match = subject.match(EMAIL_SUBJECT_REF_PATTERN);
  return match?.[0]?.slice(1, -1) ?? null; // strip [ ]
}

export function appendRefToSubject(subject: string, ref: string): string {
  if (EMAIL_SUBJECT_REF_PATTERN.test(subject)) return subject;
  return `${subject} [${ref}]`;
}
