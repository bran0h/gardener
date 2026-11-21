# Build context is the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api apps/api
RUN pnpm --filter api build \
 && pnpm --filter api deploy --prod --legacy /prod

FROM node:24-alpine
WORKDIR /app
COPY --from=build /prod/node_modules ./node_modules
COPY --from=build /repo/apps/api/build ./
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3333 TZ=UTC
EXPOSE 3333
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3333/health >/dev/null || exit 1
CMD ["node", "bin/server.js"]
