FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci
FROM dependencies AS build
COPY . .
RUN npm run build
FROM base AS jobs
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN mkdir -p artifacts data/candidates && chown -R node:node artifacts data/candidates
USER node
CMD ["node", "--import", "tsx", "scripts/migrate.ts"]
FROM base AS runner
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 8080
CMD ["node", "server.js"]
