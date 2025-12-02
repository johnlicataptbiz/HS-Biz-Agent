# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (includes express, cors, dotenv)
RUN npm ci

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy node_modules from builder (has all deps including express)
COPY --from=builder /app/node_modules ./node_modules

# Copy server code
COPY --from=builder /app/server ./server

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Set production environment
ENV NODE_ENV=production

# Railway sets PORT=8080 automatically
CMD ["node", "server/server.js"]
