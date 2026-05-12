FROM node:22-bookworm-slim AS deps
WORKDIR /repo

COPY package.json package-lock.json ./
COPY app_web/package.json app_web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install
RUN arch="$(dpkg --print-architecture)" \
  && case "$arch" in \
    amd64) oxide_pkg='@tailwindcss/oxide-linux-x64-gnu' ;; \
    arm64) oxide_pkg='@tailwindcss/oxide-linux-arm64-gnu' ;; \
    armhf) oxide_pkg='@tailwindcss/oxide-linux-arm-gnueabihf' ;; \
    *) oxide_pkg='' ;; \
  esac \
  && if [ -n "$oxide_pkg" ]; then \
    oxide_version="$(node -p "require('./app_web/node_modules/@tailwindcss/oxide/package.json').optionalDependencies[process.argv[1]]" "$oxide_pkg")" \
    && npm install --workspace personal-trainer-frontend --no-save "${oxide_pkg}@${oxide_version}"; \
  fi

FROM node:22-bookworm-slim AS builder
WORKDIR /repo

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/app_web/node_modules ./app_web/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY package.json package-lock.json ./
COPY app_web ./app_web
COPY packages/shared ./packages/shared
COPY workspaces ./workspaces

RUN npm run build -w personal-trainer-frontend

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /repo/app_web/.next/standalone ./
COPY --from=builder /repo/app_web/.next/static ./app_web/.next/static

EXPOSE 3000

CMD ["node", "app_web/server.js"]
