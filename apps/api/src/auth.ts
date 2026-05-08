import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { randomBytes, randomUUID } from 'crypto';
import { getPlatformClient, provisionTenant } from '@crm/db';
import { config } from './config.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './lib/email.js';

async function handlePostVerification(userId: string, userEmail: string, companyName: string | null, userName: string): Promise<void> {
  const db = getPlatformClient();

  // Guard: re-fetch to avoid duplicate provisioning under concurrent requests
  const current = await db.user.findUnique({
    where: { id: userId },
    select: { tenantId: true },
  });
  if (current?.tenantId) return;

  const name = companyName || userName;

  const tenant = await db.tenant.create({
    data: {
      id: randomUUID(),
      slug: randomBytes(8).toString('hex'),
      companyName: name,
      ownerEmail: userEmail,
    },
  });

  await provisionTenant(tenant.id, config.APP_DB_USER);

  await db.user.update({
    where: { id: userId },
    data: { tenantId: tenant.id },
  });
}

export const auth = betterAuth({
  database: prismaAdapter(getPlatformClient(), { provider: 'postgresql' }),

  secret: config.JWT_SECRET,
  baseURL: config.API_URL,
  basePath: '/api/auth',
  trustedOrigins: config.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    callbackURL: config.FRONTEND_URL,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
  },

  // Additional fields stored on the user record
  user: {
    additionalFields: {
      tenantId: {
        type: 'string',
        required: false,
        input: false, // Never accepted from client — set internally after provisioning
      },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'owner',
        input: false,
      },
      companyName: {
        type: 'string',
        required: false,
        input: true, // Accepted during sign-up
      },
    },
  },

  databaseHooks: {
    user: {
      update: {
        after: async (user) => {
          // Provision tenant the first time email is verified.
          // The !tenantId guard ensures this runs exactly once.
          if (!user.emailVerified || user.tenantId) return;

          try {
            await handlePostVerification(
              user.id,
              user.email,
              (user as Record<string, unknown>)['companyName'] as string | null,
              user.name,
            );
          } catch (err) {
            console.error('[Auth] Tenant provisioning failed for user', user.id, err);
          }
        },
      },
    },
  },
});

export type Auth = typeof auth;
