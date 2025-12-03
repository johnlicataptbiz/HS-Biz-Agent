# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install root dependencies (frontend + shared)
RUN npm ci

# Copy source
COPY . .

# Install server dependencies (separate package.json)
RUN apk add --no-cache python3 make g++
RUN cd server && npm ci --omit=dev

# Build frontend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy node_modules from builder (root deps)
COPY --from=builder /app/node_modules ./node_modules

# Copy server code
COPY --from=builder /app/server ./server

# Copy server node_modules (native deps like better-sqlite3)
COPY --from=builder /app/server/node_modules ./server/node_modules

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port for Railway
EXPOSE 8080

CMD ["node", "server/server.js"]
