/**
 * Custom hook for managing WebSocket connections with automatic reconnection and exponential backoff.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (event: MessageEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export const useWebSocket = ({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
}: UseWebSocketOptions) => {
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const wasOpenedRef = useRef(false);
  const maxReconnectDelay = 30000; // 30 seconds

  // Use refs to store callbacks to prevent re-connection on every render
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);

  // Update refs on every render
  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
  });

  const connect = useCallback(() => {
    // Clear any existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = (_event) => {
      setReadyState(WebSocket.OPEN);
      wasOpenedRef.current = true;
      reconnectAttemptsRef.current = 0;
      onOpenRef.current?.();
    };

    socket.onmessage = (_event) => {
      onMessageRef.current?.(_event);
    };

    socket.onerror = (event) => {
      onErrorRef.current?.(event);
    };

    socket.onclose = (event) => {
      setReadyState(WebSocket.CLOSED);
      
      // Only trigger onClose if the connection was actually opened
      if (wasOpenedRef.current) {
        onCloseRef.current?.();
        wasOpenedRef.current = false;
      }

      // Attempt to reconnect if it wasn't a normal closure (1000)
      if (event.code !== 1000) {
        const delay = Math.min(Math.pow(2, reconnectAttemptsRef.current) * 1000, maxReconnectDelay);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      }
    };

    setReadyState(socket.readyState);
  }, [url]); // Only re-run if URL changes

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        ws.current.close(1000); // 1000 is WebSocket.CLOSE_NORMAL
      }
    };
  }, [connect]);

  const sendMessage = useCallback((data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      ws.current.send(message);
      return true;
    }
    return false;
  }, []);

  return {
    readyState,
    isConnected: readyState === WebSocket.OPEN,
    sendMessage,
  };
};