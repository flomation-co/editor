# Pulling the DHI base requires `docker login dhi.io`. For local builds
# without DHI credentials: docker build --build-arg NODE_IMAGE=node:22-alpine .
ARG NODE_IMAGE=dhi.io/node:22-alpine3.23-dev

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM ${NODE_IMAGE}
RUN addgroup -S flomation && adduser -S flomation -G flomation
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/build ./build
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# The entrypoint writes run-config.js into build/client at startup
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chown flomation:flomation /app/build/client

USER flomation
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider "http://127.0.0.1:${PORT}/" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
