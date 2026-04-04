import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuth } from '../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export default function useWebSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const clientRef = useRef(null);

  useEffect(() => {
    if (!user?.token) return;

    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      connectHeaders: { Authorization: `Bearer ${user.token}` },
      onConnect: () => {
        console.log('WebSocket connected');

        // Listen for application updates
        client.subscribe('/topic/applications', (message) => {
          const data = JSON.parse(message.body);
          queryClient.invalidateQueries({ queryKey: ['applications'] });
          toast.success(`New activity: ${data.company || 'Application updated'}`);
        });

        // Listen for ghost job alerts
        client.subscribe('/topic/ghost-alerts', (message) => {
          const data = JSON.parse(message.body);
          toast(`Ghost alert: ${data.message || 'Check ghost jobs'}`, { icon: '👻' });
          queryClient.invalidateQueries({ queryKey: ['applications'] });
        });
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected');
      },
      onStompError: (frame) => {
        console.error('STOMP error', frame);
      },
      reconnectDelay: 5000,
    });

    client.activate();
    clientRef.current = client;

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [user?.token]);

  return clientRef.current;
}
