# Thumbnail Service for AgentCache
# Uses ffmpeg + hls-live-thumbnails to generate video thumbnails

FROM node:18-alpine

WORKDIR /app

# Install ffmpeg and dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Install hls-live-thumbnails globally
RUN npm install -g hls-live-thumbnails

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/thumbnails && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Expose port
EXPOSE 8080

# Environment
ENV NODE_ENV=production
ENV PORT=8080
ENV THUMBNAIL_DIR=/app/thumbnails

CMD ["node", "server.js"]
