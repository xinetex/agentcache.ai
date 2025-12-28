# SVT Encore Transcoding Service
# For AgentCache.ai Video Pipeline

FROM eclipse-temurin:17-jre-alpine

# Install FFmpeg and MediaInfo
RUN apk add --no-cache ffmpeg mediainfo curl

# Download latest Encore release
ARG ENCORE_VERSION=2.0.1
RUN curl -L -o /app/encore.jar \
    https://github.com/svt/encore/releases/download/v${ENCORE_VERSION}/encore-${ENCORE_VERSION}.jar

WORKDIR /app

# Create input/output directories
RUN mkdir -p /input /output /profiles

# Copy custom profiles
COPY profiles/ /profiles/

# Expose API port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Start Encore with external Redis (Upstash)
ENV SPRING_PROFILES_ACTIVE=production
ENV SPRING_REDIS_HOST=${UPSTASH_REDIS_HOST}
ENV SPRING_REDIS_PORT=6379
ENV SPRING_REDIS_PASSWORD=${UPSTASH_REDIS_PASSWORD}
ENV SPRING_REDIS_SSL=true

CMD ["java", "-Xmx1g", "-jar", "encore.jar"]
