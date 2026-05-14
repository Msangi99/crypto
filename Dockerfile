# ─── Backend Dockerfile ──────────────────────────────
FROM node:20-alpine AS base

RUN apk add --no-cache openssl

WORKDIR /app

# Install ALL dependencies (need devDeps for build)
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY contracts/abi ./contracts/abi/

RUN npm ci && npx prisma generate

# Copy source and build
COPY tsconfig.json ./
COPY src ./src/

RUN npm run build

# Remove devDependencies
RUN npm prune --omit=dev

# ─── Production stage ────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/contracts/abi ./contracts/abi
COPY --from=base /app/package.json ./

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
