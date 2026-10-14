# Planfin HC10909: Next.js dashboard (web) + scheduled SMT/MIS/MOPH Notify jobs (worker), one image.
# Build:  docker compose build      Run:  docker compose up -d      Open:  http://<server>:5200

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=5200 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Bangkok \
    DATA_DIR=/app/data
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/scripts ./scripts
# data/ is the shared volume (Docker fills an empty named volume from here); data-seed/ is the fallback copy
COPY --from=build --chown=node:node /app/data ./data
COPY --from=build --chown=node:node /app/data ./data-seed
USER node
EXPOSE 5200
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
