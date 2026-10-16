# Full node image: `npm ci` compiles better-sqlite3 with node-gyp (python3, make, g++)
FROM node:24 AS build
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
RUN node ace build && cd build && npm ci --omit=dev

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 LOG_LEVEL=info SESSION_DRIVER=cookie TZ=UTC
COPY --from=build /app/build ./
# SQLite in tmp/ is wiped on each deploy: mount a volume on /app/tmp if data must persist
RUN mkdir -p tmp
CMD node ace migration:run --force && node bin/server.js
