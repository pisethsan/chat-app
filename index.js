import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

import User from "./models/User.js";
import Message from "./models/Message.js";


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("❌ MONGO_URI is not set in .env");
  process.exit(1);
}
mongoose.connect(mongoUri)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// Auth routes
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ message: "Email or username already in use" });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hash });
    await user.save();
    res.json({ message: "User signed up successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "2h" });
    res.json({ token, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Socket.IO auth middleware using JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No auth token"));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = { id: payload.id, username: payload.username };
    next();
  } catch (e) {
    next(new Error("Invalid token"));
  }
});

// Socket events
io.on("connection", async (socket) => {
  console.log(`🔌 ${socket.user.username} connected (${socket.id})`);

  // Send last 50 messages
  try {
    const last = await Message.find().sort({ createdAt: -1 }).limit(50).sort({ createdAt: 1 });
    socket.emit("previous messages", last);
  } catch (e) {
    console.error("Fetch messages error:", e.message);
  }

  socket.on("message", async (data) => {
    try {
      const text = (data?.text || "").toString().trim();
      if (!text) return;
      const msg = new Message({
        text,
        user: socket.user.username,
        socketId: socket.id
      });
      const saved = await msg.save();
      // Broadcast to everyone in the room including the sender
      io.emit("message", saved);
    } catch (e) {
      console.error("Save message error:", e.message);
    }
  });

  socket.on('typing', ({ user }) => {
    socket.broadcast.emit('typing', { user });
  });

  socket.on('stop typing', ({ user }) => {
    socket.broadcast.emit('stop typing', { user });
  });

  socket.on("clear history", async () => {
    try {
      await Message.deleteMany({});
      io.emit("history cleared");
      console.log(`🧹 ${socket.user.username} cleared the chat history.`);
    } catch (e) {
      console.error("Clear history error:", e.message);
      socket.emit("clear history error", { message: "Could not clear history." });
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ ${socket.user.username} disconnected (${socket.id})`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
