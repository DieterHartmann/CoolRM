export type FieldType = 'text' | 'email' | 'tel' | 'textarea';

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
}

export const STANDARD_IDS = new Set(['name', 'email', 'phone', 'message']);

export const DEFAULT_FIELDS: FieldDef[] = [
  { id: 'name',    label: 'Name',    type: 'text',     required: true,  placeholder: 'Your name' },
  { id: 'email',   label: 'Email',   type: 'email',    required: true,  placeholder: 'you@example.com' },
  { id: 'phone',   label: 'Phone',   type: 'tel',      required: false, placeholder: 'Optional' },
  { id: 'message', label: 'Message', type: 'textarea', required: true,  placeholder: 'How can we help?' },
];

const VALID_TYPES = new Set(['text', 'email', 'tel', 'textarea']);

export function validateFieldDefs(fields: unknown): fields is FieldDef[] {
  if (!Array.isArray(fields) || fields.length === 0 || fields.length > 20) return false;
  return fields.every((f) => {
    if (!f || typeof f !== 'object') return false;
    const o = f as Record<string, unknown>;
    return (
      typeof o['id'] === 'string' && (o['id'] as string).length > 0 && (o['id'] as string).length <= 64 &&
      typeof o['label'] === 'string' && (o['label'] as string).length > 0 && (o['label'] as string).length <= 100 &&
      VALID_TYPES.has(o['type'] as string) &&
      typeof o['required'] === 'boolean' &&
      (o['placeholder'] === undefined || typeof o['placeholder'] === 'string')
    );
  });
}
