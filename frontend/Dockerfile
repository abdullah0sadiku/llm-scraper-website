# Development build for Docker
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies with workaround for problematic packages
RUN npm cache clean --force && \
    npm install --legacy-peer-deps --no-audit --no-fund || \
    (rm -rf node_modules package-lock.json && npm install --legacy-peer-deps --no-audit --no-fund)

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
