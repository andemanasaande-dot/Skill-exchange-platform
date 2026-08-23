import { env } from '../../config/env';
import { logger } from '../logger/logger';

export type VerificationEmailPayload = {
  to: string;
  name: string;
  token: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  body: string;
};

export interface EmailService {
  sendVerificationEmail(payload: VerificationEmailPayload): Promise<void>;
  sendPasswordResetEmail(payload: VerificationEmailPayload): Promise<void>;
  sendEmail(message: EmailMessage): Promise<void>;
}

export class DevelopmentEmailService implements EmailService {
  async sendVerificationEmail(payload: VerificationEmailPayload): Promise<void> {
    const payloadForLog = {
      event: 'verification_email_sent',
      tokenLength: payload.token.length,
      provider: 'development',
    };

    logger.info('Verification email queued in development mode.', payloadForLog);
  }

  async sendPasswordResetEmail(payload: VerificationEmailPayload): Promise<void> {
    const payloadForLog = {
      event: 'password_reset_email_sent',
      tokenLength: payload.token.length,
      provider: 'development',
    };

    logger.info('Password reset email queued in development mode.', payloadForLog);
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    logger.info('Email event queued in development mode.', {
      event: 'email_sent',
      provider: 'development',
    });
  }
}

export const createEmailService = (): EmailService => {
  if (env.nodeEnv === 'production' && env.emailProvider !== 'mock') {
    return new DevelopmentEmailService();
  }

  return new DevelopmentEmailService();
};

export const defaultEmailService = createEmailService();
