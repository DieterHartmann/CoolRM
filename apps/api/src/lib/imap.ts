import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { getTenantClient } from '@crm/db';

export interface ImapSyncConfig {
  imapHost: string;
  imapPort: number;
  imapTls: boolean;
  user: string;
  pass: string;
}

const REF_RE = /\[CRM-(C-\d+)\]/i;

export async function syncMailbox(params: {
  cfg: ImapSyncConfig;
  schemaName: string;
  appletId: string;
  accountId: string;
  lastSyncAt: Date | null;
}): Promise<void> {
  const { cfg, schemaName, appletId, accountId, lastSyncAt } = params;
  const db = getTenantClient(schemaName);

  const client = new ImapFlow({
    host: cfg.imapHost,
    port: cfg.imapPort,
    secure: cfg.imapTls,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });

  await client.connect();

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = lastSyncAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      for await (const msg of client.fetch({ since }, { source: true })) {
        if (!msg.source) continue;

        const parsed = await simpleParser(msg.source as Buffer);
        const subject = parsed.subject ?? '';
        const messageId = parsed.messageId ?? null;

        // Dedup: skip if already ingested
        if (messageId) {
          const exists = await db.message.findUnique({ where: { emailMessageId: messageId } });
          if (exists) continue;
        }

        // Only thread emails that reference a CRM contact via subject ref
        const match = REF_RE.exec(subject);
        if (!match) continue;

        const refNumber = match[1]!;
        const contact = await db.contact.findUnique({ where: { refNumber } });
        if (!contact || contact.appletId !== appletId) continue;

        const msgDate = parsed.date ?? new Date();

        // Find or create thread
        let thread = await db.thread.findFirst({ where: { contactId: contact.id } });
        if (!thread) {
          thread = await db.thread.create({
            data: { contactId: contact.id, subject, lastActivityAt: msgDate },
          });
        } else {
          await db.thread.update({ where: { id: thread.id }, data: { lastActivityAt: msgDate } });
        }

        const fromAddr = parsed.from?.text ?? '';
        const toAddrObj = parsed.to;
        const toAddr = Array.isArray(toAddrObj)
          ? (toAddrObj[0]?.text ?? '')
          : (toAddrObj?.text ?? '');

        await db.message.create({
          data: {
            threadId: thread.id,
            direction: 'inbound',
            fromAddress: fromAddr,
            toAddress: toAddr,
            subject,
            bodyHtml: typeof parsed.html === 'string' ? parsed.html : null,
            bodyText: parsed.text ?? null,
            sentAt: msgDate,
            emailMessageId: messageId,
            hasRef: true,
          },
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  await db.emailAccount.update({
    where: { id: accountId },
    data: { lastSyncAt: new Date(), lastError: null, lastErrorAt: null },
  });
}
