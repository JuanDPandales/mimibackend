# Stage 1: Build
FROM node:20-alpine AS builder

# Enable corepack to use pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy dependency definition files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm run build

# Stage 2: Production
FROM node:20-alpine AS production

# Enable corepack to use pnpm for production deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy dependency definition files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set Node environment to production
ENV NODE_ENV=production

# Use non-root user for security (Applies to AWS ECS / Fargate / Beanstalk best practices)
USER node

# Expose port 3000 (typical for NestJS, AWS may map this based on your Task Definition / App Runner config)
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]