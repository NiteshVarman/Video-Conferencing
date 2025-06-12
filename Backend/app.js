require("dotenv").config();
const express = require('express');
const { createServer } = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const meetingRoutes = require("./routes/meeting");
const { setupSocket } = require("./socket/socket");

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

// Routes
app.use("/api/meetings", meetingRoutes);

// Socket.IO setup
setupSocket(io);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB is connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});