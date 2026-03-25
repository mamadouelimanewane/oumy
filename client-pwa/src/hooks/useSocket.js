import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const useSocket = (token) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    socketRef.current = io(SOCKET_URL, {
      auth: { token },
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Socket connecté');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Socket déconnecté');
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket error:', err);
      setIsConnected(false);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [token]);

  const on = (event, callback) => {
    socketRef.current?.on(event, callback);
  };

  const off = (event, callback) => {
    socketRef.current?.off(event, callback);
  };

  const emit = (event, data) => {
    socketRef.current?.emit(event, data);
  };

  return { socket: socketRef.current, isConnected, on, off, emit };
};

export default useSocket;
