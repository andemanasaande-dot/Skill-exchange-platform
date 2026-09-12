import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { log, metrics, trackError } from '../observability/observability';

dotenv.config();

const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'error' }] });

prisma.$on('error', (event: Prisma.LogEvent) => {
	metrics.databaseError(event.target ?? 'unknown');
	trackError(new Error(event.message), { source: 'prisma', target: event.target });
	log.error('Database error.', { target: event.target });
});

export default prisma;
