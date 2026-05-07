import nodemailer from 'nodemailer';
import { config } from '../config.js';

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
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

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    // No SMTP configured — log to console (useful in dev)
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

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  const transporter = getTransporter();

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
