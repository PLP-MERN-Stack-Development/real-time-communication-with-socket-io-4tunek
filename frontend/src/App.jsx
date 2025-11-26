import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import Login from './components/login';
import Chat from './components/Chat';
import { login, signup, getMe } from './api';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

export default function App() {
  const socketRef = useRef(null);
  const [user, setUser] = useState(null); 
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  // Fetch user if token exists
  useEffect(() => {
    const fetchUser = async () => {
      if (!token) return; 
      try {
        const data = await getMe(token);
        setUser(data.user);
      } catch {
        // token invalid or expired
        localStorage.removeItem('token');
        setToken('');
      }
    };
    fetchUser();
  }, [token]);

  // Request notifications permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) =>
        console.log('Notification permission:', permission)
      );
    }
  }, []);

  // Initialize Socket.io only if token exists
  useEffect(() => {
    if (!token) return;
    socketRef.current = io(SERVER_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket'],
      auth: { token },
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // Connect socket once user is authenticated
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    if (user) {
      s.connect();
      s.once('connect', () => s.emit('user_join', user.name));
    } else {
      s.disconnect();
    }
  }, [user]);

  // Handle login
  const handleLogin = async (email, password) => {
    try {
      const data = await login(email, password);
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Login failed');
    }
  };

  // Handle signup
  const handleSignup = async (name, email, password) => {
    try {
      const data = await signup(name, email, password);
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Signup failed');
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
  };

  return (
    <div className="app-root">
      {!user ? (
        <Login onLogin={handleLogin} onSignup={handleSignup} />
      ) : (
        <Chat socket={socketRef.current} username={user.name} onLogout={handleLogout} />
      )}
    </div>
  );
}
