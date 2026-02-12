# Use Node.js 20 Alpine (small image)
FROM node:20-alpine

WORKDIR /app

# Copy package files and install deps
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port (Fly.io sets PORT env var)
EXPOSE 8080

# Run the server
CMD ["npm", "start"]
