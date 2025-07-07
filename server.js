const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const formRoutes = require("./routes/OriginformRoutes");
const railFreightRoutes = require("./routes/RailFreightRoutes");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandler");

dotenv.config(); // Load environment variables from .env file

const app = express();

// Connect to database
connectDB()
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });

// Middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.JWT_SECRET, // Use secret key from environment variable
    resave: false,
    saveUninitialized: true,
  })
);

// Routes
app.use("/api/origin/auth", authRoutes);// Ensure this route is correctly set up
app.use("/api/origin/forms", formRoutes);
app.use("/api/railfreight/forms", railFreightRoutes);

// Health check route for Docker and Back4App
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Error Handling Middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT)
  .on('listening', () => {
    console.log(`Server running on port ${PORT}`);
  })
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Please:
      1. Stop any other servers running on this port, OR
      2. Choose a different port by changing the PORT environment variable`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
    }
  });
