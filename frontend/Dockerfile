# Frontend Dockerfile: builds static assets and serves via Node (serve)
FROM node:20-alpine AS builder
WORKDIR /app
# Ensure Vite build embeds backend URLs when building via Docker
ENV VITE_API_URL=https://api.snookerhk.live
ENV VITE_SOCKET_URL=https://api.snookerhk.live
ENV VITE_SOCKET_PATH=/socket.io
ENV VITE_ENABLE_SOCKET=true
ENV VITE_GOOGLE_CLIENT_ID=277887232996-5lfubeh4be5pnrd458buc489uq0h0e1g.apps.googleusercontent.com
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc -p . && npx vite build && node -e "fs=require('fs');fs.copyFileSync('dist/index.html','dist/404.html')"

FROM node:20-alpine
WORKDIR /app
RUN npm i -g serve@14
COPY --from=builder /app/dist /app/dist
COPY package*.json /app/
ENV NODE_ENV=production
EXPOSE 8080
CMD ["sh", "-lc", "serve -s dist -l tcp://0.0.0.0:${PORT:-8080}"]
