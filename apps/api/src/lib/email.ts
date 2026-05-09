import nodemailer from 'nodemailer';
import { config } from '../config.js';

export interface TenantMailOptions {
  transporter: nodemailer.Transporter;
  from: string; // e.g. "Acme Support <support@acme.com>"
}

let _transporter: nodemailer.Transporter | null = null;

function getPlatformTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter;
  if (!config.SMTP_HOST) return null;

  _transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT ?? 587,
    secure: (config.SMTP_PORT ?? 587) === 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  });

  return _transporter;
}

export function createSmtpTransporter(cfg: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  const transporter = getPlatformTransporter();

  if (!transporter) {
    console.info('[Email] Verification link (no SMTP configured):', { to, url });
    return;
  }

  await transporter.sendMail({
    from: config.SMTP_FROM ?? config.SMTP_USER,
    to,
    subject: 'Verify your CoolRM account',
    text: `Verify your email address: ${url}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Verify your email</h2>
        <p>Click the button below to verify your address and activate your account.</p>
        <p>
          <a href="${url}"
             style="display:inline-block;padding:12px 24px;background:#6d28d9;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
            Verify email
          </a>
        </p>
        <p style="color:#6b7280;font-size:14px">Link expires in 24 hours. If you didn't sign up, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendNewContactEmail(
  to: string,
  appletName: string,
  contact: { ref: string; name: string; email: string; phone?: string; message: string },
  tenant?: TenantMailOptions,
): Promise<void> {
  const transporter = tenant?.transporter ?? getPlatformTransporter();
  const from = tenant?.from ?? config.SMTP_FROM ?? config.SMTP_USER;
  const subject = `New contact [${contact.ref}] via ${appletName}`;

  if (!transporter) {
    console.info('[Email] New contact notification (no SMTP configured):', { to, subject, contact });
    return;
  }

  await transporter.sendMail({
    from,
    to,
    subject,
    text: [
      `New contact received via ${appletName}`,
      `Ref: ${contact.ref}`,
      `Name: ${contact.name}`,
      `Email: ${contact.email}`,
      contact.phone ? `Phone: ${contact.phone}` : '',
      ``,
      contact.message,
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#1f2937">New contact: ${contact.ref}</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:6px 0;color:#6b7280;width:80px">Name</td><td style="padding:6px 0;font-weight:500">${contact.name}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Email</td><td style="padding:6px 0">${contact.email}</td></tr>
          ${contact.phone ? `<tr><td style="padding:6px 0;color:#6b7280">Phone</td><td style="padding:6px 0">${contact.phone}</td></tr>` : ''}
        </table>
        <div style="background:#f9fafb;border-radius:6px;padding:16px;white-space:pre-wrap">${contact.message}</div>
        <p style="color:#9ca3af;font-size:12px;margin-top:16px">Received via ${appletName} · CoolRM</p>
      </div>
    `,
  });
}

export async function sendContactConfirmationEmail(
  to: string,
  tenantName: string,
  contact: { ref: string; name: string; message: string },
  tenant?: TenantMailOptions,
): Promise<void> {
  const transporter = tenant?.transporter ?? getPlatformTransporter();
  const from = tenant?.from ?? config.SMTP_FROM ?? config.SMTP_USER;
  const subject = `We received your message — ${contact.ref}`;

  if (!transporter) {
    console.info('[Email] Contact confirmation (no SMTP configured):', { to, subject });
    return;
  }

  await transporter.sendMail({
    from,
    to,
    subject,
    text: [
      `Hi ${contact.name},`,
      ``,
      `Thanks for reaching out to ${tenantName}. We've received your message and will be in touch soon.`,
      ``,
      `Your reference number is ${contact.ref} — keep it handy if you need to follow up.`,
      ``,
      `— ${tenantName}`,
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1f2937">Message received!</h2>
        <p>Hi ${contact.name},</p>
        <p>Thanks for reaching out to <strong>${tenantName}</strong>. We've received your message and will be in touch soon.</p>
        <div style="margin:20px 0;padding:14px 18px;background:#ede9fe;border-radius:8px;text-align:center">
          <span style="font-family:monospace;font-size:18px;font-weight:700;color:#6d28d9">${contact.ref}</span>
          <p style="margin:6px 0 0;font-size:13px;color:#7c3aed">Keep this reference number handy</p>
        </div>
        <p style="color:#6b7280;font-size:13px">If you have questions, just reply to this email and include your reference number.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  const transporter = getPlatformTransporter();

  if (!transporter) {
    console.info('[Email] Password reset link (no SMTP configured):', { to, url });
    return;
  }

  await transporter.sendMail({
    from: config.SMTP_FROM ?? config.SMTP_USER,
    to,
    subject: 'Reset your CoolRM password',
    text: `Reset your password: ${url}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Reset your password</h2>
        <p>
          <a href="${url}"
             style="display:inline-block;padding:12px 24px;background:#6d28d9;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
            Reset password
          </a>
        </p>
        <p style="color:#6b7280;font-size:14px">Link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}
