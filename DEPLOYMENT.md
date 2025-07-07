# Back4App Deployment Guide

## Prerequisites
- Back4App account
- Git repository with your code
- Docker installed locally (for testing)

## Deployment Steps

### 1. Environment Variables
Make sure to set these environment variables in your Back4App dashboard:
- `PORT` - Will be set automatically by Back4App
- `JWT_SECRET` - Your JWT secret key
- `MONGODB_URI` - Your MongoDB connection string
- `NODE_ENV` - Set to "production"

### 2. Docker Configuration
The Dockerfile has been optimized for Back4App with:
- Node.js 18 Alpine (smaller image size)
- Security improvements (non-root user)
- Health check endpoint
- Production-optimized dependencies

### 3. Testing Locally
Before deploying, test your Docker container locally:
```bash
# Build the Docker image
docker build -t origin-backend .

# Run the container
docker run -p 3000:3000 --env-file .env origin-backend
```

### 4. Back4App Deployment
1. Connect your Git repository to Back4App
2. Set environment variables in the Back4App dashboard
3. Deploy using the Docker option
4. Back4App will automatically detect and use your Dockerfile

### 5. Health Check
The application includes a health check endpoint at `/health` that Back4App can use to monitor your application.

### 6. API Endpoints
Your API will be available at:
- `https://your-app.back4app.io/api/origin/auth/*`
- `https://your-app.back4app.io/api/origin/forms/*`
- `https://your-app.back4app.io/api/railfreight/forms/*`
- `https://your-app.back4app.io/health`

## Notes
- The Dockerfile exposes port 3000 (default for your app)
- Back4App will automatically assign the correct port via the PORT environment variable
- Make sure your MongoDB connection string is properly configured in environment variables
