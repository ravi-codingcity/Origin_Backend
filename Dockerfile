FROM node:16

WORKDIR /app

# Copy package files and install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port your app runs on
EXPOSE 5001

# Command to run the application
CMD ["node", "server.js"]
