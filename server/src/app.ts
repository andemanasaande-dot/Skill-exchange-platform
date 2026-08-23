import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createHealthRouter } from './modules/health/routes';
import { createAuthRouter } from './modules/auth/routes';
import { createUsersRouter } from './modules/users/routes';
import { createSkillsRouter } from './modules/skills/routes';
import { createRequestsRouter } from './modules/requests/routes';
import { createConversationsRouter } from './modules/conversations/routes';
import { createMessageReadRouter, createMessagesRouter } from './modules/messages/routes';
import { createNotificationsRouter } from './modules/notifications/routes';
import { createModerationRouter } from './modules/moderation/routes';
import { createAdminRouter } from './modules/admin/routes';
import { createRecommendationsRouter } from './modules/recommendations/routes';
import { registerNotificationSubscribers } from './modules/notifications/notifications.service';
import { requireActiveUser, requireAuth } from './middleware/auth.middleware';
import { log, metrics, requestContext, startSpan, trackError } from './infrastructure/observability/observability';
import { env } from './config/env';

dotenv.config();
registerNotificationSubscribers();

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(requestContext.middleware);
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const span = startSpan(`${req.method} ${req.path}`);
  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route = req.route?.path ?? req.path;
    metrics.request(req.method, route, res.statusCode, durationMs);
    span.end({ statusCode: res.statusCode, durationMs });
    log.info('HTTP request completed.', { method: req.method, route, statusCode: res.statusCode, durationMs: Math.round(durationMs * 100) / 100 });
  });
  next();
});

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.json({ name: 'SkillSwap API', status: 'ok' });
});

app.use('/api/v1', createHealthRouter());
app.use('/api/v1/auth', createAuthRouter());
app.use('/api/v1', requireAuth, requireActiveUser, createUsersRouter());
app.use('/api/v1/recommendations', requireAuth, createRecommendationsRouter());
app.use('/api/v1/skills', requireAuth, requireActiveUser, createSkillsRouter());
app.use('/api/v1/requests', requireAuth, requireActiveUser, createRequestsRouter());
app.use('/api/v1/conversations', requireAuth, requireActiveUser, createConversationsRouter());
app.use('/api/v1/conversations', requireAuth, requireActiveUser, createMessagesRouter());
app.use('/api/v1/messages', requireAuth, createMessageReadRouter());
app.use('/api/v1/notifications', requireAuth, createNotificationsRouter());
app.use('/api/v1/moderation', requireAuth, requireActiveUser, createModerationRouter());
app.use('/api/v1/admin', requireAuth, requireActiveUser, createAdminRouter());

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  trackError(error, { source: 'http' });
  log.error('Unhandled HTTP error.', { error: error instanceof Error ? error.message : 'unknown' });
  res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' } });
});

export default app;
