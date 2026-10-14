FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM build AS production-dependencies
# Keep exactly the lockfile-installed production graph without a second network
# install. Native dependencies were installed on the same pinned Linux base.
RUN npm prune --omit=dev --ignore-scripts --offline && npm cache clean --force

FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules

COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations

EXPOSE 10000
USER node
CMD ["node", "dist/server/server.js"]
