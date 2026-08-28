# syntax=docker/dockerfile:1

# --- Build stage -----------------------------------------------------------
# Compiles TypeScript with the dev dependencies available, so none of them ship
# in the final image.
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage ---------------------------------------------------------
FROM node:20-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

# `npm ci --omit=dev` after the build keeps the image to runtime deps only.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
# The seed reads this at runtime; it is the source for `npm run seed`.
COPY db.json ./db.json

# Run unprivileged. The node image ships a `node` user for exactly this.
USER node

EXPOSE 8082

# Hitting the app's own health endpoint, which reports database connectivity
# rather than merely that the process is alive.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8082/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
