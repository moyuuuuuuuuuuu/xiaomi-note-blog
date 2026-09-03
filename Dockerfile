# syntax=docker/dockerfile:1
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html postcss.config.mjs vite.config.ts default_shadcn_theme.css ./
COPY src ./src
RUN pnpm build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/app/data \
    DIST_DIR=/app/dist

WORKDIR /app
COPY --chown=node:node package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
COPY --chown=node:node src/app/lib/xiaomiNotes.js ./src/app/lib/xiaomiNotes.js
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 8787
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
