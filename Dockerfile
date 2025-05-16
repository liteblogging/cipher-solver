FROM node:18-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.11.0

# Set environment variables to avoid null bytes issues
ENV NODE_ENV=production
ENV PNPM_HOME=/usr/local/bin
ENV npm_config_use_npm=false
ENV npm_config___u_s_e___n_p_m_=false

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Install dependencies (without frozen lockfile)
RUN pnpm install --no-frozen-lockfile

# Copy the rest of the application
COPY . .

# Build the application using node directly instead of pnpm
RUN node node_modules/@remix-run/dev/dist/cli.js build

# Expose the port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"] 