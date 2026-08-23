FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci

COPY server server
RUN npx prisma generate --schema server/prisma/schema.prisma
RUN npm run build --workspace server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --omit=dev
COPY server/prisma server/prisma
RUN npx prisma generate --schema server/prisma/schema.prisma
COPY --from=build /app/server/dist server/dist

RUN addgroup -S skillswap && adduser -S skillswap -G skillswap \
  && chown -R skillswap:skillswap /app
USER skillswap
EXPOSE 5000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=10 CMD node -e "require('http').get('http://127.0.0.1:5000/api/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server/dist/server.js"]
