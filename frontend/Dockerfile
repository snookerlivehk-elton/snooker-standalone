# Frontend Dockerfile: builds static assets and serves via Nginx
FROM node:20-alpine AS builder
WORKDIR /app
# Ensure Vite build embeds backend URLs when building via Docker
ENV VITE_API_URL=https://snookerhk.live
ENV VITE_SOCKET_URL=https://snookerhk.live
ENV VITE_SOCKET_PATH=/socket.io
ENV VITE_ENABLE_SOCKET=true
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc -p . && npx vite build && node -e "fs=require('fs');fs.copyFileSync('dist/index.html','dist/404.html')"

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]