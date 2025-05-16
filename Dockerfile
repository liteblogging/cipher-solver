FROM node:18-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.11.0

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Install dependencies (without frozen lockfile to handle any issues)
RUN pnpm install

# Copy the rest of the application
COPY . .

# Build the application
RUN pnpm build

# Expose the port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"] 