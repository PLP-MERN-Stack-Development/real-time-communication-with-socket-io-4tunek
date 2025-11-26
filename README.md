# ChatterBox — Real-Time Chat Application

Project overview
----------------
ChatterBox is a full-stack real-time chat application using Socket.io, Express, MongoDB and a React + Vite front-end. The server implements rooms, private messaging, typing indicators, file uploads, reactions, read receipts and JWT-based authentication. The client provides a responsive UI with notifications and audio alerts.

Key server files:
- [backend/src/server.js](backend/src/server.js) — main Socket.io server and HTTP endpoints (see [`sendRoomHistory`](backend/src/server.js))
- [backend/src/routes/auth.js](backend/src/routes/auth.js) — signup/login/me endpoints
- [backend/src/models/User.js](backend/src/models/User.js) — Mongoose user model with password hashing

Key client files:
- [frontend/src/App.jsx](frontend/src/App.jsx) — main app, auth flow and socket initialization
- [frontend/src/api.js](frontend/src/api.js) — `signup`, `login`, `getMe` helpers
- [frontend/src/components/Chat.jsx](frontend/src/components/Chat.jsx) — chat UI and room handling (see `joinRoom`)
- [frontend/src/components/login.jsx](frontend/src/components/login.jsx) — authentication UI

Setup instructions
------------------
Prerequisites:
- Node.js v18+ and npm
- MongoDB running locally (or update MONGO_URI in [backend/.env](backend/.env))

1. Install server dependencies
   ```sh
   cd backend
   npm install
   ```

2. Install client dependencies
   ```sh
   cd ../frontend
   npm install
   ```

3. Configure environment
   - Backend: copy or edit [backend/.env](backend/.env)
     - PORT (default 5000)
     - MONGO_URI (e.g. mongodb://localhost:27017/ChatterBox)
     - JWT_SECRET
   - Frontend: edit [frontend/.env](frontend/.env) to point VITE_SERVER_URL (e.g. http://localhost:5000)

4. Run in development
   - Start backend:
     ```sh
     cd backend
     npm run dev    # uses nodemon
     ```
   - Start frontend:
     ```sh
     cd frontend
     npm run dev    # vite
     ```

5. Open the app in the browser (default Vite port 5173). The client connects to the Socket.io server and uses JWT for authenticated socket auth (see [frontend/src/App.jsx](frontend/src/App.jsx)).

Features implemented
--------------------
Authentication & users
- Email/password signup and login with JWT tokens ([backend/src/routes/auth.js](backend/src/routes/auth.js), [`User` model](backend/src/models/User.js))
- Route to get current user ([`/api/auth/me`](backend/src/routes/auth.js))

Real-time chat
- Global room ("general") with per-room join/leave ([backend/src/server.js](backend/src/server.js))
- Multiple rooms support and rooms list
- Private messaging between users (socket private_message)
- Message history per room (see [`sendRoomHistory`](backend/src/server.js))
- Typing indicators and per-room typing lists
- Online user list and join/leave notifications

Message features
- File/image uploads via `/api/upload` and attachments in messages
- Read receipts (`message_read` event)
- Reactions on messages (`message_reaction` event)
- Local deduplication of messages on client and optimistic local messages

Client UX / Notifications
- Browser notifications (Web Notifications API) and sound notification (notification.mp3) ([frontend/src/components/Chat.jsx](frontend/src/components/Chat.jsx))
- Reconnection logic (client socket configured with reconnection attempts)
- Responsive UI components: chat, rooms list, online users, composer UI

APIs & endpoints
- Auth: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me` ([backend/src/routes/auth.js](backend/src/routes/auth.js))
- Uploads: `/api/upload` (multipart form)
- Info endpoints: `/api/messages`, `/api/users`, `/api/rooms` (simple JSON views)

Notes and next steps
--------------------
- Persisting message history to MongoDB would be the next step (currently in-memory `messages` array in [backend/src/server.js](backend/src/server.js)).
- Add stricter validation and rate limiting to upload endpoints.
- Consider namespaces / scaling Socket.io with Redis adapter for multiple server instances.

