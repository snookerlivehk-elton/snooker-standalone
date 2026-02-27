# Root Dockerfile: build frontend and serve via Nginx
#
# 目的：
# - 讓 Railway 服務在「專案根目錄」自動偵測到 Dockerfile，而不是使用 Nixpacks + start.sh
# - 前端靜態資產由 Nginx 提供；不依賴根目錄的 start.sh 或 npm 執行環境
#
FROM node:20-alpine AS builder
WORKDIR /app

# 可用 Railway Variables 覆蓋（若沒有，使用預設值）
ARG VITE_API_URL="https://api.snookerhk.live"
ARG VITE_SOCKET_URL="https://api.snookerhk.live"
ARG VITE_SOCKET_PATH="/socket.io"
ARG VITE_ENABLE_SOCKET="true"

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_SOCKET_PATH=$VITE_SOCKET_PATH
ENV VITE_ENABLE_SOCKET=$VITE_ENABLE_SOCKET

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend ./frontend
WORKDIR /app/frontend
RUN npx tsc -p . && npx vite build && node -e "fs=require('fs');fs.copyFileSync('dist/index.html','dist/404.html')"

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
