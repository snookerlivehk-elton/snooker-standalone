# Root Dockerfile to enforce Node 20 and correct Prisma generation
# This builds and runs the backend service from ./backend

FROM node:20-alpine AS builder
WORKDIR /app

# Copy backend manifests first
COPY backend/package*.json ./

# Ensure Prisma schema is present BEFORE npm ci (postinstall runs prisma generate)
COPY backend/prisma ./prisma
COPY backend/tsconfig.json ./

# OpenSSL is required by Prisma
RUN apk add --no-cache openssl

# Install deps (will run postinstall -> prisma generate) with schema present
RUN npm ci

# Copy the rest of the backend source for build
COPY backend ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy runtime manifests and prisma, then ensure OpenSSL
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
RUN apk add --no-cache openssl

# Install only production deps and guarantee Prisma client is generated
RUN npm ci --omit=dev
RUN npx prisma generate

# Copy compiled dist and sample env
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.env.example ./.env.example

EXPOSE 3000
# Use npm lifecycle so prestart runs prisma generate before app starts
CMD ["npm", "run", "start"]