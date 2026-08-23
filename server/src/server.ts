import { createServer } from 'node:http';
import app from './app';
import { createSocketServer } from './infrastructure/realtime/socket-server';
import prisma from './infrastructure/database/prisma';
import { logger } from './infrastructure/logger/logger';

const PORT = Number(process.env.PORT || 5000);
const httpServer = createServer(app);
const socketServer = createSocketServer(httpServer);

httpServer.listen(PORT, () => {
  logger.info('SkillSwap server started.', { port: PORT });
});

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('SkillSwap server shutting down.', { signal });
  socketServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await prisma.$disconnect();
};

process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });
