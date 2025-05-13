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
app.use("/api/origin/auth", authRoutes); // Ensure this route is correctly set up
app.use("/api/origin/forms", formRoutes);
app.use("/api/railfreight/forms", railFreightRoutes);

// Error Handling Middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
