FROM node:18-alpine
WORKDIR /app

# Install deps with fallback to npm install when lock mismatches
COPY package*.json ./
RUN apk add --no-cache openssl && (npm ci || npm install --no-audit --no-fund)

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Runtime env (Railway/Render will override as needed)
ENV PORT=10000

# Apply pending migrations on start (sqlite or other)
CMD ["npm","run","start:migrate"]
