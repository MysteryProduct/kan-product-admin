# syntax=docker/dockerfile:1

FROM node:22.9.0-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22.9.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5001
RUN apk add --no-cache bash
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 5001
CMD ["node", "server.js"]
