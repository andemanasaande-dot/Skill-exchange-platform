import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';

const notificationEvents = ['notification:new', 'message:received', 'message:sent', 'conversation:created'];

export function useNotificationRealtime(socket: Socket | null, queryClient: QueryClient) {
  useEffect(() => {
    if (!socket) return;
    const refreshNotifications = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    };
    const refreshExchange = () => {
      refreshNotifications();
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    };
    const refreshMessage = () => {
      refreshNotifications();
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };
    socket.on('notification:new', refreshNotifications);
    socket.on('conversation:created', refreshExchange);
    socket.on('message:received', refreshMessage);
    socket.on('message:sent', refreshMessage);
    return () => {
      socket.off('notification:new', refreshNotifications);
      socket.off('conversation:created', refreshExchange);
      socket.off('message:received', refreshMessage);
      socket.off('message:sent', refreshMessage);
    };
  }, [socket, queryClient]);
}
