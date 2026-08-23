import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';

const notificationEvents = ['request.created', 'request.accepted', 'request.rejected', 'message.sent', 'moderation.flagged', 'system', 'notification:new'];

export function useNotificationRealtime(socket: Socket | null, queryClient: QueryClient) {
  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    notificationEvents.forEach((event) => socket.on(event, refresh));
    return () => notificationEvents.forEach((event) => socket.off(event, refresh));
  }, [socket, queryClient]);
}
