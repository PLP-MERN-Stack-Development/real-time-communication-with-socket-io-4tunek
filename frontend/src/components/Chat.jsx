import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import './Chat.css';

export default function Chat({ socket, username, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [text, setText] = useState('');
  const [fileQueue, setFileQueue] = useState([]);
  const messagesRef = useRef();
  const typingTimeoutRef = useRef();
  const pageRef = useRef(1);
  const messageIds = useRef(new Set()); 

  // Notification and sound
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.preload = 'auto';
  }, []);

  const playSound = () => {
    if (soundEnabled && audioRef.current) audioRef.current.play().catch(() => {});
  };

  const triggerNotification = (msg) => {
    if (!notifyEnabled || msg.sender === username) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`New message from ${msg.sender}`, {
        body: msg.text || 'Sent an attachment',
        icon: '/favicon.ico',
      });
    }
    playSound();
  };

  useEffect(() => {
    if (!socket) return;

    const handleRoomsList = (r) => setRooms(r || []);
    const handleUserList = (u) => setUsers(u || []);
    const handleMessageHistory = ({ room, history }) => {
      if (room === currentRoom) {
        setMessages(history || []);
        messageIds.current = new Set((history || []).map(m => m.id));
      }
      scrollToBottom();
    };
    const handleReceiveMessage = (msg) => {
      if (!messageIds.current.has(msg.id) && (msg.room === currentRoom || msg.isPrivate)) {
        setMessages(prev => [...prev, msg]);
        messageIds.current.add(msg.id);
        triggerNotification(msg);
        scrollToBottom();
      }
    };
    const handlePrivateMessage = (msg) => {
      if (!messageIds.current.has(msg.id)) {
        setMessages(prev => [...prev, msg]);
        messageIds.current.add(msg.id);
        triggerNotification(msg);
        scrollToBottom();
      }
    };
    const handleTypingUsers = ({ room, users }) => {
      if (room === currentRoom) setTypingUsers(users || []);
    };

    socket.on('rooms_list', handleRoomsList);
    socket.on('user_list', handleUserList);
    socket.on('message_history', handleMessageHistory);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('private_message', handlePrivateMessage);
    socket.on('typing_users', handleTypingUsers);

    return () => {
      socket.off('rooms_list', handleRoomsList);
      socket.off('user_list', handleUserList);
      socket.off('message_history', handleMessageHistory);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('private_message', handlePrivateMessage);
      socket.off('typing_users', handleTypingUsers);
    };
  }, [socket, currentRoom, username, notifyEnabled, soundEnabled]);

  const scrollToBottom = () => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  };

  const joinRoom = (room) => {
    if (!socket) return;
    socket.emit('join_room', room);
    setCurrentRoom(room);
    setMessages([]);
    messageIds.current.clear();
    pageRef.current = 1;
  };

  const sendMessage = async () => {
    if (!socket || (!text && fileQueue.length === 0)) return;

    let attachments = [];
    if (fileQueue.length) {
      const form = new FormData();
      fileQueue.forEach(f => form.append('files', f));
      const res = await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      attachments = res.data.files.map(f => ({ url: f.url, name: f.originalName }));
      setFileQueue([]);
    }

    const msgId = `local-${Date.now()}`;
    const payload = { room: currentRoom, text, attachments };
    socket.emit('send_message', payload);

    // Append locally but prevent duplicates
    setMessages(prev => [
      ...prev,
      { id: msgId, sender: username, text, attachments, timestamp: new Date().toISOString(), reactions: {}, readBy: [username] },
    ]);
    messageIds.current.add(msgId);

    setText('');
    socket.emit('typing', { room: currentRoom, isTyping: false });
    scrollToBottom();
  };

  const toggleReaction = (messageId, emoji) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== messageId) return m;
        const users = new Set(m.reactions?.[emoji] || []);
        if (users.has(username)) users.delete(username);
        else users.add(username);
        return { ...m, reactions: { ...m.reactions, [emoji]: Array.from(users) } };
      })
    );
    socket.emit('message_reaction', { messageId, emoji });
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    socket.emit('typing', { room: currentRoom, isTyping: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socket.emit('typing', { room: currentRoom, isTyping: false }), 800);
  };

  const handleFileSelect = (ev) => setFileQueue(Array.from(ev.target.files));

  return (
    <div className="chat-container">
      <aside className="chat-sidebar">
        <h4>Rooms</h4>
        {rooms.map(r => (
          <div key={r} className={`room-item ${r === currentRoom ? 'active' : ''}`} onClick={() => joinRoom(r)}>
            {r}
          </div>
        ))}
      </aside>

      <main className="chat-main">
        <div className="messages" ref={messagesRef}>
          {messages.map(m => (
            <div key={m.id} className="message">
              <div className="message-header">
                <strong>{m.sender}</strong>
                <small>{new Date(m.timestamp).toLocaleTimeString()}</small>
              </div>
              <div className="message-text">{m.text}</div>
              {m.attachments?.map(a => (
                <div key={a.url}>
                  <a href={a.url} target="_blank" rel="noreferrer">{a.name || a.url}</a>
                </div>
              ))}
              <div className="reactions">
                {Object.entries(m.reactions || {}).map(([emoji, users]) => (
                  <button key={emoji} onClick={() => toggleReaction(m.id, emoji)}>{emoji} {users.length}</button>
                ))}
                <button onClick={() => toggleReaction(m.id, '👍')}>👍</button>
                <button onClick={() => toggleReaction(m.id, '❤️')}>❤️</button>
              </div>
            </div>
          ))}
        </div>
        <div className="typing-indicator">{typingUsers.join(', ')} {typingUsers.length ? 'is typing...' : ''}</div>

        <div className="composer">
          <input type="text" value={text} placeholder="Type a message..." onChange={handleTyping} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
          <input type="file" multiple onChange={handleFileSelect} />
          <button onClick={sendMessage}>Send</button>
        </div>
      </main>

      <aside className="chat-users">
        <h4>People</h4>
        {users.map(u => (
          <div key={u.id} className="user-item">
            {u.username}{' '}
            <button onClick={() => socket.emit('private_message', { toSocketId: u.id, text: `Hi ${u.username}` })}>DM</button>
          </div>
        ))}
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </aside>
    </div>
  );
}
