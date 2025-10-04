# Backend Dockerfile for cloud-ready build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Ensure Prisma schema exists before npm ci runs postinstall
COPY prisma ./prisma
COPY tsconfig.json ./
# Install OpenSSL for Prisma
RUN apk add --no-cache openssl
# Install deps (will run postinstall -> prisma generate) with schema present
RUN npm ci
# Copy the rest of the source after dependencies for better caching
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
# Ensure OpenSSL is present at runtime for Prisma
RUN apk add --no-cache openssl
RUN npm ci --omit=dev
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
EXPOSE 3000
# Use npm lifecycle so prestart runs `prisma generate` before app starts
CMD ["npm", "run", "start"]
