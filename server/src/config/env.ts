import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const isDeploymentEnvironment = process.env.NODE_ENV === 'staging' || isProduction;

const defaultDevConfig = {
  DATABASE_URL: 'postgresql://postgres@localhost:5432/skillswap?schema=public',
  PORT: 5000,
  NODE_ENV: 'development',
  FRONTEND_URL: 'http://localhost:5173',
  JWT_ACCESS_SECRET: 'local-development-access-placeholder-32',
  JWT_REFRESH_SECRET: 'local-development-refresh-placeholder-32',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  COOKIE_DOMAIN: 'localhost',
  EMAIL_PROVIDER: 'mock',
  EMAIL_FROM: 'noreply@localhost.localdomain',
  STORAGE_PROVIDER: 'local',
  STORAGE_BUCKET: 'skillswap-local',
  STORAGE_REGION: 'us-east-1',
  STORAGE_ACCESS_KEY: 'local-access-key',
  STORAGE_SECRET_KEY: 'local-secret-key',
  LOG_LEVEL: 'info',
} as const;

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(defaultDevConfig.PORT),
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default(defaultDevConfig.NODE_ENV),
  FRONTEND_URL: z.string().url().default(defaultDevConfig.FRONTEND_URL),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default(defaultDevConfig.JWT_ACCESS_EXPIRES_IN),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default(defaultDevConfig.JWT_REFRESH_EXPIRES_IN),
  COOKIE_DOMAIN: z.string().optional().default(defaultDevConfig.COOKIE_DOMAIN),
  EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid', 'ses', 'mock']).default(defaultDevConfig.EMAIL_PROVIDER),
  EMAIL_FROM: z.string().email().default(defaultDevConfig.EMAIL_FROM),
  STORAGE_PROVIDER: z.enum(['local', 's3', 'gcs', 'mock']).default(defaultDevConfig.STORAGE_PROVIDER),
  STORAGE_BUCKET: z.string().min(1).default(defaultDevConfig.STORAGE_BUCKET),
  STORAGE_REGION: z.string().min(1).default(defaultDevConfig.STORAGE_REGION),
  STORAGE_ACCESS_KEY: z.string().optional().default(defaultDevConfig.STORAGE_ACCESS_KEY),
  STORAGE_SECRET_KEY: z.string().optional().default(defaultDevConfig.STORAGE_SECRET_KEY),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default(defaultDevConfig.LOG_LEVEL),
});

const rawConfig = {
  DATABASE_URL: process.env.DATABASE_URL ?? defaultDevConfig.DATABASE_URL,
  PORT: process.env.PORT ?? String(defaultDevConfig.PORT),
  NODE_ENV: process.env.NODE_ENV ?? defaultDevConfig.NODE_ENV,
  FRONTEND_URL: process.env.FRONTEND_URL ?? defaultDevConfig.FRONTEND_URL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? defaultDevConfig.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? defaultDevConfig.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? defaultDevConfig.JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? defaultDevConfig.JWT_REFRESH_EXPIRES_IN,
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? defaultDevConfig.COOKIE_DOMAIN,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER ?? defaultDevConfig.EMAIL_PROVIDER,
  EMAIL_FROM: process.env.EMAIL_FROM ?? defaultDevConfig.EMAIL_FROM,
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER ?? defaultDevConfig.STORAGE_PROVIDER,
  STORAGE_BUCKET: process.env.STORAGE_BUCKET ?? defaultDevConfig.STORAGE_BUCKET,
  STORAGE_REGION: process.env.STORAGE_REGION ?? defaultDevConfig.STORAGE_REGION,
  STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY ?? defaultDevConfig.STORAGE_ACCESS_KEY,
  STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY ?? defaultDevConfig.STORAGE_SECRET_KEY,
  LOG_LEVEL: process.env.LOG_LEVEL ?? defaultDevConfig.LOG_LEVEL,
};

const parsedEnv = envSchema.safeParse(rawConfig);

if (!parsedEnv.success) {
  const errorMessage = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ');

  if (isProduction) {
    throw new Error(`Invalid production environment configuration. ${errorMessage}`);
  }

  // Development mode allows safe local defaults while still validating shape.
  console.warn(`Using development environment defaults. Validation warnings: ${errorMessage}`);
}

const validatedConfig = (parsedEnv.success ? parsedEnv.data : envSchema.parse(rawConfig)) as z.infer<typeof envSchema>;

if (isDeploymentEnvironment) {
  const forbiddenDeveloperValues: string[] = [
    defaultDevConfig.JWT_ACCESS_SECRET,
    defaultDevConfig.JWT_REFRESH_SECRET,
    defaultDevConfig.DATABASE_URL,
    defaultDevConfig.FRONTEND_URL,
  ];

  if (
    forbiddenDeveloperValues.includes(validatedConfig.JWT_ACCESS_SECRET) ||
    forbiddenDeveloperValues.includes(validatedConfig.JWT_REFRESH_SECRET) ||
    forbiddenDeveloperValues.includes(validatedConfig.DATABASE_URL) ||
    forbiddenDeveloperValues.includes(validatedConfig.FRONTEND_URL)
  ) {
    throw new Error('Deployment environment secrets must be set to non-default values.');
  }
}

export type AppConfig = z.infer<typeof envSchema>;

export const config: AppConfig = validatedConfig;

export const env = {
  port: validatedConfig.PORT,
  nodeEnv: validatedConfig.NODE_ENV,
  frontendUrl: validatedConfig.FRONTEND_URL,
  databaseUrl: validatedConfig.DATABASE_URL,
  jwtAccessSecret: validatedConfig.JWT_ACCESS_SECRET,
  jwtRefreshSecret: validatedConfig.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: validatedConfig.JWT_ACCESS_EXPIRES_IN,
  jwtRefreshExpiresIn: validatedConfig.JWT_REFRESH_EXPIRES_IN,
  cookieDomain: validatedConfig.COOKIE_DOMAIN,
  emailProvider: validatedConfig.EMAIL_PROVIDER,
  emailFrom: validatedConfig.EMAIL_FROM,
  storageProvider: validatedConfig.STORAGE_PROVIDER,
  storageBucket: validatedConfig.STORAGE_BUCKET,
  storageRegion: validatedConfig.STORAGE_REGION,
  storageAccessKey: validatedConfig.STORAGE_ACCESS_KEY,
  storageSecretKey: validatedConfig.STORAGE_SECRET_KEY,
  logLevel: validatedConfig.LOG_LEVEL,
};
