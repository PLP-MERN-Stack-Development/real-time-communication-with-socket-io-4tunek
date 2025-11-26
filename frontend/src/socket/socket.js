// socket.js - Socket.io client setup
import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

// Socket.io connection URL 
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

// Create socket instance (shared)
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Custom hook for using socket.io 
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // Connect to socket server
  const connect = (username) => {
    socket.connect();
    if (username) socket.emit('user_join', username);
  };

  // Disconnect
  const disconnect = () => {
    socket.disconnect();
  };

  // Send a message
  const sendMessage = (message) => {
    socket.emit('send_message', message);
  };

  // Send a private message
  const sendPrivateMessage = (to, message) => {
    socket.emit('private_message', { toSocketId: to, text: message });
  };

  // Set typing
  const setTyping = (payload) => {
    socket.emit('typing', payload);
  };

  useEffect(() => {
    // connection handlers
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const onReceiveMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
    };

    const onPrivateMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
    };

    const onUserList = (userList) => setUsers(userList);

    const onUserJoined = (user) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: 'System',
          text: `${user.username} joined the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const onUserLeft = (user) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: 'System',
          text: `${user.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const onTypingUsers = (payload) => setTypingUsers(payload);

    // register
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receive_message', onReceiveMessage);
    socket.on('private_message', onPrivateMessage);
    socket.on('user_list', onUserList);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('typing_users', onTypingUsers);

    // cleanup
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('receive_message', onReceiveMessage);
      socket.off('private_message', onPrivateMessage);
      socket.off('user_list', onUserList);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('typing_users', onTypingUsers);
    };
  }, []);

  return {
    socket,
    isConnected,
    lastMessage,
    messages,
    users,
    typingUsers,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
  };
};

export default socket;
