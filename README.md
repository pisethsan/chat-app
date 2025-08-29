# Socket.IO Chat App (Register + Login + MongoDB)

A minimal chat app using Express, Socket.IO, MongoDB (Mongoose), JWT auth, and a vanilla HTML frontend.

## Features
- Register and Login forms
- Users saved in MongoDB (passwords hashed)
- JWT-based auth
- Socket.IO connection secured with JWT
- Messages saved in MongoDB and shown to all users

## Setup

1) Install dependencies:
```bash
npm install
```

2) Create a `.env` file in the project root (copy from `.env.example`) and set your MongoDB URI and JWT secret.

3) Run the server:
```bash
npm run dev
# or
npm start
```

Open http://localhost:4000 in your browser.

