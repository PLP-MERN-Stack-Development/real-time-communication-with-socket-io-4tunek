// src/server.js - Advanced Socket.io chat server with rooms, private messages, uploads, read receipts, reactions
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');

dotenv.config(); // Load env variables first

// Initialize app
const app = express();
const server = http.createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount auth routes
app.use('/api/auth', authRoutes);

// Serve static files (including uploads)
const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(publicDir));

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
    cb(null, safe);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // max 10MB

// In-memory stores
const users = {};        // socketId => { username, id }
const typingUsers = {};  // socketId => { username, room? }
const rooms = {          // roomName => { name, members: Set<socketId> }
  general: { name: 'general', members: new Set() },
};
const messages = []; // { id, room, text, sender, senderId, timestamp, attachments: [], reactions: {}, readBy: [], isPrivate, to? }

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Helper functions
function emitUserList() {
  io.emit('user_list', Object.values(users));
}
function emitRoomsList() {
  io.emit('rooms_list', Object.keys(rooms));
}
function sendRoomHistory(socket, room = 'general', limit = 50) {
  const hist = messages.filter(m => m.room === room && !m.isPrivate).slice(-limit);
  socket.emit('message_history', { room, history: hist });
}

// ---------------- SOCKET.IO EVENTS ----------------
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Send available rooms and users
  socket.emit('rooms_list', Object.keys(rooms));
  socket.emit('user_list', Object.values(users));
  sendRoomHistory(socket, 'general');

  // USER JOIN
  socket.on('user_join', (username) => {
    if (!username) return;
    users[socket.id] = { username, id: socket.id };
    rooms.general.members.add(socket.id);
    socket.join('general');

    io.emit('user_joined', { username, id: socket.id, timestamp: new Date().toISOString() });
    emitUserList();
    emitRoomsList();
    io.to('general').emit('room_user_list', { room: 'general', users: Array.from(rooms.general.members).map(id => users[id]) });
    console.log(`${username} joined and entered room: general`);
  });

  // JOIN ROOM
  socket.on('join_room', (roomName) => {
    if (!roomName) return;
    if (!rooms[roomName]) rooms[roomName] = { name: roomName, members: new Set() };
    rooms[roomName].members.add(socket.id);
    socket.join(roomName);
    io.to(roomName).emit('room_joined', { room: roomName, username: users[socket.id]?.username, id: socket.id });
    emitRoomsList();
    sendRoomHistory(socket, roomName);
  });

  // LEAVE ROOM
  socket.on('leave_room', (roomName) => {
    if (!roomName || !rooms[roomName]) return;
    rooms[roomName].members.delete(socket.id);
    socket.leave(roomName);
    io.to(roomName).emit('room_left', { room: roomName, username: users[socket.id]?.username, id: socket.id });
    emitRoomsList();
  });

  // SEND MESSAGE
  socket.on('send_message', (payload) => {
    const room = payload?.room || 'general';
    const sender = users[socket.id]?.username || 'Anonymous';
    const msg = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      room,
      text: payload?.text || '',
      sender,
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      attachments: payload?.attachments || [],
      reactions: {},
      readBy: [sender],
      isPrivate: false,
    };
    messages.push(msg);
    if (messages.length > 2000) messages.shift();
    io.to(room).emit('receive_message', msg);
  });

  // TYPING INDICATOR
  socket.on('typing', (payload) => {
    const username = users[socket.id]?.username;
    if (!username) return;
    const room = payload?.room || 'general';

    if (payload?.toSocketId) {
      io.to(payload.toSocketId).emit('typing_private', { from: username, fromId: socket.id, isTyping: !!payload.isTyping });
    } else {
      if (payload?.isTyping) typingUsers[socket.id] = { username, room };
      else delete typingUsers[socket.id];

      const typingInRoom = Object.values(typingUsers).filter(t => t.room === room).map(t => t.username);
      socket.to(room).emit('typing_users', { room, users: typingInRoom });
    }
  });

  // PRIVATE MESSAGE
  socket.on('private_message', ({ toSocketId, text, attachments }) => {
    const sender = users[socket.id]?.username || 'Anonymous';
    const msg = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      room: null,
      text: text || '',
      sender,
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      attachments: attachments || [],
      reactions: {},
      readBy: [sender],
      isPrivate: true,
      to: toSocketId,
    };
    messages.push(msg);
    if (messages.length > 2000) messages.shift();

    io.to(toSocketId).emit('private_message', msg);
    socket.emit('private_message', msg);
  });

  // MESSAGE READ
  socket.on('message_read', ({ messageId, room, fromPrivate }) => {
    const username = users[socket.id]?.username;
    if (!username) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    if (!msg.readBy.includes(username)) msg.readBy.push(username);

    if (msg.isPrivate && msg.to) {
      io.to(msg.senderId).emit('message_read', { messageId, by: username });
    } else {
      io.to(room || msg.room || 'general').emit('message_read', { messageId, by: username });
    }
  });

  // REACTIONS
  socket.on('message_reaction', ({ messageId, emoji }) => {
    const username = users[socket.id]?.username;
    if (!username) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    const list = msg.reactions[emoji];
    const idx = list.indexOf(username);
    if (idx === -1) list.push(username);
    else list.splice(idx, 1);

    if (msg.isPrivate && msg.to) {
      io.to(msg.to).emit('message_reaction', { messageId, emoji, users: msg.reactions[emoji] });
      io.to(msg.senderId).emit('message_reaction', { messageId, emoji, users: msg.reactions[emoji] });
    } else {
      io.to(msg.room || 'general').emit('message_reaction', { messageId, emoji, users: msg.reactions[emoji] });
    }
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    const leftUser = users[socket.id];
    if (leftUser) io.emit('user_left', { username: leftUser.username, id: socket.id, timestamp: new Date().toISOString() });
    Object.values(rooms).forEach(r => r.members.delete(socket.id));
    delete users[socket.id];
    delete typingUsers[socket.id];
    emitUserList();
    emitRoomsList();
    io.emit('typing_users', Object.values(typingUsers));
    console.log(`User disconnected: ${socket.id}`);
  });
});

// ----------------- UPLOAD ENDPOINT -----------------
app.post('/api/upload', upload.array('files', 4), (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ ok: false, error: 'No files' });
  const files = req.files.map(f => ({
    originalName: f.originalname,
    mimeType: f.mimetype,
    size: f.size,
    url: `/uploads/${path.basename(f.path)}`,
  }));
  return res.json({ ok: true, files });
});

// SIMPLE API
app.get('/api/messages', (req, res) => res.json(messages));
app.get('/api/users', (req, res) => res.json(Object.values(users)));
app.get('/api/rooms', (req, res) => res.json(Object.keys(rooms)));

app.get('/', (req, res) => res.send('Advanced Socket.io Chat Server running'));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { app, server, io };
