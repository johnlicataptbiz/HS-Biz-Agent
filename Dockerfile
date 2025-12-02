# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci
RUN cd server && npm ci

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy server and built frontend
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/node_modules ./server/node_modules

# Set production environment
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server/server.js"]
