
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const studyRoutes = require("./routes/studyRoutes");
const geminiRoutes = require("./routes/geminiRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Allow requests from the React frontend
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5174",
  })
);

// Parse incoming JSON data
app.use(express.json());

// Backend home route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to StudyMate AI Backend!",
  });
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend is running successfully",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Not connected",
  });
});

// Existing study planner routes
app.use("/api/study", studyRoutes);

// New Gemini AI routes
app.use("/api/ai", geminiRoutes);

// Connect to MongoDB and start the server
async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in backend/.env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.log(
      "Server will start, but database operations need MongoDB."
    );
  }
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
}

startServer();
