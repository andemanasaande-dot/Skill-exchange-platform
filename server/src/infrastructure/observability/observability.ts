import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type RequestContext = {
  requestId: string;
  correlationId: string;
};

export type ErrorTracker = {
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
};

export type TelemetrySpan = { end: (attributes?: Record<string, unknown>) => void };
export type TelemetryProvider = { startSpan: (name: string, attributes?: Record<string, unknown>) => TelemetrySpan };

const sensitiveKey = /(password|token|secret|authorization|cookie|credential|hash|email|phone)/i;
const contextStorage = new AsyncLocalStorage<RequestContext>();
const counters = new Map<string, number>();
const latency = { count: 0, sumMs: 0, buckets: new Map<number, number>() };
const latencyBuckets = [10, 50, 100, 250, 500, 1000, 2500, 5000];

const scrub = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(scrub);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sensitiveKey.test(key) ? '[REDACTED]' : scrub(entry)]));
};

const increment = (name: string, value = 1) => counters.set(name, (counters.get(name) ?? 0) + value);

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: ['password', 'passwordHash', 'token', 'refreshToken', 'accessToken', 'cookie', 'authorization', '*.password', '*.token', '*.secret'], censor: '[REDACTED]' },
});

export const log = {
  info: (message: string, metadata?: Record<string, unknown>) => logger.info({ ...contextStorage.getStore(), ...(scrub(metadata) as Record<string, unknown>) }, message),
  warn: (message: string, metadata?: Record<string, unknown>) => logger.warn({ ...contextStorage.getStore(), ...(scrub(metadata) as Record<string, unknown>) }, message),
  error: (message: string, metadata?: Record<string, unknown>) => logger.error({ ...contextStorage.getStore(), ...(scrub(metadata) as Record<string, unknown>) }, message),
  debug: (message: string, metadata?: Record<string, unknown>) => logger.debug({ ...contextStorage.getStore(), ...(scrub(metadata) as Record<string, unknown>) }, message),
};

export const requestContext = {
  get: () => contextStorage.getStore(),
  middleware: ((req: Request, res: Response, next: NextFunction) => {
    const requestId = typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].length <= 128
      ? req.headers['x-request-id']
      : crypto.randomUUID();
    const correlationId = typeof req.headers['x-correlation-id'] === 'string' && req.headers['x-correlation-id'].length <= 128
      ? req.headers['x-correlation-id']
      : requestId;
    const context = { requestId, correlationId };
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Correlation-ID', correlationId);
    contextStorage.run(context, next);
  }) as RequestHandler,
};

export const metrics = {
  request: (method: string, route: string, status: number, durationMs: number) => {
    increment('http_requests_total');
    increment(`http_requests_total|method=${method}|route=${route}|status=${status}`);
    latency.count += 1;
    latency.sumMs += durationMs;
    const bucket = latencyBuckets.find((limit) => durationMs <= limit) ?? Infinity;
    latency.buckets.set(bucket, (latency.buckets.get(bucket) ?? 0) + 1);
  },
  authFailure: (reason: string) => increment(`auth_failures_total|reason=${reason}`),
  unauthorized: (reason: string) => increment(`unauthorized_access_total|reason=${reason}`),
  databaseError: (operation: string) => increment(`database_errors_total|operation=${operation}`),
  socket: (event: string) => increment(`socket_io_events_total|event=${event}`),
  message: (event: 'sent' | 'delivered' | 'error') => increment(`messages_total|event=${event}`),
  snapshot: () => new Map(counters),
  prometheus: () => {
    const lines = ['# HELP http_requests_total Total HTTP requests.', '# TYPE http_requests_total counter'];
    for (const [key, value] of counters) {
      const [name, labels] = key.split('|');
      lines.push(`${name}${labels ? `{${labels.split('|').map((label) => { const [k, v] = label.split('='); return `${k}="${v}"`; }).join(',')}}` : ''} ${value}`);
    }
    lines.push('# HELP http_request_duration_ms HTTP request latency.', '# TYPE http_request_duration_ms summary', `http_request_duration_ms_count ${latency.count}`, `http_request_duration_ms_sum ${latency.sumMs}`);
    return `${lines.join('\n')}\n`;
  },
};

const noopErrorTracker: ErrorTracker = { captureException: () => undefined };
const noopTelemetry: TelemetryProvider = { startSpan: () => ({ end: () => undefined }) };
let errorTracker: ErrorTracker = noopErrorTracker;
let telemetry: TelemetryProvider = noopTelemetry;
export const configureErrorTracker = (tracker: ErrorTracker) => { errorTracker = tracker; };
export const configureTelemetry = (provider: TelemetryProvider) => { telemetry = provider; };
export const startSpan = (name: string, attributes?: Record<string, unknown>) => telemetry.startSpan(name, attributes);
export const trackError = (error: unknown, context?: Record<string, unknown>) => {
  errorTracker.captureException(error, { ...contextStorage.getStore(), ...(scrub(context) as Record<string, unknown>) });
};

export const observability = { log, logger, requestContext, metrics, configureErrorTracker, configureTelemetry, startSpan, trackError };
