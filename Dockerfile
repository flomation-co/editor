# Pulling the DHI base requires `docker login dhi.io`. For local builds
# without DHI credentials: docker build --build-arg NODE_IMAGE=node:26-alpine .
ARG NODE_IMAGE=dhi.io/node:26-alpine-dev

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM ${NODE_IMAGE}
# Create the flomation user and group, pinned to an explicit uid/gid — the same
# 10001 every other Flomation image uses, so the estate runs as one id.
# Pinning matters: `adduser -S` with no -u takes the first free system id, which
# collides with package-provided accounts (this is how the runner image ended up
# on uid 101). 10001 is free in every base image we use.
RUN addgroup -g 10001 -S flomation && \
    adduser  -u 10001 -S flomation -G flomation
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/build ./build
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# The entrypoint writes run-config.js into build/client at startup
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chown flomation:flomation /app/build/client

# Numeric rather than a name: with `runAsNonRoot: true` the kubelet refuses an
# image whose USER is a name, because it cannot verify the name is not root.
# The account is still called `flomation`, so `ps` and `ls -l` stay readable.
USER 10001:10001
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider "http://127.0.0.1:${PORT}/" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
