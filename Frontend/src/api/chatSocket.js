import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WS_URL = import.meta.env.VITE_SPRING_BOOT_WS_URL || 'http://localhost:8080/ws';

export function createChatClient(onConnect, onError) {
  const client = new Client({
    webSocketFactory: () => new SockJS(WS_URL, null, { withCredentials: true }),
    reconnectDelay: 5000,
    onConnect,
    onStompError: (frame) => {
      onError?.(frame.headers?.message || 'Loi ket noi chat');
    },
    onWebSocketError: (event) => {
      onError?.(event?.message || 'Loi WebSocket');
    }
  });

  client.activate();
  return client;
}

export function subscribeConversation(client, conversationId, onMessage) {
  return client.subscribe(`/topic/chat/${conversationId}`, (frame) => {
    onMessage(JSON.parse(frame.body));
  });
}

export function sendChatMessage(client, conversationId, noiDung) {
  client.publish({
    destination: '/app/chat.send',
    body: JSON.stringify({
      maHoiThoai: conversationId,
      noiDung
    })
  });
}
