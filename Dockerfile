# syntax=docker/dockerfile:1
FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
# Optional corporate CA is trusted only for this build step, never copied.
RUN --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; npm install --global pnpm@11.19.0
ENV CI=true NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Keep dependency caching based on manifests while copying their hierarchy once.
FROM base AS manifests
COPY . .
RUN mkdir /manifests && cp package.json pnpm-lock.yaml pnpm-workspace.yaml /manifests/ && \
    for package in apps/* packages/*; do mkdir -p "/manifests/$package"; cp "$package/package.json" "/manifests/$package/"; done

FROM base AS dependencies
COPY --from=manifests /manifests/ ./
RUN --mount=type=cache,id=crm-pnpm,target=/pnpm/store,sharing=locked --mount=type=cache,id=crm-pnpm-metadata,target=/root/.cache/pnpm,sharing=locked --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; pnpm install --frozen-lockfile --store-dir=/pnpm/store

FROM dependencies AS build
COPY --chown=node:node . .
ARG NEXT_PUBLIC_API_URL
# Code generation only: no connection or credentials are needed during build.
ENV NODE_ENV=production
RUN --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; umask 0022; test -n "$NEXT_PUBLIC_API_URL" && DATABASE_URL=postgresql://build:build@127.0.0.1/build pnpm exec turbo run build

FROM base AS production-dependencies
COPY --from=manifests /manifests/ ./
RUN --mount=type=cache,id=crm-pnpm,target=/pnpm/store,sharing=locked --mount=type=cache,id=crm-pnpm-metadata,target=/root/.cache/pnpm,sharing=locked --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; pnpm install --prod --frozen-lockfile --store-dir=/pnpm/store

FROM production-dependencies AS backend-artifacts
RUN --mount=from=build,source=/app,target=/compiled \
    cp -a /compiled/apps/api/dist apps/api/dist && \
    cp -a /compiled/apps/worker/dist apps/worker/dist && \
    cp -a /compiled/packages/config/dist packages/config/dist && \
    cp -a /compiled/packages/contracts/dist packages/contracts/dist && \
    cp -a /compiled/packages/database/dist packages/database/dist

FROM base AS backend
ENV NODE_ENV=production
COPY --from=backend-artifacts --chown=node:node /app/ ./
USER node

FROM backend AS api
EXPOSE 3001
CMD ["node", "apps/api/dist/bootstrap/main.js"]

FROM backend AS worker
CMD ["node", "apps/worker/dist/bootstrap/main.js"]

FROM base AS web
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# Operations keep the CLI/build tooling deliberately; application images do not.
FROM build AS operations
USER node
CMD ["pnpm", "--filter", "@crm/database", "exec", "prisma", "migrate", "deploy"]
