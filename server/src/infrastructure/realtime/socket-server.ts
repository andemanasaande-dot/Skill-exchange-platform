import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { verifyAccessToken } from '../../modules/auth/auth.service';
import { conversationsRepository } from '../../modules/conversations/conversations.repository';
import { messagesService } from '../../modules/messages/messages.service';
import { eventBus } from '../events/event-bus';
import { logger } from '../logger/logger';
import { createMessageSchema } from '../../modules/messages/messages.validation';
import prisma from '../database/prisma';
import { log, metrics, trackError } from '../observability/observability';
import { env } from '../../config/env';

const roomFor = (conversationId: string) => `conversation:${conversationId}`;
const userRoomFor = (userId: string) => `user:${userId}`;

type SocketUser = { id: string; email: string; role?: string; status?: string };

type AuthedSocket = Socket & { data: { user: SocketUser; authorizedConversations: Set<string> } };

const getToken = (socket: Socket) => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();
  const authorization = socket.handshake.headers.authorization;
  return typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null;
};

const authorizeConversation = async (socket: AuthedSocket, conversationId: string) => {
  if (!await isActiveUser(socket)) return false;
  const conversation = await conversationsRepository.getById(conversationId);
  if (!conversation || conversation.request.status !== 'ACCEPTED' || (conversation.userAId !== socket.data.user.id && conversation.userBId !== socket.data.user.id)) return false;
  socket.data.authorizedConversations.add(conversationId);
  return true;
};

const isActiveUser = async (socket: AuthedSocket) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: socket.data.user.id }, select: { status: true, isRestricted: true } });
    return user?.status === 'ACTIVE' && !user.isRestricted;
  } catch (_error) {
    return false;
  }
};

const authorizedRoom = (socket: AuthedSocket, conversationId: string) => socket.data.authorizedConversations.has(conversationId);

export const createSocketServer = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: env.frontendUrl, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = getToken(socket);
      if (!token) {
        metrics.socket('connection_rejected');
        return next(new Error('UNAUTHORIZED'));
      }
      const payload = verifyAccessToken(token);
      socket.data.user = { id: payload.sub, email: payload.email, role: payload.role, status: payload.status };
      socket.data.authorizedConversations = new Set<string>();
        socket.join(userRoomFor(socket.data.user.id));
      return next();
    } catch (_error) {
      metrics.socket('connection_rejected');
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthedSocket;
    logger.info('Socket.IO client connected.', { socketId: socket.id, userId: socket.data.user.id });
    metrics.socket('connected');

    socket.on('conversation:join', async (conversationId: unknown, acknowledge?: (response: { ok: boolean; code?: string }) => void) => {
      if (typeof conversationId !== 'string' || !conversationId.trim() || !(await authorizeConversation(socket, conversationId.trim()))) {
        metrics.socket('join_rejected');
        socket.emit('error', { code: 'FORBIDDEN', message: 'You are not authorized to join this conversation.' });
        acknowledge?.({ ok: false, code: 'FORBIDDEN' });
        return;
      }
      socket.join(roomFor(conversationId.trim()));
      metrics.socket('joined_conversation');
      acknowledge?.({ ok: true });
    });

    socket.on('message:send', async (input: unknown) => {
      const parsed = createMessageSchema.safeParse(input);
      if (!parsed.success || !await isActiveUser(socket) || !authorizedRoom(socket, parsed.data.conversationId)) {
        metrics.message('error');
        log.warn('Socket message rejected.', { socketId: socket.id, conversationId: parsed.success ? parsed.data.conversationId : undefined });
        socket.emit('error', { code: 'FORBIDDEN', message: 'Join an authorized conversation before sending messages.' });
        return;
      }
      try {
        await messagesService.createMessage({ ...parsed.data, senderId: socket.data.user.id });
      } catch (error: unknown) {
        metrics.message('error');
        trackError(error, { source: 'socket_message', socketId: socket.id });
        log.error('Socket message delivery failed.', { socketId: socket.id, error: error instanceof Error ? error.message : 'unknown' });
        socket.emit('error', { code: error instanceof Error && error.message === 'FORBIDDEN' ? 'FORBIDDEN' : 'MESSAGE_FAILED', message: 'Message could not be sent.' });
      }
    });

    socket.on('message:read', async (messageId: unknown) => {
      if (typeof messageId !== 'string' || !messageId.trim()) {
        socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Message ID is required.' });
        return;
      }
      if (!await isActiveUser(socket)) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'Your account is not authorized for this operation.' });
        return;
      }
      try {
        const conversationId = await messagesService.markRead(socket.data.user.id, messageId.trim());
        socket.emit('message:read', { messageId: messageId.trim() });
        if (conversationId) io.to(roomFor(conversationId)).emit('message:read', { messageId: messageId.trim(), conversationId, userId: socket.data.user.id });
      } catch (_error) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'You are not authorized to read this message.' });
      }
    });

    for (const eventType of ['typing:start', 'typing:stop'] as const) {
      socket.on(eventType, (conversationId: unknown) => {
        void (async () => {
          if (typeof conversationId !== 'string' || !await isActiveUser(socket) || !authorizedRoom(socket, conversationId)) {
            socket.emit('error', { code: 'FORBIDDEN', message: 'You are not authorized to use this conversation.' });
            return;
          }
          socket.to(roomFor(conversationId)).emit(eventType, { conversationId, userId: socket.data.user.id });
        })();
      });
    }

    socket.on('disconnect', (reason) => logger.info('Socket.IO client disconnected.', { socketId: socket.id, userId: socket.data.user.id, reason }));
    socket.on('disconnect', () => metrics.socket('disconnected'));
  });

  eventBus.subscribe('message.sent', async (event) => {
    metrics.message('delivered');
    io.to(roomFor(event.payload.conversationId)).emit('message:received', event.payload);
    io.to(roomFor(event.payload.conversationId)).emit('message:sent', event.payload);
  });

  eventBus.subscribe('request.accepted', async (event) => {
    const payload = { requestId: event.payload.requestId, senderId: event.payload.senderId, receiverId: event.payload.receiverId };
    io.to(userRoomFor(event.payload.senderId)).emit('conversation:created', payload);
    io.to(userRoomFor(event.payload.receiverId)).emit('conversation:created', payload);
  });

  return io;
};
