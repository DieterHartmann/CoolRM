import { FastifyPluginAsync } from 'fastify';
import { getPlatformClient } from '@crm/db';
import { FieldDef, DEFAULT_FIELDS } from '../lib/field-config.js';

const widgetRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/widget/:key/config — public, no auth required
  app.get('/:key/config', async (request, reply) => {
    const { key } = request.params as { key: string };
    const db = getPlatformClient();

    const applet = await db.applet.findUnique({
      where: { widgetKey: key },
      select: { isActive: true, fieldConfig: true },
    });

    if (!applet || !applet.isActive) {
      return reply.status(404).send({ success: false, error: 'Widget not found' });
    }

    const fields = (applet.fieldConfig as FieldDef[] | null) ?? DEFAULT_FIELDS;
    return { success: true, data: { fields } };
  });
};

export default widgetRoutes;
