# Этап 1: сборка интерфейса на React
FROM node:26-alpine AS web
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build

# Этап 2: API и собранный интерфейс в одном небольшом образе
FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY backend ./backend
COPY --from=web /app/frontend/dist ./frontend/dist
RUN mkdir -p /app/backend/data && chown -R node:node /app/backend/data
USER node
EXPOSE 4000
CMD ["node", "--disable-warning=ExperimentalWarning", "backend/src/server.js"]
