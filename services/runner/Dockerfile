# QAAI Runner Service Dockerfile
# Based on Playwright image with all browser dependencies

FROM mcr.microsoft.com/playwright:v1.48.0-jammy

# Set working directory
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml* ./

# Copy service package files
COPY services/runner/package.json ./services/runner/

# Copy packages (for playwright-tests)
COPY packages ./packages

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy service source code
COPY services/runner ./services/runner

# Set environment to production
ENV NODE_ENV=production

# Expose port (if needed for health checks)
EXPOSE 3001

# Run the service
CMD ["node", "services/runner/index.js"]