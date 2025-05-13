const mongoose = require('mongoose');

// Cache the database connection between function invocations
let cachedConnection = null;

const connectDB = async () => {
  // If we have a cached connection, return it
  if (cachedConnection) {
    console.log('Using existing database connection');
    return cachedConnection;
  }

  try {
    // Configure MongoDB connection options optimized for Vercel
    const options = {
      // Remove deprecated options (useNewUrlParser and useUnifiedTopology)
      serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds instead of default 30
      maxPoolSize: 10, // Maintain up to 10 socket connections
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      connectTimeoutMS: 10000, // Reduce from default 30000ms
    };
    
    // Connect to the database
    const connection = await mongoose.connect(process.env.MONGO_URI, options);
    
    // Store the connection in the cache
    cachedConnection = connection;
    
    // Handle connection errors after initial connection
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error after initial connection:', err);
      cachedConnection = null; // Clear the cache to allow reconnection attempts
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      cachedConnection = null;
    });
    
    console.log('MongoDB connected successfully');
    return connection;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    
    // In production, don't keep the app running with a failed DB connection
    if (process.env.NODE_ENV === 'production') {
      console.error('Database connection failed in production environment. Exiting...');
      throw error; // Throw the error for proper handling in production
    } else {
      // Only for development, log but continue
      console.log('Database connection failed, but keeping application running for development purposes.');
    }
  }
};

module.exports = connectDB;
